import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { openRun, emitStep, closeRun, incrementRunCounter } from "../_shared/runLedger.ts";
import { loadRetryConfig, classifyError } from "../_shared/retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// In-isolate lock: prevents overlapping cron ticks within the same edge isolate.
let running = false;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (running) {
    return new Response(
      JSON.stringify({ ok: true, skipped: "already_running" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  running = true;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const summary = { picked: 0, attempted: 0, succeeded: 0, failed: 0, dead_lettered: 0, skipped: 0 };

  try {
    const cfg = await loadRetryConfig(supabase);
    const { data: batchSetting } = await supabase
      .from("system_settings").select("value").eq("key", "retry.batch_size").maybeSingle();
    const batchSize = Math.min(200, Math.max(1, Number(batchSetting?.value ?? 25)));

    const { data: due, error: dueErr } = await supabase
      .from("applications")
      .select("id, user_id, job_id, retry_count, max_retries, idempotency_key, application_method, cover_letter, original_recipient, actual_recipient")
      .eq("status", "retrying")
      .is("dead_lettered_at", null)
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(batchSize);

    if (dueErr) throw dueErr;
    summary.picked = due?.length ?? 0;

    for (const app of due ?? []) {
      const attemptNumber = (app.retry_count ?? 0) + 1;
      const maxRetries = app.max_retries ?? cfg.max_retries;

      // Hard guard: enforce dead-letter even if handleFailure missed it earlier.
      if (app.retry_count >= maxRetries) {
        await supabase.from("applications").update({
          status: "failed",
          dead_lettered_at: new Date().toISOString(),
          next_retry_at: null,
        }).eq("id", app.id);
        await supabase.from("application_logs").insert({
          user_id: app.user_id,
          application_id: app.id,
          action: "retry_dead_lettered",
          level: "error",
          message: "Retry count exceeded max; dead-lettered by worker guard.",
          details: { retry_count: app.retry_count, max_retries: maxRetries },
        });
        summary.dead_lettered++;
        continue;
      }

      // Open a retry run for proof.
      const run = await openRun(supabase, {
        userId: app.user_id,
        triggerType: "retry",
        executionSource: "process-retries",
        metadata: { application_id: app.id, attempt: attemptNumber },
      });
      if (!run) {
        summary.skipped++;
        continue;
      }

      const stepStart = Date.now();
      await emitStep(supabase, {
        runId: run.id,
        userId: app.user_id,
        applicationId: app.id,
        jobId: app.job_id,
        stepName: "retry_started",
        idempotencyKey: `retry:${app.id}:${attemptNumber}:start`,
        payload: { attempt: attemptNumber, idempotency_key: app.idempotency_key ?? null },
      });

      // Ensure stable idempotency key — same key blocks duplicate provider sends via unique index.
      const idemKey = app.idempotency_key ?? `app:${app.id}`;
      if (!app.idempotency_key) {
        await supabase.from("applications").update({ idempotency_key: idemKey }).eq("id", app.id);
      }

      // Fetch context needed to reinvoke auto-apply.
      const { data: full } = await supabase
        .from("applications")
        .select("id, user_id, job_id, cv_profile_id, application_method, cover_letter, original_recipient")
        .eq("id", app.id)
        .maybeSingle();
      const { data: job } = await supabase
        .from("jobs")
        .select("id, title, company, source_url, source_platform")
        .eq("id", app.job_id)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", app.user_id)
        .maybeSingle();

      if (!full || !job || !profile) {
        summary.skipped++;
        await emitStep(supabase, {
          runId: run.id,
          userId: app.user_id,
          applicationId: app.id,
          stepName: "retry_completed",
          status: "skipped",
          startedAt: stepStart,
          idempotencyKey: `retry:${app.id}:${attemptNumber}:done`,
          error: "Missing application/job/profile context",
        });
        await closeRun(supabase, { runId: run.id, startedAt: run.startedAt, status: "completed" });
        continue;
      }

      summary.attempted++;

      try {
        const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/auto-apply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "X-Retry-Attempt": String(attemptNumber),
            "X-Idempotency-Key": idemKey,
          },
          body: JSON.stringify({
            applicationId: app.id,
            jobId: job.id,
            method: full.application_method ?? "email",
            recipientEmail: full.original_recipient ?? null,
            userName: profile.full_name ?? "Applicant",
            userEmail: profile.email ?? "",
            coverLetter: full.cover_letter ?? "",
            jobTitle: job.title,
            company: job.company,
            sourceUrl: job.source_url,
            sourcePlatform: job.source_platform,
          }),
        });

        const result = await invokeRes.json().catch(() => ({}));
        const newStatus = (result?.status as string) ?? "failed";

        if (newStatus === "delivered" || newStatus === "submitted") {
          summary.succeeded++;
          await incrementRunCounter(supabase, run.id, "applications_succeeded", 1);
        } else {
          summary.failed++;
          await incrementRunCounter(supabase, run.id, "applications_failed", 1);
          if (attemptNumber >= maxRetries) summary.dead_lettered++;
        }

        await emitStep(supabase, {
          runId: run.id,
          userId: app.user_id,
          applicationId: app.id,
          stepName: "retry_completed",
          startedAt: stepStart,
          idempotencyKey: `retry:${app.id}:${attemptNumber}:done`,
          payload: { result_status: newStatus, http_status: invokeRes.status },
        });
      } catch (err: any) {
        const cls = classifyError(err?.message ?? "retry_invocation_failed");
        summary.failed++;
        await incrementRunCounter(supabase, run.id, "applications_failed", 1);
        await emitStep(supabase, {
          runId: run.id,
          userId: app.user_id,
          applicationId: app.id,
          stepName: "retry_completed",
          status: "failed",
          startedAt: stepStart,
          idempotencyKey: `retry:${app.id}:${attemptNumber}:done`,
          error: cls.normalized_message.slice(0, 500),
        });
        await supabase.from("automation_failures").insert({
          user_id: app.user_id,
          application_id: app.id,
          run_id: run.id,
          step_name: "retry_completed",
          error_code: cls.error_code,
          error_message: cls.normalized_message.slice(0, 1000),
          retryable: cls.retryable,
          retry_count: attemptNumber,
          dead_lettered: false,
          context: { from: "process-retries" },
        });
      }

      await incrementRunCounter(supabase, run.id, "applications_attempted", 1);
      await closeRun(supabase, { runId: run.id, startedAt: run.startedAt, status: "completed" });
    }

    return new Response(
      JSON.stringify({ ok: true, duration_ms: Date.now() - startedAt, ...summary, config: cfg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[process-retries] fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message ?? "unknown", duration_ms: Date.now() - startedAt, ...summary }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    running = false;
  }
});
