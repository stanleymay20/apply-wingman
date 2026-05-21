// Shared retry classification + backoff helpers.
// Single source of truth for "is this failure retryable?" and "when next?".
// deno-lint-ignore-file no-explicit-any

export type RetryReason =
  | "timeout"
  | "rate_limited"
  | "provider_5xx"
  | "network"
  | "unverified_provider_response"
  | "invalid_recipient"
  | "auth_failure"
  | "missing_config"
  | "blocked_by_policy"
  | "malformed_payload"
  | "unknown_terminal"
  | "unknown_transient";

export interface ClassifiedError {
  retryable: boolean;
  error_code: string;       // stable machine code
  retry_reason: RetryReason;
  normalized_message: string;
}

// Code-level immutable safety caps — system_settings can never exceed these.
export const RETRY_SAFETY = {
  MIN_BASE_DELAY_S: 1,
  MAX_BASE_DELAY_S: 300,
  MIN_MULTIPLIER: 1.5,
  MAX_MULTIPLIER: 5,
  MIN_MAX_DELAY_S: 60,
  MAX_MAX_DELAY_S: 24 * 3600,
  MIN_JITTER_S: 0,
  MAX_JITTER_S: 600,
  ABSOLUTE_MAX_RETRIES: 20,
};

export function classifyError(message: string | null | undefined, providerStatus?: number): ClassifiedError {
  const raw = (message ?? "").trim();
  const m = raw.toLowerCase();

  // Provider HTTP status takes precedence when present.
  if (providerStatus) {
    if (providerStatus === 429) {
      return { retryable: true, error_code: "rate_limited", retry_reason: "rate_limited", normalized_message: raw || "Rate limited" };
    }
    if (providerStatus >= 500 && providerStatus < 600) {
      return { retryable: true, error_code: `provider_${providerStatus}`, retry_reason: "provider_5xx", normalized_message: raw };
    }
    if (providerStatus === 401 || providerStatus === 403) {
      return { retryable: false, error_code: "auth_failure", retry_reason: "auth_failure", normalized_message: raw };
    }
    if (providerStatus === 422 || providerStatus === 400) {
      return { retryable: false, error_code: "malformed_payload", retry_reason: "malformed_payload", normalized_message: raw };
    }
    if (providerStatus === 404) {
      return { retryable: false, error_code: "invalid_recipient", retry_reason: "invalid_recipient", normalized_message: raw };
    }
  }

  if (!m) {
    return { retryable: false, error_code: "unknown", retry_reason: "unknown_terminal", normalized_message: raw };
  }

  // Terminal patterns (do not retry).
  if (m.includes("missing") && (m.includes("api key") || m.includes("config") || m.includes("resend"))) {
    return { retryable: false, error_code: "missing_config", retry_reason: "missing_config", normalized_message: raw };
  }
  if (m.includes("domain is not verified") || m.includes("domain not verified")) {
    return { retryable: false, error_code: "domain_unverified", retry_reason: "missing_config", normalized_message: raw };
  }
  if (m.includes("invalid") && (m.includes("recipient") || m.includes("email") || m.includes("address"))) {
    return { retryable: false, error_code: "invalid_recipient", retry_reason: "invalid_recipient", normalized_message: raw };
  }
  if (m.includes("unauthorized") || m.includes("forbidden") || /\b40[13]\b/.test(m)) {
    return { retryable: false, error_code: "auth_failure", retry_reason: "auth_failure", normalized_message: raw };
  }
  if (m.includes("blocked") || m.includes("policy") || m.includes("blacklist")) {
    return { retryable: false, error_code: "blocked_by_policy", retry_reason: "blocked_by_policy", normalized_message: raw };
  }
  if (m.includes("validation") || m.includes("bad request") || /\b400\b/.test(m)) {
    return { retryable: false, error_code: "malformed_payload", retry_reason: "malformed_payload", normalized_message: raw };
  }

  // Retryable patterns.
  if (m.includes("timeout") || m.includes("timed out")) {
    return { retryable: true, error_code: "timeout", retry_reason: "timeout", normalized_message: raw };
  }
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests")) {
    return { retryable: true, error_code: "rate_limited", retry_reason: "rate_limited", normalized_message: raw };
  }
  if (/\b5\d{2}\b/.test(m) || m.includes("temporarily") || m.includes("temporary")) {
    return { retryable: true, error_code: "provider_5xx", retry_reason: "provider_5xx", normalized_message: raw };
  }
  if (m.includes("network") || m.includes("fetch failed") || m.includes("econn") || m.includes("socket")) {
    return { retryable: true, error_code: "network", retry_reason: "network", normalized_message: raw };
  }

  return { retryable: false, error_code: "unknown", retry_reason: "unknown_terminal", normalized_message: raw };
}

