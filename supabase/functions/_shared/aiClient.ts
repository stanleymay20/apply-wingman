/**
 * Shared AI client — provider-agnostic chat completion wrapper.
 *
 * Priority order (first key found in env wins):
 *   1. GOOGLE_API_KEY  → Google Gemini API (free tier: 1 500 req/day, 1 M tokens/day)
 *   2. GROQ_API_KEY    → Groq (fast open-source models, free tier)
 *   3. OPENAI_API_KEY  → OpenAI
 *   4. LOVABLE_API_KEY → Legacy Lovable gateway (deprecated; use Google instead)
 *
 * Override via env:
 *   AI_PROVIDER = "google" | "groq" | "openai" | "lovable"
 *   AI_MODEL    = model name override (e.g. "gemini-2.0-flash")
 *
 * All providers use the OpenAI-compatible /v1/chat/completions format.
 *
 * Setup (Supabase dashboard → Project Settings → Edge Functions → Secrets):
 *   GOOGLE_API_KEY = <from https://aistudio.google.com/app/apikey — free>
 */

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

export interface CallAIOptions {
  messages: ChatMessage[];
  /** Temperature 0-1. Default: 0.2 */
  temperature?: number;
  /** Pass "json" to enable JSON-object response format. */
  responseFormat?: "json" | "text";
  /** Model override — uses provider default if omitted. */
  model?: string;
  /** Max output tokens. */
  maxTokens?: number;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  /** Map legacy Lovable model names to provider-native names */
  modelMap?: Record<string, string>;
}

function resolveProvider(): ProviderConfig {
  const explicit = Deno.env.get("AI_PROVIDER");

  const google = Deno.env.get("GOOGLE_API_KEY");
  const groq = Deno.env.get("GROQ_API_KEY");
  const openai = Deno.env.get("OPENAI_API_KEY");
  const lovable = Deno.env.get("LOVABLE_API_KEY");

  if (explicit === "google" || (!explicit && google)) {
    if (!google) throw new Error("AI_PROVIDER=google but GOOGLE_API_KEY is not set");
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: google,
      defaultModel: Deno.env.get("AI_MODEL") ?? "gemini-2.0-flash",
      modelMap: {
        "google/gemini-2.5-flash": "gemini-2.5-flash",
        "google/gemini-3-flash-preview": "gemini-2.0-flash",
        "google/gemini-2.0-flash": "gemini-2.0-flash",
        "google/gemini-1.5-flash": "gemini-1.5-flash",
      },
    };
  }

  if (explicit === "groq" || (!explicit && groq)) {
    if (!groq) throw new Error("AI_PROVIDER=groq but GROQ_API_KEY is not set");
    return {
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      defaultModel: Deno.env.get("AI_MODEL") ?? "llama-3.3-70b-versatile",
    };
  }

  if (explicit === "openai" || (!explicit && openai)) {
    if (!openai) throw new Error("AI_PROVIDER=openai but OPENAI_API_KEY is not set");
    return {
      baseUrl: "https://api.openai.com/v1",
      apiKey: openai,
      defaultModel: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
    };
  }

  if (explicit === "lovable" || (!explicit && lovable)) {
    if (!lovable) throw new Error("LOVABLE_API_KEY is not set");
    return {
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovable,
      defaultModel: Deno.env.get("AI_MODEL") ?? "google/gemini-2.5-flash",
    };
  }

  throw new Error(
    "No AI provider configured. Set GOOGLE_API_KEY (free) in Supabase Edge Function secrets. " +
      "Get one at https://aistudio.google.com/app/apikey"
  );
}

/**
 * Call the configured AI provider and return the text content of the first choice.
 * Throws on HTTP error or empty response.
 */
export async function callAI(opts: CallAIOptions): Promise<string> {
  const { messages, temperature = 0.2, responseFormat, model, maxTokens } = opts;
  const provider = resolveProvider();

  const resolvedModel =
    model
      ? (provider.modelMap?.[model] ?? model)
      : provider.defaultModel;

  // Safe diagnostics — NO keys, NO request content. Hostname only.
  let baseHost = "unknown";
  try {
    baseHost = new URL(provider.baseUrl).hostname;
  } catch {
    // ignore malformed base url
  }
  const providerName =
    baseHost.includes("googleapis") ? "google"
      : baseHost.includes("groq") ? "groq"
      : baseHost.includes("openai") ? "openai"
      : baseHost.includes("gateway.lovable") ? "lovable"
      : "custom";
  console.log(
    `[aiClient] provider=${providerName} host=${baseHost} model=${resolvedModel} explicitProvider=${Deno.env.get("AI_PROVIDER") ?? "(unset)"}`
  );

  const body: Record<string, unknown> = {
    model: resolvedModel,
    messages,
    temperature,
  };

  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  if (maxTokens) {
    body.max_tokens = maxTokens;
  }

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new AIRateLimitError(text);
    if (res.status === 402) throw new AICreditsError(text);
    throw new AIError(`AI API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new AIError("AI returned empty response");
  return content;
}

/** Convenience: call AI and parse the response as JSON. Strips markdown fences if present. */
export async function callAIJson<T = unknown>(opts: CallAIOptions): Promise<T> {
  const raw = await callAI({ ...opts, responseFormat: "json" });
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new AIError(`AI returned invalid JSON: ${stripped.slice(0, 200)}`);
  }
}

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

export class AIRateLimitError extends AIError {
  constructor(detail?: string) {
    super(`AI rate limit exceeded${detail ? `: ${detail.slice(0, 100)}` : ""}`);
    this.name = "AIRateLimitError";
  }
}

export class AICreditsError extends AIError {
  constructor(detail?: string) {
    super(`AI credits exhausted${detail ? `: ${detail.slice(0, 100)}` : ""}`);
    this.name = "AICreditsError";
  }
}
