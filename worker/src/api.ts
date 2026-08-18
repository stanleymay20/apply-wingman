// Thin client for the `browser-queue` edge function. The worker never talks to
// the database directly and never holds a service-role key — only BROWSER_WORKER_TOKEN.
import { log } from "./redact.js";
import type { AttemptResult, QueueItem } from "./types.js";

const FUNCTIONS_URL = requireEnv("SUPABASE_FUNCTIONS_URL").replace(/\/+$/, "");
const TOKEN = requireEnv("BROWSER_WORKER_TOKEN");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/browser-queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`browser-queue ${body.action} failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export async function claim(workerId: string, limit: number, leaseSeconds: number): Promise<QueueItem[]> {
  const data = await call<{ items: QueueItem[] }>({ action: "claim", workerId, limit, leaseSeconds });
  return data.items ?? [];
}

export async function heartbeat(queueId: string, workerId: string, leaseSeconds = 900): Promise<void> {
  try {
    await call({ action: "heartbeat", queueId, workerId, leaseSeconds });
  } catch (error) {
    log.warn("heartbeat failed", error);
  }
}

export async function report(queueId: string, workerId: string, result: AttemptResult): Promise<void> {
  const payload: Record<string, unknown> = { action: "report", queueId, workerId, outcome: result.outcome };
  if (result.outcome === "submitted") payload.proof = result.proof;
  if (result.outcome === "manual_action_required") {
    payload.manualReason = result.manualReason;
    payload.result = { detail: result.detail ?? null };
  }
  if (result.outcome === "failed") payload.error = result.error;
  await call(payload);
}
