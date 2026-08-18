// Log redaction. The worker handles real candidate PII and a bearer token —
// none of it may ever reach stdout, a log file, or the queue's error fields.

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const LONG_TOKEN = /\b[A-Za-z0-9._-]{40,}\b/g;

export function redact(input: unknown): string {
  let text = typeof input === "string" ? input : safeStringify(input);
  text = text
    .replace(BEARER, "Bearer [redacted]")
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[phone]")
    .replace(LONG_TOKEN, "[token]");
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export const log = {
  info: (msg: string, meta?: unknown) =>
    console.log(`[worker] ${redact(msg)}${meta ? ` ${redact(meta)}` : ""}`),
  warn: (msg: string, meta?: unknown) =>
    console.warn(`[worker] ${redact(msg)}${meta ? ` ${redact(meta)}` : ""}`),
  error: (msg: string, meta?: unknown) =>
    console.error(`[worker] ${redact(msg)}${meta ? ` ${redact(meta)}` : ""}`),
};
