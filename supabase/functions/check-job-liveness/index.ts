// Periodic liveness + location sweep for already-scored high-match jobs.
//
// Postings can go stale AFTER discovery/matching (the Moloco case: matched at
// 92%, later removed). This function re-checks a bounded batch of the user's
// high-match, still-"discovered" jobs and:
//   - marks dead postings as `posting_expired` (excluded from Good Fit / apply)
//   - re-applies the deterministic location disqualifier against ground truth
//
// Safe to call from the client (JWT) for the current user, or internally from
// scheduled-automation with the service-role key + { userId }.

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

const DEFAULT_BATCH = 25;
const MIN_SCORE = 60; // only bother re-checking jobs that would surface as fits

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
    const token = authHeader.replace("Bearer ", "");

    let userId: string;
    let batchSize = DEFAULT_BATCH;
    const body = await req.clone().json().catch(() => ({}));
    if (typeof body.limit === "number" && body.limit > 0) {
      batchSize = Math.min(body.limit, 50);
    }

    if (token === supabaseServiceKey) {
      userId = body.userId;
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required for internal calls" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Active CV profile for the location-eligibility check (optional).
    const { data: cvProfile } = await supabase
      .from("cv_profiles")
      .select("candidate_country, work_authorized_countries, needs_sponsorship, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    // Batch of high-match discovered jobs, staleest first.
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, source_url, source_platform, location, is_remote, visa_sponsorship, match_details")
      .eq("user_id", userId)
      .eq("status", "discovered")
      .gte("match_score", MIN_SCORE)
      .order("liveness_checked_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (jobsError) throw jobsError;

    let checked = 0;
    let expired = 0;
    let locationDisqualified = 0;

    for (const job of jobs ?? []) {
      checked++;
      const nowIso = new Date().toISOString();
      if (!job.source_url) {
        await supabase.from("jobs").update({ liveness_checked_at: nowIso }).eq("id", job.id);
        continue;
      }

      const fetched = await fetchPosting(job.source_url);
      const liveness = assessLiveness(job.source_url, fetched);

      if (!liveness.alive) {
        await supabase
          .from("jobs")
          .update({ status: "posting_expired", match_score: null, liveness_checked_at: nowIso })
          .eq("id", job.id);
        expired++;
        continue;
      }

      // Ground-truth location + re-check eligibility.
      let groundTruth: string | null = null;
      if (/myworkdayjobs\.com/i.test(job.source_url)) {
        groundTruth = await fetchWorkdayLocation(job.source_url);
      }
      if (!groundTruth) groundTruth = extractJsonLdLocation(fetched.body);

      const patch: Record<string, unknown> = { liveness_checked_at: nowIso };
      const effectiveLocation = groundTruth || job.location;
      if (groundTruth && groundTruth !== job.location) {
        patch.location = groundTruth;
        if (!/remote/i.test(groundTruth)) patch.is_remote = false;
      }

      if (cvProfile) {
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
          const details = (job.match_details ?? {}) as Record<string, unknown>;
          patch.match_score = 12;
          patch.match_details = {
            ...details,
            location_eligible: false,
            recommendation: "skip",
            breakdown: { ...(details.breakdown as Record<string, unknown> ?? {}), location_match: 0 },
            concerns: [
              `Hard disqualifier: posting location "${effectiveLocation}" is in ${eligibility.detectedCountry ?? "a non-authorized region"} with no sponsorship offered.`,
            ],
            summary: `Location disqualifier (re-checked): role is based in ${eligibility.detectedCountry ?? "an ineligible location"}.`,
          };
          locationDisqualified++;
        }
      }

      await supabase.from("jobs").update(patch).eq("id", job.id);
    }

    return new Response(
      JSON.stringify({ success: true, checked, expired, locationDisqualified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("check-job-liveness error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
