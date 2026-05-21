import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { openRun, emitStep, closeRun, incrementCounter } from "../_shared/runLedger.ts";
import { loadRetryConfig, classifyError } from "../_shared/retry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// In-process lock: prevents two cron invocations from stomping on each other in the same isolate.
let running = false;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (running) {
    return new Response(JSON.stringify({ ok: true, skipped: "already_running" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  running = true;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = Date.now();
  const summary = { picked: 0, attempted: 0, succeeded: 0, failed: 0, dead_lettered: 0, skipped: 0 };

  try {
    const cfg = await loadRetryConfig(supabase);
    const { data: batchSettings } = await supabase
      .from("system_settings").select("value").eq("key", "retry.batch_size").maybeSingle();
    const batchSize = Math.min(200, Math.max(1, Number(batchSettings?.value ?? 25)));

    // Fetch due retries: status=retrying, not dead-lettered, next_retry_at <= now.
    const { data: due, error: dueErr } = await supabase
      .from("applications")
      .select("id, user_id, job_id, retry_count, max_retries, idempotency_key, status, dead_lettered_at")
      .eq("status", "retrying")
      .is("dead_lettered_at", null)
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(batchSize);

    if (dueErr) throw dueErr;
    summary.picked = due?.length ?? 0;

    for (const app of due ?? []) {
      if (app.retry_count >= (app.max_retries ?? cfg.max_retries)) {
        // Hard guard: should have been dead-lettered already; transition + skip.
        await supabase.from("applications").update({
          status: "failed",
          dead_lettered_at: new Date().toISOString(),
        }).eq("id", app.id);
        await supabase.from("application_logs").insert({
          user_id: app.user_id,
          application_id: app.id,
          action: "retry_dead_lettered",
          level: "error",
          message: "Retry count exceeded max; dead-lettered by worker guard.",
          details: { retry_count: app.retry_count, max_retries: app.max_retries },
        });
        summary.dead_lettered++;
        continue;
      }

      // Open a per-application run so we capture proof of the retry attempt.
      const run = await openRun(supabase, {
        userId: app.user_id,
        triggerType: "retry",
        executionSource: "process-retries",
        metadata: { application_id: app.id },
      });

      const stepStart = Date.now();
      const stepId = await emitStep(supabase, {
        runId: run?.id,
        userId: app.user_id,
        applicationId: app.id,
        stepName: "retry_started",
        status: "running",
        idempotencyKey: `retry:${app.id}:${app.retry_count + 1}`,
        payload: { retry_count: app.retry_count + 1, idempotency_key: app.idempotency_key ?? null },
      });

      // Fetch the full row to reconstruct the apply request.
      const { data: full } = await supabase
        .from("applications")
        .select(`
          id, user_id, job_id, cv_profile_id, application_method, cover_letter,
          original_recipient, actual_recipient, idempotency_key,
          job:jobs(id, title, company, source_url, source_platform),
          profile:profiles!inner(full_name, email)
        `)
        .eq("id", app.id)
        .maybeSingle();

      if (!full?.job) {
        summary.skipped++;
        await emitStep(supabase, {
          runId: run?.id,
          userId: app.user_id,
          applicationId: app.id,
          stepName: "retry_completed",
          status: "skipped",
          idempotencyKey: `retry:${app.id}:${app.retry_count + 1}:done`,
          error: "Missing job context",
          durationMs: Date.now() - stepStart,
        });
        if (run?.id) await closeRun(supabase, { runId: run.id, status: "completed" });
        continue;
      }

      // Ensure stable idempotency key — generated from app id + retry attempt so
      // any duplicate worker tick attempting the same retry hits the unique index.
      const idemKey = full.idempotency_key ?? `app:${app.id}`;
      if (!full.idempotency_key) {
        await supabase.from("applications").update({ idempotency_key: idemKey }).eq("id", app.id);
      }

      summary.attempted++;

      try {
        // Re-invoke auto-apply with the original payload.
        const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/auto-apply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "X-Retry-Attempt": String(app.retry_count + 1),
            "X-Idempotency-Key": idemKey,
          },
          body: JSON.stringify({
            applicationId: app.id,
            jobId: full.job.id,
            method: full.application_method ?? "email",
            recipientEmail: (full as any).original_recipient ?? null,
            userName: (full as any).profile?.full_name ?? "Applicant",
            userEmail: (full as any).profile?.email ?? "",
            coverLetter: full.cover_letter ?? "",
            jobTitle: full.job.title,
            company: full.job.company,
            sourceUrl: full.job.source_url,
            sourcePlatform: full.job.source_platform,
          }),
        });

        const result = await invokeRes.json().catch(() => ({}));
        const newStatus = (result?.status as string) ?? "failed";

        if (newStatus === "delivered" || newStatus === "submitted") {
          summary.succeeded++;
        } else if (newStatus === "failed") {
          summary.failed++;
          if (app.retry_count + 1 >= (app.max_retries ?? cfg.max_retries)) summary.dead_lettered++;
        }

        await emitStep(supabase, {
          runId: run?.id,
          userId: app.user_id,
          applicationId: app.id,
          stepName: "retry_completed",
          status: "completed",
          idempotencyKey: `retry:${app.id}:${app.retry_count + 1}:done`,
          payload: { result_status: newStatus, http_status: invokeRes.status },
          durationMs: Date.now() - stepStart,
        });
      } catch (err: any) {
        const cls = classifyError(err?.message ?? "retry_invocation_failed");
        summary.failed++;
        await emitStep(supabase, {
          runId: run?.id,
          userId: app.user_id,
          applicationId: app.id,
          stepName: "retry_completed",
          status: "failed",
          idempotencyKey: `retry:${app.id}:${app.retry_count + 1}:done`,
          error: cls.normalized_message.slice(0, 500),
          durationMs: Date.now() - stepStart,
        });
        await supabase.from("automation_failures").insert({
          user_id: app.user_id,
          application_id: app.id,
          run_id: run?.id ?? null,
          step_id: stepId ?? null,
          step_name: "retry_completed",
          error_code: cls.error_code,
          error_message: cls.normalized_message.slice(0, 1000),
          retryable: cls.retryable,
          retry_count: app.retry_count + 1,
          dead_lettered: false,
          context: { from: "process-retries" },
        });
      }

      if (run?.id) {
        await closeRun(supabase, { runId: run.id, status: "completed" });
        await incrementCounter(supabase, run.id, "applications_attempted", 1);
      }
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
