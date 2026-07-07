import { callAI, callAIJson, AIRateLimitError, AICreditsError, preflightAI, AIError } from "../_shared/aiClient.ts";
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
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cvText, skills, experience_years, seniority_level } = await req.json();

    
    if (!cvText || cvText.length < 100) {
      return new Response(
        JSON.stringify({ error: "CV text is required (minimum 100 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI health preflight — bail early if no provider is configured at all.
    try {
      await preflightAI();
    } catch (e) {
      if (e instanceof AIError) {
        return new Response(
          JSON.stringify({ success: false, unavailable: true, code: "AI_NOT_CONFIGURED", error: e.message, retryable: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }


    const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyzer and resume reviewer. Analyze the provided resume/CV and return ONLY valid JSON with this exact structure:
{
  "score": <number 0-100, ATS compatibility score>,
  "suggestions": [
    { "category": "formatting|keywords|structure|content|length", "priority": "high|medium|low", "suggestion": "..." }
  ],
  "strengths": ["strength1", "strength2"],
  "missing_elements": ["missing1", "missing2"],
  "keyword_density": "poor|fair|good|excellent"
}`;

    const userPrompt = `Analyze this resume/CV for ATS compatibility:

${cvText}

${skills?.length ? `Extracted Skills: ${skills.join(", ")}` : ""}
${experience_years ? `Years of Experience: ${experience_years}` : ""}
${seniority_level ? `Seniority Level: ${seniority_level}` : ""}

Return only valid JSON, no markdown.`;

    let result: unknown;
    try {
      result = await callAIJson({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      });
    } catch (e) {
      if (e instanceof AIRateLimitError) {
        return new Response(
          JSON.stringify({
            success: false,
            unavailable: true,
            code: "AI_RATE_LIMITED",
            error: "AI scoring is temporarily rate limited. Please try again later.",
            retryable: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (e instanceof AICreditsError) {
        return new Response(
          JSON.stringify({
            success: false,
            unavailable: true,
            code: "AI_CREDITS_EXHAUSTED",
            error: "AI scoring is temporarily unavailable because AI quota is exhausted.",
            retryable: false,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Score resume error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
