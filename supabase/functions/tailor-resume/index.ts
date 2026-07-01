import { callAI, callAIJson, AIRateLimitError, AICreditsError } from "../_shared/aiClient.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cvProfile, job } = await req.json();

    if (!cvProfile || !job) {
      return new Response(JSON.stringify({ error: "cvProfile and job are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert resume writer. Your task is to tailor a candidate's resume to a specific job description to maximize ATS compatibility and relevance.

Rules:
- Rewrite the summary to directly address the role and company
- Reorder and rewrite work experience bullets to emphasize skills/achievements matching the job
- Use keywords from the job description naturally throughout
- Quantify achievements where possible (add placeholders like [X%] if metrics are missing)
- Strengthen action verbs (replace weak verbs like "helped", "worked on" with strong ones like "drove", "architected", "delivered")
- Do NOT fabricate experience, companies, or dates
- Keep the same overall structure but optimize wording
- Return a JSON object with:
  {
    "tailored_summary": "...",
    "tailored_cv_text": "full tailored resume text",
    "key_changes": ["change 1", "change 2", ...],
    "keywords_added": ["keyword1", "keyword2", ...]
  }`;

    const userPrompt = `Tailor this resume for the following job:

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description || "Not provided"}
Requirements: ${Array.isArray(job.requirements) ? job.requirements.join(", ") : job.requirements || "Not specified"}

CANDIDATE RESUME:
Summary: ${cvProfile.summary || "Not provided"}
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years (${cvProfile.seniority_level || "unspecified"} level)
Work History:
${
  (cvProfile.work_history || [])
    .map(
      (w: { title: string; company: string; duration?: string; responsibilities?: string[] }) =>
        `- ${w.title} at ${w.company}${w.duration ? ` (${w.duration})` : ""}\n  ${(w.responsibilities || []).join("\n  ")}`
    )
    .join("\n") || "Not provided"
}

Full CV Text:
${cvProfile.cv_text || "Not provided"}`;

    let result: Record<string, unknown>;
    try {
      result = await callAIJson({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      });
    } catch (e) {
      if (e instanceof AIRateLimitError) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e instanceof AICreditsError) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Set GOOGLE_API_KEY in Supabase secrets." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in tailor-resume function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
