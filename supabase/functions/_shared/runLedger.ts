// Shared automation run ledger helpers.
// Used by scheduled-automation, auto-apply, etc. to emit structured, durable
// execution-proof events. All writes go through the service role.
//
// Canonical step names (must match public.automation_step_name enum):
//   discover_started, discover_completed
//   match_started, match_completed
//   apply_started, apply_completed, apply_failed
//   cooldown_skipped
//   retry_started, retry_completed

// deno-lint-ignore-file no-explicit-any

export const WORKER_VERSION = "ledger-v1.0.0";

export type StepName =
  | "discover_started" | "discover_completed"
  | "match_started" | "match_completed"
  | "apply_started" | "apply_completed" | "apply_failed"
  | "cooldown_skipped"
  | "retry_started" | "retry_completed";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface OpenRunParams {
  userId: string;
  triggerType: "cron" | "manual" | "retry" | "webhook";
  executionSource?: string;
  environment?: string;
  initiatedBy?: string | null;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenedRun {
  id: string;
  correlationId: string;
  startedAt: number;
}

export async function openRun(supabase: any, params: OpenRunParams): Promise<OpenedRun | null> {
  const correlationId = params.correlationId ?? crypto.randomUUID();
  const startedAt = Date.now();
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      user_id: params.userId,
      trigger_type: params.triggerType,
      execution_source: params.executionSource ?? params.triggerType,
      worker_version: WORKER_VERSION,
      environment: params.environment ?? (Deno.env.get("ENVIRONMENT") ?? "production"),
      initiated_by: params.initiatedBy ?? null,
      correlation_id: correlationId,
      status: "running",
      metadata: params.metadata ?? {},
    })
    .select("id, correlation_id")
    .single();

  if (error || !data) {
    console.error("[runLedger] openRun failed:", error?.message);
    return null;
  }
  return { id: data.id, correlationId: data.correlation_id, startedAt };
}

export interface EmitStepParams {
  runId: string;
  userId: string;
  stepName: StepName;
  status?: StepStatus;
  applicationId?: string | null;
  jobId?: string | null;
  payload?: Record<string, unknown>;
  error?: string | null;
  /**
   * Idempotency key — defaults to `${stepName}:${jobId|appId|random}`.
   * Duplicate (run_id, idempotency_key) writes are silently ignored at DB level.
   */
  idempotencyKey?: string;
  startedAt?: number; // ms timestamp; used to compute duration when status is terminal
}

export async function emitStep(supabase: any, p: EmitStepParams): Promise<void> {
  const status = p.status ?? (p.stepName.endsWith("_started") ? "running" : "completed");
  const now = Date.now();
  const completedAt = (status === "completed" || status === "failed" || status === "skipped") ? new Date(now).toISOString() : null;
  const durationMs = (p.startedAt && completedAt) ? Math.max(0, now - p.startedAt) : null;
  const idempotencyKey = p.idempotencyKey
    ?? `${p.stepName}:${p.applicationId ?? p.jobId ?? crypto.randomUUID()}`;

  const { error } = await supabase
    .from("automation_run_steps")
    .insert({
      run_id: p.runId,
      user_id: p.userId,
      step_name: p.stepName,
      status,
      application_id: p.applicationId ?? null,
      job_id: p.jobId ?? null,
      completed_at: completedAt,
      duration_ms: durationMs,
      payload: p.payload ?? {},
      error: p.error ?? null,
      idempotency_key: idempotencyKey,
    });

  // Unique-constraint violations on (run_id, idempotency_key) are expected → swallow.
  if (error && !String(error.message ?? "").toLowerCase().includes("duplicate key")) {
    console.error(`[runLedger] emitStep(${p.stepName}) failed:`, error.message);
  }
}

export async function incrementRunCounter(
  supabase: any,
  runId: string,
  field: "jobs_discovered" | "jobs_matched" | "applications_attempted" | "applications_succeeded" | "applications_failed",
  delta = 1,
): Promise<void> {
  // Service role can call this directly; the RPC is restricted from anon/auth.
  const { error } = await supabase.rpc("increment_run_counter", {
    p_run_id: runId,
    p_field: field,
    p_delta: delta,
  });
  if (error) console.error(`[runLedger] incrementRunCounter(${field})`, error.message);
}

export interface CloseRunParams {
  runId: string;
  startedAt: number;
  status: "completed" | "partial" | "failed" | "cancelled";
  errorSummary?: string | null;
}

export async function closeRun(supabase: any, p: CloseRunParams): Promise<void> {
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - p.startedAt;
  const { error } = await supabase
    .from("automation_runs")
    .update({
      completed_at: completedAt,
      duration_ms: durationMs,
      status: p.status,
      error_summary: p.errorSummary ?? null,
      updated_at: completedAt,
    })
    .eq("id", p.runId);
  if (error) console.error("[runLedger] closeRun failed:", error.message);
}

export async function recordFailure(
  supabase: any,
  params: {
    runId?: string | null;
    stepId?: string | null;
    userId: string;
    applicationId?: string | null;
    stepName?: StepName;
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
    retryCount?: number;
    deadLettered?: boolean;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("automation_failures").insert({
    run_id: params.runId ?? null,
    step_id: params.stepId ?? null,
    user_id: params.userId,
    application_id: params.applicationId ?? null,
    step_name: params.stepName ?? null,
    error_code: params.errorCode,
    error_message: params.errorMessage,
    retryable: params.retryable,
    retry_count: params.retryCount ?? 0,
    dead_lettered: params.deadLettered ?? false,
    context: params.context ?? {},
  });
  if (error) console.error("[runLedger] recordFailure failed:", error.message);
}
