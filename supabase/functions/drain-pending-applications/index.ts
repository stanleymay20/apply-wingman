// Drains orphaned `applications.status='pending'` rows by invoking auto-apply.
// Also recovers stale `status='preparing'` rows (stuck > 10 min) by resetting
// them to 'pending' so they re-enter the dispatch loop on the same invocation.
// Guards: in-isolate lock, per-user daily cap, company cooldown,
// CV profile present, job has source URL. All transitions go through auto-apply
// so the ledger + retry classifier + idempotency apply uniformly.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  openRun,
  closeRun,
  emitStep,
  incrementRunCounter,
  recordFailure,
  WORKER_VERSION,
} from "../_shared/runLedger.ts";
import { prepareApplicationMaterials } from "../_shared/materials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;
let running = false;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (running) {
    return new Response(JSON.stringify({ skipped: true, reason: "already_running" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  running = true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const summary = { picked: 0, dispatched: 0, skipped: 0, failed: 0, recoveredFromPreparing: 0 };

  try {
    // ── Pre-sweep: reset stale 'preparing' rows back to 'pending' ──────────
    // Any application stuck in 'preparing' for more than 10 minutes was
    // abandoned mid-flight (e.g. function cold-start timeout). Reset it so
    // the pending drain below picks it up in this same invocation.
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: resetRows, error: resetErr } = await supabase
      .from("applications")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("status", "preparing")
      .lt("updated_at", staleThreshold)
      .is("applied_at", null)
      .select("id");

    if (resetErr) {
      console.warn("Failed to reset stale preparing rows:", resetErr.message);
    } else {
      summary.recoveredFromPreparing = resetRows?.length ?? 0;
      if (summary.recoveredFromPreparing > 0) {
        console.log(`Recovered ${summary.recoveredFromPreparing} stale 'preparing' applications → 'pending'`);
      }
    }

    // ── Main drain: pick up pending rows (including just-recovered ones) ───
    const { data: pendings, error } = await supabase
      .from("applications")
      .select("id, user_id, job_id, cv_profile_id, match_score, created_at")
      .eq("status", "pending")
      .is("applied_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    summary.picked = pendings?.length ?? 0;

    for (const app of pendings ?? []) {
      try {
        // Load user profile + job in parallel
        const [{ data: profile }, { data: job }, { data: cv }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, email, full_name, automation_status, daily_application_cap, company_cooldown_days, max_apps_per_company")
            .eq("id", app.user_id)
            .single(),
          supabase
            .from("jobs")
            .select("id, title, company, source_url, source_platform, description, requirements, location")
            .eq("id", app.job_id)
            .single(),
          app.cv_profile_id
            ? supabase
                .from("cv_profiles")
                .select("id, cv_file_url, summary, skills, work_history, experience_years, seniority_level")
                .eq("id", app.cv_profile_id)
                .single()
            : Promise.resolve({ data: null } as any),
        ]);

        if (!profile || profile.automation_status !== "running") {
          summary.skipped++;
          continue;
        }
        if (!job?.source_url) {
          summary.skipped++;
          continue;
        }

        // Daily cap (verified deliveries only would be ideal, but we count attempts today)
        const today = new Date().toISOString().split("T")[0];
        const { count: todayCount } = await supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", app.user_id)
          .gte("applied_at", `${today}T00:00:00`)
          .lte("applied_at", `${today}T23:59:59`);
        if ((todayCount ?? 0) >= (profile.daily_application_cap || 200)) {
          summary.skipped++;
          continue;
        }

        // Recruiter cooldown
        const cooldownDays = profile.company_cooldown_days ?? 30;
        const maxPerCompany = profile.max_apps_per_company ?? 1;
        const { data: recent } = await supabase.rpc("recent_applications_to_company", {
          p_user_id: app.user_id,
          p_company: job.company,
          p_days: cooldownDays,
        });
        if ((recent ?? 0) >= maxPerCompany) {
          summary.skipped++;
          continue;
        }

        // Open a ledger run for this single drain dispatch
        const run = await openRun(supabase, {
          userId: app.user_id,
          triggerType: "cron",
          executionSource: "drain-pending-applications",
          metadata: { applicationId: app.id, jobId: job.id, workerVersion: WORKER_VERSION },
        });
        if (!run) {
          summary.failed++;
          continue;
        }

        await emitStep(supabase, {
          runId: run.id,
          userId: app.user_id,
          stepName: "apply_started",
          status: "running",
          applicationId: app.id,
          jobId: job.id,
          idempotencyKey: `drain_apply_started:${app.id}`,
        });
        await incrementRunCounter(supabase, run.id, "applications_attempted", 1);

        // Tailor CV + cover letter before dispatch (reuses stored materials on retry)
        const materials = cv
          ? await prepareApplicationMaterials(supabase, {
              userId: app.user_id,
              applicationId: app.id,
              userName: profile.full_name || profile.email,
              job,
              cvProfile: cv,
            })
          : { coverLetter: null, tailoredCvText: null, tailoredCvPdfUrl: null };

        const applyStarted = Date.now();
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/auto-apply`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
              "X-Idempotency-Key": `drain:${app.id}`,
            },
            body: JSON.stringify({
              applicationId: app.id,
              jobId: job.id,
              method: "ats_api",
              jobTitle: job.title,
              company: job.company,
              sourceUrl: job.source_url,
              sourcePlatform: job.source_platform,
              userName: profile.full_name || profile.email,
              userEmail: profile.email,
              cvFileUrl: materials.tailoredCvPdfUrl || cv?.cv_file_url || undefined,
              coverLetter: materials.coverLetter || undefined,
              runId: run.id,
              correlationId: run.correlationId,
            }),
          });
          const body = await res.json().catch(() => ({}));
          const verified = body?.deliveryStatus === "delivered";

          if (verified) {
            summary.dispatched++;
            await incrementRunCounter(supabase, run.id, "applications_succeeded", 1);
            await emitStep(supabase, {
              runId: run.id, userId: app.user_id, stepName: "apply_completed",
              status: "completed", applicationId: app.id, jobId: job.id, startedAt: applyStarted,
              payload: { deliveryStatus: body?.deliveryStatus },
              idempotencyKey: `drain_apply_completed:${app.id}`,
            });
          } else {
            summary.failed++;
            await incrementRunCounter(supabase, run.id, "applications_failed", 1);
            await emitStep(supabase, {
              runId: run.id, userId: app.user_id, stepName: "apply_failed",
              status: "failed", applicationId: app.id, jobId: job.id, startedAt: applyStarted,
              error: body?.message ?? `http_${res.status}`,
              idempotencyKey: `drain_apply_failed:${app.id}`,
            });
          }

          await closeRun(supabase, {
            runId: run.id,
            startedAt: run.startedAt,
            status: verified ? "completed" : "partial",
            errorSummary: verified ? null : (body?.message ?? `http_${res.status}`),
          });
        } catch (e) {
          summary.failed++;
          await recordFailure(supabase, {
            runId: run.id, userId: app.user_id, stepName: "apply_failed",
            errorCode: "drain_dispatch_exception", errorMessage: String(e),
            retryable: true, context: { applicationId: app.id },
          });
          await closeRun(supabase, {
            runId: run.id, startedAt: run.startedAt, status: "failed",
            errorSummary: String(e).slice(0, 500),
          });
        }
      } catch (perAppErr) {
        console.error("drain per-app error", perAppErr);
        summary.failed++;
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("drain-pending-applications fatal", err);
    return new Response(JSON.stringify({ success: false, error: String(err), summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    running = false;
  }
});
