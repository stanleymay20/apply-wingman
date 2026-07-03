/**
 * Shared AI client — provider-agnostic chat completion wrapper.
 *
 * Priority order (first key found in env wins):
 *   1. LOCAL_LLM_BASE_URL + LOCAL_LLM_API_KEY → self-hosted OpenAI-compatible endpoint
 *   2. GROQ_API_KEY                          → Groq (fast open-source models)
 *   3. LOVABLE_API_KEY                       → Lovable AI Gateway
 *   4. OPENAI_API_KEY                        → OpenAI
 *   5. GOOGLE_API_KEY                        → Google Gemini API
 *
 * Override via env:
 *   AI_PROVIDER = "local" | "google" | "groq" | "openai" | "lovable"
 *   AI_MODEL    = model name override (e.g. "qwen2.5:14b", "gemini-2.0-flash")
 *   LOCAL_LLM_BASE_URL = public OpenAI-compatible base URL (for example https://llm.example.com/v1)
 *   LOCAL_LLM_API_KEY  = bearer token for the local endpoint gateway/proxy
 *
 * All providers use the OpenAI-compatible /v1/chat/completions format.
 *
 * Setup: configure secrets in Lovable Cloud. For a self-hosted model, expose it through a
 * protected OpenAI-compatible HTTPS endpoint; Lovable Cloud cannot call localhost/private LAN URLs.
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
  authMode?: "bearer" | "lovable";
  /** Map legacy Lovable model names to provider-native names */
  modelMap?: Record<string, string>;
}

function resolveProvider(): ProviderConfig {
  const explicit = Deno.env.get("AI_PROVIDER");

  const localBaseUrl = Deno.env.get("LOCAL_LLM_BASE_URL");
  const localApiKey = Deno.env.get("LOCAL_LLM_API_KEY");
  const google = Deno.env.get("GOOGLE_API_KEY");
  const groq = Deno.env.get("GROQ_API_KEY");
  const openai = Deno.env.get("OPENAI_API_KEY");
  const lovable = Deno.env.get("LOVABLE_API_KEY");

  if (explicit === "local" || (!explicit && localBaseUrl && localApiKey)) {
    if (!localBaseUrl) throw new Error("AI_PROVIDER=local but LOCAL_LLM_BASE_URL is not set");
    if (!localApiKey) throw new Error("AI_PROVIDER=local but LOCAL_LLM_API_KEY is not set");
    return {
      baseUrl: localBaseUrl.replace(/\/$/, ""),
      apiKey: localApiKey,
      defaultModel: Deno.env.get("AI_MODEL") ?? Deno.env.get("LOCAL_LLM_MODEL") ?? "qwen2.5:14b",
      authMode: "bearer",
      modelMap: {
        "google/gemini-2.5-flash": Deno.env.get("LOCAL_LLM_MODEL") ?? "qwen2.5:14b",
        "google/gemini-3-flash-preview": Deno.env.get("LOCAL_LLM_MODEL") ?? "qwen2.5:14b",
        "google/gemini-2.0-flash": Deno.env.get("LOCAL_LLM_MODEL") ?? "qwen2.5:14b",
        "gpt-4o-mini": Deno.env.get("LOCAL_LLM_MODEL") ?? "qwen2.5:14b",
      },
    };
  }

  if (explicit === "groq" || (!explicit && groq)) {
    if (!groq) throw new Error("AI_PROVIDER=groq but GROQ_API_KEY is not set");
    return {
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: groq,
      defaultModel: Deno.env.get("AI_MODEL") ?? "llama-3.3-70b-versatile",
      authMode: "bearer",
    };
  }

  if (explicit === "lovable" || (!explicit && lovable)) {
    if (!lovable) throw new Error("LOVABLE_API_KEY is not set");
    return {
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovable,
      defaultModel: Deno.env.get("AI_MODEL") ?? "google/gemini-2.5-flash",
      authMode: "lovable",
    };
  }

  if (explicit === "openai" || (!explicit && openai)) {
    if (!openai) throw new Error("AI_PROVIDER=openai but OPENAI_API_KEY is not set");
    return {
      baseUrl: "https://api.openai.com/v1",
      apiKey: openai,
      defaultModel: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
      authMode: "bearer",
    };
  }

  if (explicit === "google" || (!explicit && google)) {
    if (!google) throw new Error("AI_PROVIDER=google but GOOGLE_API_KEY is not set");
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: google,
      defaultModel: Deno.env.get("AI_MODEL") ?? "gemini-2.0-flash",
      authMode: "bearer",
      modelMap: {
        "google/gemini-2.5-flash": "gemini-2.5-flash",
        "google/gemini-3-flash-preview": "gemini-2.0-flash",
        "google/gemini-2.0-flash": "gemini-2.0-flash",
        "google/gemini-1.5-flash": "gemini-1.5-flash",
      },
    };
  }

  throw new Error(
    "No AI provider configured. Configure LOCAL_LLM_BASE_URL + LOCAL_LLM_API_KEY, LOVABLE_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY in Lovable Cloud secrets."
  );
}

/**
 * Call the configured AI provider and return the text content of the first choice.
 * Throws on HTTP error or empty response.
 */
export async function callAI(opts: CallAIOptions): Promise<string> {
  try {
    return await callAIWithProvider(resolveProvider(), opts);
  } catch (err) {
    // If the primary provider is rate-limited, fall back to the Lovable gateway.
    const lovable = Deno.env.get("LOVABLE_API_KEY");
    const isPrimaryLovable = Deno.env.get("AI_PROVIDER") === "lovable";
    if (err instanceof AIRateLimitError && lovable && !isPrimaryLovable) {
      console.log("[aiClient] primary provider rate-limited — falling back to Lovable gateway");
      return await callAIWithProvider(
        {
          baseUrl: "https://ai.gateway.lovable.dev/v1",
          apiKey: lovable,
          defaultModel: "google/gemini-2.5-flash",
          authMode: "lovable",
        },
        opts
      );
    }
    throw err;
  }
}

async function callAIWithProvider(provider: ProviderConfig, opts: CallAIOptions): Promise<string> {
  const { messages, temperature = 0.2, responseFormat, model, maxTokens } = opts;

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
      : Deno.env.get("AI_PROVIDER") === "local" ? "local"
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

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider.authMode === "lovable") {
    requestHeaders["Lovable-API-Key"] = provider.apiKey;
    requestHeaders["X-Lovable-AIG-SDK"] = "custom-edge-fetch";
  } else {
    requestHeaders.Authorization = `Bearer ${provider.apiKey}`;
  }

  // Retry on transient errors (429 rate limit, 5xx) with exponential backoff: 2s, 4s, 8s
  const backoffs = [2000, 4000, 8000];
  let res!: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    });

    if (res.ok) break;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < backoffs.length) {
      await res.body?.cancel();
      console.log(`[aiClient] ${res.status} — retrying in ${backoffs[attempt]}ms (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, backoffs[attempt]));
      continue;
    }

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
