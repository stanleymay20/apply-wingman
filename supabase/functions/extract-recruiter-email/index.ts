// Extracts or infers a recruiter/HR email for a job and persists it to jobs.recruiter_email.
// Strategy (in priority order):
//   1. Regex-scan job description for any email address
//   2. Ask AI to identify a recruiter email or infer one from company domain
// Confidence levels: "extracted" (found in text) | "inferred" (AI-guessed from domain)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Common HR/recruiting email local-parts (most likely to be valid)
const HR_PATTERNS = ["careers", "jobs", "recruiting", "talent", "hr", "hiring", "apply", "people"];

function extractFromText(text: string): string | null {
  const matches = text.match(EMAIL_REGEX) || [];
  // Filter out obviously non-recruiter emails (noreply, support, info, etc.)
  const skipParts = ["noreply", "no-reply", "support", "info@", "contact@", "legal@", "press@", "security@"];
  const candidates = matches.filter(
    (e) => !skipParts.some((s) => e.toLowerCase().includes(s))
  );
  if (!candidates.length) return null;
  // Prefer emails with HR-sounding local-parts
  const preferred = candidates.find((e) =>
    HR_PATTERNS.some((p) => e.toLowerCase().startsWith(p))
  );
  return preferred || candidates[0];
}

function domainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Strip www. and common ATS subdomains (boards.greenhouse.io → company name unclear, skip)
    const hostname = parsed.hostname.replace(/^www\./, "");
    const atsDomains = ["greenhouse.io", "lever.co", "workday.com", "smartrecruiters.com",
      "linkedin.com", "indeed.com", "glassdoor.com", "ziprecruiter.com"];
    if (atsDomains.some((d) => hostname.endsWith(d))) return null;
    return hostname;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, title, company, source_url, description")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: regex scan description ──────────────────────────────────
    const fromDescription = job.description ? extractFromText(job.description) : null;
    if (fromDescription) {
      await supabase.from("jobs").update({
        recruiter_email: fromDescription,
        recruiter_email_confidence: "extracted",
        recruiter_email_extracted_at: new Date().toISOString(),
      }).eq("id", jobId);
      return new Response(
        JSON.stringify({ success: true, email: fromDescription, confidence: "extracted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: AI domain inference ──────────────────────────────────────
    const domain = domainFromUrl(job.source_url || "");

    const prompt = `A job seeker wants to send an email application for this position:
Job Title: ${job.title}
Company: ${job.company}
Source URL: ${job.source_url || "unknown"}
Company domain (if extractable): ${domain || "unknown"}
Job description excerpt: ${(job.description || "").slice(0, 800)}

Task: Return the single most likely recruiter or HR email address for this company.
- If the company domain is known, suggest the most probable format (e.g. careers@${domain || "company.com"})
- Use common patterns: careers@, jobs@, recruiting@, talent@, hr@, hiring@, people@
- Do NOT invent a specific person's email — use a role-based address
- If you cannot make a reasonable guess, return null

Return JSON only: { "email": "careers@company.com" } or { "email": null }`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      return new Response(
        JSON.stringify({ success: false, email: null, confidence: "none", reason: "AI unavailable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content;
    let inferredEmail: string | null = null;
    try {
      const parsed = JSON.parse(content || "{}");
      if (parsed.email && EMAIL_REGEX.test(parsed.email)) {
        inferredEmail = parsed.email;
      }
    } catch { /* ignore */ }

    if (inferredEmail) {
      await supabase.from("jobs").update({
        recruiter_email: inferredEmail,
        recruiter_email_confidence: "inferred",
        recruiter_email_extracted_at: new Date().toISOString(),
      }).eq("id", jobId);
      return new Response(
        JSON.stringify({ success: true, email: inferredEmail, confidence: "inferred" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as attempted so we don't re-run on every cycle
    await supabase.from("jobs").update({
      recruiter_email_confidence: "none",
      recruiter_email_extracted_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(
      JSON.stringify({ success: false, email: null, confidence: "none" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("extract-recruiter-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
