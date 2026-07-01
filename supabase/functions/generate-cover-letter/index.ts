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
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    const { job, cvProfile, style = "professional" } = await req.json();

    if (!job || !cvProfile) {
      return new Response(JSON.stringify({ error: "Job and CV profile required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const styleGuide = {
      professional: "Write in a formal, professional tone suitable for corporate environments.",
      modern: "Write in a contemporary, dynamic tone that shows personality while remaining professional.",
      technical: "Emphasize technical skills and achievements with specific metrics and technologies.",
      creative: "Use a more creative and engaging tone while highlighting relevant experience.",
    };

    const systemPrompt = `You are an expert cover letter writer. Create a compelling, personalized cover letter for the candidate applying to the specified job.

${styleGuide[style as keyof typeof styleGuide] || styleGuide.professional}

Guidelines:
- Keep it concise (250-350 words)
- Highlight relevant skills and experience that match the job requirements
- Show enthusiasm for the role and company
- Include a strong opening hook
- End with a clear call to action
- Do not use clichés or generic phrases
- Make it specific to both the job and candidate

Return ONLY the cover letter text, no additional formatting or explanation.`;

    const userPrompt = `Create a cover letter for this application:

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Description: ${job.description || "Not provided"}
Requirements: ${job.requirements?.join(", ") || "Not specified"}

CANDIDATE PROFILE:
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years
Seniority: ${cvProfile.seniority_level || "Not specified"}
Summary: ${cvProfile.summary || "Not provided"}
Recent Role: ${cvProfile.work_history?.[0]?.title || "Not specified"} at ${cvProfile.work_history?.[0]?.company || "Unknown"}`;

    let coverLetter: string;
    try {
      coverLetter = await callAI({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
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

    return new Response(JSON.stringify({ success: true, coverLetter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-cover-letter function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
