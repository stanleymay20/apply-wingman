import { callAI, callAIJson, AIRateLimitError, AICreditsError } from "../_shared/aiClient.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobData {
  title: string;
  company: string;
  description: string;
  requirements: string[];
}

interface CVData {
  skills: string[];
  experience_years: number;
  seniority_level: string;
  work_history: Array<{
    title: string;
    company: string;
    duration: string;
    highlights: string[];
  }>;
  education: Array<{
    degree: string;
    field: string;
    institution: string;
  }>;
  summary: string;
}

// Input validation
function validateInput(data: unknown): { valid: boolean; error?: string; job?: JobData; cvProfile?: CVData } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { job, cvProfile } = data as Record<string, unknown>;

  if (!job || typeof job !== "object") {
    return { valid: false, error: "Job data is required" };
  }

  if (!cvProfile || typeof cvProfile !== "object") {
    return { valid: false, error: "CV profile is required" };
  }

  const jobData = job as Record<string, unknown>;
  const cvData = cvProfile as Record<string, unknown>;

  // Validate job fields
  if (!jobData.title || typeof jobData.title !== "string") {
    return { valid: false, error: "Job title is required" };
  }
  if (!jobData.company || typeof jobData.company !== "string") {
    return { valid: false, error: "Company name is required" };
  }

  // Truncate long fields
  const validatedJob: JobData = {
    title: String(jobData.title).slice(0, 500),
    company: String(jobData.company).slice(0, 500),
    description: typeof jobData.description === "string" ? jobData.description.slice(0, 10000) : "",
    requirements: Array.isArray(jobData.requirements) 
      ? jobData.requirements.filter((r): r is string => typeof r === "string").slice(0, 20)
      : [],
  };

  const validatedCv: CVData = {
    skills: Array.isArray(cvData.skills) 
      ? cvData.skills.filter((s): s is string => typeof s === "string").slice(0, 50)
      : [],
    experience_years: typeof cvData.experience_years === "number" ? cvData.experience_years : 0,
    seniority_level: typeof cvData.seniority_level === "string" ? cvData.seniority_level.slice(0, 100) : "",
    work_history: Array.isArray(cvData.work_history) 
      ? cvData.work_history.slice(0, 10).map((w: unknown) => {
          const work = w as Record<string, unknown>;
          return {
            title: String(work.title || "").slice(0, 200),
            company: String(work.company || "").slice(0, 200),
            duration: String(work.duration || "").slice(0, 100),
            highlights: Array.isArray(work.highlights) 
              ? work.highlights.filter((h): h is string => typeof h === "string").slice(0, 10)
              : [],
          };
        })
      : [],
    education: Array.isArray(cvData.education)
      ? cvData.education.slice(0, 5).map((e: unknown) => {
          const edu = e as Record<string, unknown>;
          return {
            degree: String(edu.degree || "").slice(0, 200),
            field: String(edu.field || "").slice(0, 200),
            institution: String(edu.institution || "").slice(0, 200),
          };
        })
      : [],
    summary: typeof cvData.summary === "string" ? cvData.summary.slice(0, 2000) : "",
  };

  return { valid: true, job: validatedJob, cvProfile: validatedCv };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== AUTHENTICATION =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user for contract generation: ${userId}`);
    // ===== END AUTHENTICATION =====

    // Parse and validate input
    const rawInput = await req.json();
    const validation = validateInput(rawInput);

    if (!validation.valid || !validation.job || !validation.cvProfile) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { job, cvProfile } = validation;

    const systemPrompt = `You are an expert career advisor creating HONEST job application materials.

CRITICAL RULES:
1. ONLY claim skills the candidate actually has (listed in their CV)
2. NEVER exaggerate experience or capabilities
3. NEVER invent achievements or projects not in the CV
4. If candidate lacks a required skill, acknowledge the gap but show willingness to learn
5. Use specific examples from their actual work history
6. Be professional but authentic - no generic fluff
7. Highlight genuine matches between candidate skills and job requirements

Your output should be grounded ONLY in the provided CV data.`;

    const userPrompt = `Create an honest, tailored job application contract for this position.

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Requirements: ${job.requirements?.join(", ") || "Not specified"}

CANDIDATE CV DATA:
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years
Level: ${cvProfile.seniority_level || "Not specified"}
Summary: ${cvProfile.summary || "Not provided"}

Work History:
${cvProfile.work_history?.map(w => `- ${w.title} at ${w.company} (${w.duration}): ${w.highlights?.join("; ") || "No highlights"}`).join("\n") || "Not provided"}

Education:
${cvProfile.education?.map(e => `- ${e.degree} in ${e.field} from ${e.institution}`).join("\n") || "Not provided"}

Generate a structured application contract with:
1. SKILL MATCH ANALYSIS - Which required skills the candidate has vs lacks (be honest)
2. TAILORED COVER LETTER - Based only on actual experience, no exaggeration
3. KEY TALKING POINTS - Specific examples from their real work history
4. HONEST GAP ACKNOWLEDGMENT - Skills they'd need to develop
5. INTERVIEW PREPARATION - Questions to prepare for based on gaps

Return as JSON with this structure:
{
  "skillMatch": {
    "matched": ["skill1", "skill2"],
    "missing": ["skill3"],
    "partialMatch": ["skill4 - have basic knowledge"]
  },
  "coverLetter": "...",
  "talkingPoints": ["point1", "point2"],
  "gapsToAddress": ["gap1 - how to address it"],
  "interviewPrep": ["question1", "question2"],
  "overallFitScore": 75,
  "honestAssessment": "..."
}`;

    let contract: unknown;
    try {
      contract = await callAIJson({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      });
    } catch (e) {
      if (e instanceof AIRateLimitError) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (e instanceof AICreditsError) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Set GOOGLE_API_KEY in Supabase secrets." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI error:", e);
      return new Response(
        JSON.stringify({ success: false, error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, contract }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Contract generation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
