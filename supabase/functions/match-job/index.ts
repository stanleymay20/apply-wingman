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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId, cvProfileId, jobData, cvData } = await req.json();

    // Fetch job and CV data if IDs are provided
    let job = jobData;
    let cvProfile = cvData;

    if (jobId && !job) {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();
      if (error) throw new Error("Job not found");
      job = data;
    }

    if (cvProfileId && !cvProfile) {
      const { data, error } = await supabase.from("cv_profiles").select("*").eq("id", cvProfileId).single();
      if (error) throw new Error("CV profile not found");
      cvProfile = data;
    }

    if (!job || !cvProfile) {
      return new Response(JSON.stringify({ error: "Job and CV profile data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert job-candidate matching system. Analyze the job posting and candidate CV to calculate a match score (0-100) and provide detailed analysis.

Return a JSON object with this exact structure:
{
  "score": number (0-100),
  "confidence": "high" | "medium" | "low",
  "breakdown": {
    "skills_match": number (0-100),
    "experience_match": number (0-100),
    "seniority_match": number (0-100),
    "location_match": number (0-100),
    "language_match": number (0-100)
  },
  "matching_skills": ["array", "of", "matching", "skills"],
  "missing_skills": ["array", "of", "missing", "skills"],
  "strengths": ["array", "of", "candidate", "strengths"],
  "concerns": ["array", "of", "potential", "concerns"],
  "recommendation": "strong_apply" | "apply" | "consider" | "skip",
  "summary": "2-3 sentence summary of the match"
}

Scoring guidelines:
- 90-100: Exceptional match, candidate exceeds requirements
- 75-89: Strong match, candidate meets most requirements
- 60-74: Moderate match, candidate has transferable skills
- 40-59: Weak match, significant gaps exist
- 0-39: Poor match, not recommended`;

    const userPrompt = `Analyze this job-candidate match:

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Type: ${job.job_type || "Not specified"}
Remote: ${job.is_remote ? "Yes" : "No"}
Visa Sponsorship: ${job.visa_sponsorship ? "Available" : "Not mentioned"}
Description: ${job.description || "Not provided"}
Requirements: ${job.requirements?.join(", ") || "Not specified"}

CANDIDATE PROFILE:
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years
Seniority: ${cvProfile.seniority_level || "Not specified"}
Languages: ${cvProfile.languages?.join(", ") || "Not specified"}
Summary: ${cvProfile.summary || "Not provided"}
Keywords: ${cvProfile.keywords?.join(", ") || "Not specified"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    let matchResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      matchResult = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse match result:", content);
      throw new Error("Failed to parse match data");
    }

    // Update job with match score if jobId provided
    if (jobId) {
      await supabase
        .from("jobs")
        .update({
          match_score: matchResult.score,
          match_details: matchResult,
        })
        .eq("id", jobId);
    }

    return new Response(JSON.stringify({ success: true, data: matchResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in match-job function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
