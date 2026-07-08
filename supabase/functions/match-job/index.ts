import { callAI, callAIJson, AIRateLimitError, AICreditsError, preflightAI, AIError } from "../_shared/aiClient.ts";
import {
  fetchPosting,
  assessLiveness,
  fetchWorkdayLocation,
  extractJsonLdLocation,
  assessLocationEligibility,
} from "../_shared/postingCheck.ts";
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT using the caller's token
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AI health preflight — matching requires AI scoring.
    try {
      await preflightAI();
    } catch (e) {
      if (e instanceof AIError) {
        return new Response(
          JSON.stringify({ error: e.message, code: "AI_NOT_CONFIGURED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }


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

    // ===== Liveness + ground-truth location gate =====
    // Runs before spending AI credits. Catches (1) dead/removed postings that
    // redirect to a generic board page, and (2) location mismatches where the
    // stored label (often a stale "Remote") hides an onsite role in a country
    // the candidate can't work in. Only applied when we have a real jobId.
    let groundTruthLocation: string | null = null;
    if (job.source_url) {
      const fetched = await fetchPosting(job.source_url);
      const liveness = assessLiveness(job.source_url, fetched);

      if (!liveness.alive) {
        if (jobId) {
          await supabase
            .from("jobs")
            .update({
              status: "posting_expired",
              match_score: null,
              liveness_checked_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              expired: true,
              reason: liveness.reason,
              score: 0,
              recommendation: "skip",
              summary: `Posting is no longer available (${liveness.reason}). Marked as expired and excluded from matching.`,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Ground-truth location: Workday via its CXS JSON API, otherwise from any
      // JSON-LD JobPosting markup in the fetched HTML.
      if (/myworkdayjobs\.com/i.test(job.source_url)) {
        groundTruthLocation = await fetchWorkdayLocation(job.source_url);
      }
      if (!groundTruthLocation) {
        groundTruthLocation = extractJsonLdLocation(fetched.body);
      }

      if (jobId) {
        const patch: Record<string, unknown> = { liveness_checked_at: new Date().toISOString() };
        if (groundTruthLocation && groundTruthLocation !== job.location) {
          patch.location = groundTruthLocation;
          // Correct a stale "Remote" flag when ground truth names a real onsite city.
          if (!/remote/i.test(groundTruthLocation)) patch.is_remote = false;
        }
        await supabase.from("jobs").update(patch).eq("id", jobId);
        if (groundTruthLocation) {
          job.location = groundTruthLocation;
          if (!/remote/i.test(groundTruthLocation)) job.is_remote = false;
        }
      }
    }

    // Deterministic location-eligibility gate — enforced server-side regardless
    // of what the AI would say, using the ground-truth location above.
    const effectiveLocation = groundTruthLocation || job.location;
    const eligibility = assessLocationEligibility(
      effectiveLocation,
      Boolean(job.is_remote),
      Boolean(job.visa_sponsorship),
      {
        work_authorized_countries: cvProfile.work_authorized_countries,
        candidate_country: cvProfile.candidate_country,
        needs_sponsorship: cvProfile.needs_sponsorship,
      },
    );

    if (!eligibility.eligible) {
      const skipResult = {
        score: 12,
        confidence: "high" as const,
        location_eligible: false,
        breakdown: {
          skills_match: 0,
          experience_match: 0,
          seniority_match: 0,
          location_match: 0,
          language_match: 0,
        },
        matching_skills: [],
        missing_skills: [],
        strengths: [],
        concerns: [
          `Hard disqualifier: posting location "${effectiveLocation}" is in ${eligibility.detectedCountry ?? "a non-authorized region"} where the candidate is not authorized to work, and no visa sponsorship is offered.`,
        ],
        recommendation: "skip" as const,
        summary: `Location disqualifier: role is based in ${eligibility.detectedCountry ?? "an ineligible location"}; candidate lacks work authorization there and no sponsorship is offered.`,
      };
      if (jobId) {
        await supabase
          .from("jobs")
          .update({ match_score: skipResult.score, match_details: skipResult })
          .eq("id", jobId);
      }
      return new Response(JSON.stringify({ success: true, data: skipResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert job-candidate matching system. Analyze the job posting and candidate CV to calculate a match score (0-100) and provide detailed analysis.

Return a JSON object with this exact structure:
{
  "score": number (0-100),
  "confidence": "high" | "medium" | "low",
  "location_eligible": boolean,
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

Location eligibility rules — evaluate these BEFORE scoring anything else:
- Set location_eligible to true when ANY of the following holds:
  * the job's country (or region such as "EU") is among the countries the candidate is authorized to work in
  * the job is remote AND open to workers in the candidate's country
  * the job explicitly offers visa sponsorship
- Otherwise set location_eligible to false. A job tied to a country where the
  candidate has no work authorization and no sponsorship on offer is a HARD
  DISQUALIFIER: set location_eligible false, breakdown.location_match to 0,
  score to 15 or below, and recommendation to "skip" regardless of skills fit.
- If the candidate's eligibility information is not provided, assume
  location_eligible is true and score normally.

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
Keywords: ${cvProfile.keywords?.join(", ") || "Not specified"}

CANDIDATE ELIGIBILITY:
Based in: ${cvProfile.candidate_country || "Not specified"}
Authorized to work in: ${cvProfile.work_authorized_countries?.length ? cvProfile.work_authorized_countries.join(", ") : "Not specified"}
Needs visa sponsorship elsewhere: ${cvProfile.needs_sponsorship === true ? "Yes" : cvProfile.needs_sponsorship === false ? "No" : "Unknown"}`;

    // Retry logic with exponential backoff for rate limits
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
      }

      let matchResult: any;
      try {
        matchResult = await callAIJson({
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          temperature: 0.2,
        });
      } catch (e) {
        if (e instanceof AIRateLimitError) { lastError = new Error("Rate limit exceeded"); continue; }
        if (e instanceof AICreditsError) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Set GOOGLE_API_KEY for free usage." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }
      {
        // Enforce the hard disqualifier server-side: even if the model returns
        // a generous score, a location-ineligible job must never rank as
        // applicable.
        if (matchResult && matchResult.location_eligible === false) {
          matchResult.score = Math.min(typeof matchResult.score === "number" ? matchResult.score : 0, 15);
          if (matchResult.breakdown) matchResult.breakdown.location_match = 0;
          matchResult.recommendation = "skip";
          matchResult.concerns = [
            "Hard disqualifier: candidate is not authorized to work in the job location and no visa sponsorship is offered",
            ...(Array.isArray(matchResult.concerns) ? matchResult.concerns : []),
          ];
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
      }


    }

    // All retries exhausted
    return new Response(JSON.stringify({ error: "Rate limit exceeded - please try again later" }), {
      status: 429,
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