export interface RetryConfig {
  base_delay_seconds: number;
  multiplier: number;
  max_delay_seconds: number;
  jitter_seconds: number;
  max_retries: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  base_delay_seconds: 2,
  multiplier: 2,
  max_delay_seconds: 3600,
  jitter_seconds: 15,
  max_retries: 5,
};

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function clampConfig(cfg: RetryConfig): RetryConfig {
  return {
    base_delay_seconds: clamp(cfg.base_delay_seconds, RETRY_SAFETY.MIN_BASE_DELAY_S, RETRY_SAFETY.MAX_BASE_DELAY_S),
    multiplier:         clamp(cfg.multiplier,         RETRY_SAFETY.MIN_MULTIPLIER,   RETRY_SAFETY.MAX_MULTIPLIER),
    max_delay_seconds:  clamp(cfg.max_delay_seconds,  RETRY_SAFETY.MIN_MAX_DELAY_S,  RETRY_SAFETY.MAX_MAX_DELAY_S),
    jitter_seconds:     clamp(cfg.jitter_seconds,     RETRY_SAFETY.MIN_JITTER_S,     RETRY_SAFETY.MAX_JITTER_S),
    max_retries:        clamp(cfg.max_retries, 1, RETRY_SAFETY.ABSOLUTE_MAX_RETRIES),
  };
}

export async function loadRetryConfig(supabase: any): Promise<RetryConfig> {
  try {
    const keys = [
      "retry.base_delay_seconds", "retry.multiplier", "retry.max_delay_seconds",
      "retry.jitter_seconds", "retry.max_retries",
    ];
    const { data } = await supabase.from("system_settings").select("key,value").in("key", keys);
    const map = new Map<string, any>((data ?? []).map((r: any) => [r.key, r.value]));
    const cfg: RetryConfig = {
      base_delay_seconds: Number(map.get("retry.base_delay_seconds") ?? DEFAULT_RETRY_CONFIG.base_delay_seconds),
      multiplier:         Number(map.get("retry.multiplier")         ?? DEFAULT_RETRY_CONFIG.multiplier),
      max_delay_seconds:  Number(map.get("retry.max_delay_seconds")  ?? DEFAULT_RETRY_CONFIG.max_delay_seconds),
      jitter_seconds:     Number(map.get("retry.jitter_seconds")     ?? DEFAULT_RETRY_CONFIG.jitter_seconds),
      max_retries:        Number(map.get("retry.max_retries")        ?? DEFAULT_RETRY_CONFIG.max_retries),
    };
    return clampConfig(cfg);
  } catch {
    return clampConfig(DEFAULT_RETRY_CONFIG);
  }
}

/** Compute next_retry_at given attempt index (0-based: 0 = first retry). */
export function computeNextRetryAt(attempt: number, cfg: RetryConfig, now: Date = new Date()): Date {
  const exp = cfg.base_delay_seconds * Math.pow(cfg.multiplier, Math.max(0, attempt));
  const capped = Math.min(exp, cfg.max_delay_seconds);
  const jitter = (Math.random() * 2 - 1) * cfg.jitter_seconds; // ± jitter
  const delayMs = Math.max(1000, Math.round((capped + jitter) * 1000));
  return new Date(now.getTime() + delayMs);
}
