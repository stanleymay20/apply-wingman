// Service-role endpoints for the external browser (Playwright) worker.
//
// Actions:
//   POST { action: "claim",  workerId, limit?, leaseSeconds? }
//   POST { action: "heartbeat", queueId, workerId, leaseSeconds? }
//   POST { action: "report", queueId, workerId, outcome, proof?, manualReason?, error? }
//   POST { action: "stats" }
//
// Auth: Authorization: Bearer <BROWSER_WORKER_TOKEN | SUPABASE_SERVICE_ROLE_KEY>.
// All operations are idempotent: reporting the same terminal outcome twice is a
// no-op, and claims are atomic (SKIP LOCKED) with lease expiry.
//
// TRUTHFULNESS RULE: an application is only marked "delivered" when the worker
// supplies submission proof. Opening or preparing a form is never a delivery.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MANUAL_ACTION_REASONS } from "../_shared/browserQueue.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hasProof(proof: unknown): proof is Record<string, unknown> {
  if (!proof || typeof proof !== "object") return false;
  const p = proof as Record<string, unknown>;
  const keys = ["confirmationText", "confirmationUrl", "externalApplicationId", "screenshotUrl"];
  return keys.some((k) => typeof p[k] === "string" && (p[k] as string).trim().length > 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const workerToken = Deno.env.get("BROWSER_WORKER_TOKEN");
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!bearer || (bearer !== serviceKey && (!workerToken || bearer !== workerToken))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(body.action || "");

  try {
    // ── claim ─────────────────────────────────────────────────────────────
    if (action === "claim") {
      const workerId = String(body.workerId || "").trim();
      if (!workerId) return json({ error: "workerId is required" }, 400);
      const limit = Math.min(Math.max(Number(body.limit) || 1, 1), 10);
      const leaseSeconds = Math.min(Math.max(Number(body.leaseSeconds) || 900, 60), 3600);

      const { data, error } = await supabase.rpc("claim_browser_applications", {
        p_worker_id: workerId,
        p_limit: limit,
        p_lease_seconds: leaseSeconds,
      });
      if (error) return json({ error: error.message }, 500);

      return json({ success: true, items: data ?? [] });
    }

    // ── heartbeat ─────────────────────────────────────────────────────────
    if (action === "heartbeat") {
      const queueId = String(body.queueId || "");
      const workerId = String(body.workerId || "");
      if (!queueId || !workerId) return json({ error: "queueId and workerId are required" }, 400);
      const leaseSeconds = Math.min(Math.max(Number(body.leaseSeconds) || 900, 60), 3600);

      const { data, error } = await supabase
        .from("browser_application_queue")
        .update({ lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString() })
        .eq("id", queueId)
        .eq("claimed_by", workerId)
        .eq("status", "claimed")
        .select("id")
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Lease not held by this worker" }, 409);
      return json({ success: true });
    }

    // ── report ────────────────────────────────────────────────────────────
    if (action === "report") {
      const queueId = String(body.queueId || "");
      const workerId = String(body.workerId || "");
      const outcome = String(body.outcome || "");
      if (!queueId || !workerId) return json({ error: "queueId and workerId are required" }, 400);
      if (!["submitted", "manual_action_required", "failed"].includes(outcome)) {
        return json({ error: "outcome must be submitted | manual_action_required | failed" }, 400);
      }

      const { data: row, error: rowError } = await supabase
        .from("browser_application_queue")
        .select("*")
        .eq("id", queueId)
        .maybeSingle();
      if (rowError) return json({ error: rowError.message }, 500);
      if (!row) return json({ error: "Queue item not found" }, 404);

      // Idempotent: already reported with the same outcome
      if (row.status === outcome && row.completed_at) {
        return json({ success: true, idempotent: true, status: row.status });
      }
      if (row.status === "submitted") {
        return json({ success: true, idempotent: true, status: "submitted" });
      }

      const nowIso = new Date().toISOString();
      let queueStatus = outcome;
      let applicationStatus = outcome;
      let manualReason: string | null = null;
      const proof = body.proof;

      if (outcome === "submitted") {
        if (!hasProof(proof)) {
          return json(
            {
              error:
                "Submission proof required (confirmationText, confirmationUrl, externalApplicationId or screenshotUrl)",
            },
            400,
          );
        }
        applicationStatus = "delivered";
      } else if (outcome === "manual_action_required") {
        manualReason = MANUAL_ACTION_REASONS.includes(String(body.manualReason) as never)
          ? String(body.manualReason)
          : "other";
      } else {
        // failed → retry while attempts remain
        if (row.attempts < row.max_attempts) {
          queueStatus = "queued";
          applicationStatus = "retrying";
        }
      }

      const { error: updateError } = await supabase
        .from("browser_application_queue")
        .update({
          status: queueStatus,
          manual_reason: manualReason,
          last_error: outcome === "failed" ? String(body.error || "worker reported failure") : null,
          result: (body.result as Record<string, unknown>) ?? null,
          proof: hasProof(proof) ? proof : null,
          claimed_by: workerId,
          lease_expires_at: null,
          completed_at: queueStatus === "queued" ? null : nowIso,
        })
        .eq("id", queueId);
      if (updateError) return json({ error: updateError.message }, 500);

      const appUpdate: Record<string, unknown> = {
        status: applicationStatus,
        updated_at: nowIso,
      };
      if (applicationStatus === "delivered") {
        const p = proof as Record<string, unknown>;
        appUpdate.applied_at = nowIso;
        appUpdate.delivery_verified_at = nowIso;
        appUpdate.delivery_provider = "browser_worker";
        appUpdate.delivery_provider_message_id =
          (p.externalApplicationId as string) || (p.confirmationUrl as string) || queueId;
        appUpdate.application_method = "form_submit";
        appUpdate.provider_context = { worker: workerId, proof: p };
      }
      if (applicationStatus === "manual_action_required") {
        appUpdate.error_code = manualReason;
        appUpdate.error_message = `Browser worker needs human input: ${manualReason}`;
      }
      if (outcome === "failed") {
        appUpdate.error_code = "browser_worker_failed";
        appUpdate.error_message = String(body.error || "worker reported failure").slice(0, 500);
        appUpdate.last_failure_at = nowIso;
      }

      await supabase.from("applications").update(appUpdate).eq("id", row.application_id);

      await supabase.from("application_logs").insert({
        user_id: row.user_id,
        application_id: row.application_id,
        job_id: row.job_id,
        action: `browser_worker_${outcome}`,
        level: outcome === "submitted" ? "success" : outcome === "failed" ? "error" : "warning",
        message:
          outcome === "submitted"
            ? "Browser worker submitted the application and returned proof"
            : outcome === "manual_action_required"
              ? `Browser worker stopped — manual action required (${manualReason})`
              : `Browser worker failed: ${String(body.error || "unknown")}`.slice(0, 500),
        details: { queueId, workerId, attempts: row.attempts, proof: hasProof(proof) ? proof : null },
      });

      return json({ success: true, status: queueStatus, applicationStatus });
    }

    // ── stats ─────────────────────────────────────────────────────────────
    if (action === "stats") {
      const { data, error } = await supabase
        .from("browser_application_queue")
        .select("status")
        .limit(5000);
      if (error) return json({ error: error.message }, 500);
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return json({ success: true, counts });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error("browser-queue error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
