import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("🚀 Scheduled automation starting...");

  try {
    const { data: activeUsers, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, automation_status, minimum_fit_score, daily_application_cap")
      .eq("automation_status", "running");

    if (usersError) throw usersError;

    console.log(`Found ${activeUsers?.length || 0} users with automation enabled`);

    const results: { userId: string; jobsDiscovered: number; applicationsAttempted: number; applicationsSubmitted: number; errors: string[] }[] = [];

    for (const user of activeUsers || []) {
      const userResult = { userId: user.id, jobsDiscovered: 0, applicationsAttempted: 0, applicationsSubmitted: 0, errors: [] as string[] };

      try {
        // Get active saved searches
        const { data: savedSearches } = await supabase
          .from("saved_searches")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (!savedSearches?.length) {
          console.log(`User ${user.id} has no active saved searches, skipping`);
          continue;
        }

        // Get CV profile
        const { data: cvProfile } = await supabase
          .from("cv_profiles")
          .select("id, resume_score, skills, summary, cv_file_url")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        // Check daily cap
        const today = new Date().toISOString().split("T")[0];
        const { data: todayApps } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", user.id)
          .gte("applied_at", `${today}T00:00:00`)
          .lte("applied_at", `${today}T23:59:59`);

        const dailyCap = user.daily_application_cap || 25;
        const remainingCap = dailyCap - (todayApps?.length || 0);

        if (remainingCap <= 0) {
          console.log(`User ${user.id} reached daily cap (${dailyCap}), skipping`);
          continue;
        }

        // Process each saved search
        for (const search of savedSearches) {
          try {
            const discoverResponse = await fetch(`${supabaseUrl}/functions/v1/discover-jobs`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                userId: user.id,
                keywords: search.keywords,
                locations: search.locations,
                platforms: search.platforms,
              }),
            });

            if (!discoverResponse.ok) {
              const errorText = await discoverResponse.text();
              userResult.errors.push(`Discovery failed: ${errorText}`);
              continue;
            }

            const discoverData = await discoverResponse.json();
            const jobs = discoverData.jobs || [];
            userResult.jobsDiscovered += jobs.length;

            if (jobs.length > 0) {
              const { data: existingJobs } = await supabase
                .from("jobs")
                .select("source_url")
                .eq("user_id", user.id);

              const existingUrls = new Set((existingJobs || []).map((j: any) => j.source_url?.toLowerCase()));
              const newJobs = jobs.filter((job: any) => !existingUrls.has(job.source_url?.toLowerCase()));

              if (newJobs.length > 0) {
                const jobsToInsert = newJobs.map((job: any) => ({
                  title: job.title,
                  company: job.company,
                  location: job.location || null,
                  source_platform: job.source_platform,
                  source_url: job.source_url,
                  description: job.description || null,
                  requirements: job.requirements || [],
                  is_remote: job.is_remote ?? false,
                  job_type: job.job_type || null,
                  user_id: user.id,
                  status: "discovered",
                }));

                const { data: insertedJobs, error: insertError } = await supabase
                  .from("jobs")
                  .insert(jobsToInsert)
                  .select("id, title, company, source_url, source_platform");

                if (insertError) {
                  userResult.errors.push(`Insert failed: ${insertError.message}`);
                } else if (cvProfile && insertedJobs) {
                  // Match and auto-apply for high-scoring jobs
                  for (const job of insertedJobs.slice(0, 10)) {
                    try {
                      const matchResponse = await fetch(`${supabaseUrl}/functions/v1/match-job`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${supabaseServiceKey}`,
                        },
                        body: JSON.stringify({ jobId: job.id, cvProfileId: cvProfile.id }),
                      });

                      if (!matchResponse.ok) continue;

                      const matchData = await matchResponse.json();
                      const score = matchData.data?.score || 0;

                      await supabase
                        .from("jobs")
                        .update({ match_score: score, match_details: matchData.data })
                        .eq("id", job.id);

                      const minScore = user.minimum_fit_score || 70;
                      if (score >= minScore && userResult.applicationsAttempted < remainingCap) {
                        // Create application record
                        const { data: app } = await supabase
                          .from("applications")
                          .insert({
                            user_id: user.id,
                            job_id: job.id,
                            cv_profile_id: cvProfile.id,
                            match_score: score,
                            status: "pending",
                          })
                          .select()
                          .single();

                        if (app) {
                          userResult.applicationsAttempted++;

                          // Trigger auto-apply submission
                          const submitted = await triggerAutoApply(supabaseUrl, supabaseServiceKey, {
                            userId: user.id,
                            applicationId: app.id,
                            jobId: job.id,
                            jobTitle: job.title,
                            company: job.company,
                            sourceUrl: job.source_url,
                            sourcePlatform: job.source_platform,
                            userName: user.full_name || user.email,
                            userEmail: user.email,
                            cvFileUrl: cvProfile.cv_file_url || undefined,
                          });

                          if (submitted) {
                            userResult.applicationsSubmitted++;
                          }

                          // Notification
                          await supabase.from("notifications").insert({
                            user_id: user.id,
                            type: "high_match_job",
                            title: "🎯 High Match Job Found!",
                            message: `${job.title} at ${job.company} - ${score}% match${submitted ? " (auto-applied)" : ""}`,
                            data: { jobId: job.id, score, applied: submitted },
                          });
                        }
                      }
                    } catch (matchError) {
                      console.error(`Match error for job ${job.id}:`, matchError);
                    }
                  }
                }
              }
            }

            await supabase
              .from("saved_searches")
              .update({ last_run_at: new Date().toISOString() })
              .eq("id", search.id);

          } catch (searchError) {
            console.error(`Error processing search ${search.id}:`, searchError);
            userResult.errors.push(`Search ${search.name} failed`);
          }
        }

        // Record discovery run
        await supabase.from("job_discovery_runs").insert({
          user_id: user.id,
          params: { type: "scheduled", searchCount: savedSearches.length },
          jobs_found: userResult.jobsDiscovered,
          jobs_saved: userResult.jobsDiscovered,
          status: userResult.errors.length > 0 ? "partial" : "completed",
          error: userResult.errors.length > 0 ? userResult.errors.join("; ") : null,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        });

      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        userResult.errors.push(String(userError));
      }

      results.push(userResult);
    }

    const totalJobs = results.reduce((sum, r) => sum + r.jobsDiscovered, 0);
    const totalApps = results.reduce((sum, r) => sum + r.applicationsAttempted, 0);
    const totalSubmitted = results.reduce((sum, r) => sum + r.applicationsSubmitted, 0);

    console.log(`✅ Automation complete. Jobs: ${totalJobs}, Apps created: ${totalApps}, Submitted: ${totalSubmitted}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} users`,
        summary: {
          usersProcessed: results.length,
          totalJobsDiscovered: totalJobs,
          totalApplicationsCreated: totalApps,
          totalApplicationsSubmitted: totalSubmitted,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scheduled automation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Triggers the auto-apply edge function for a pending application.
 * Detects best method (email vs ATS vs assisted) based on source URL.
 */
async function triggerAutoApply(
  supabaseUrl: string,
  serviceKey: string,
  params: {
    userId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    company: string;
    sourceUrl: string;
    sourcePlatform: string;
    userName: string;
    userEmail: string;
    cvFileUrl?: string;
  }
): Promise<boolean> {
  try {
    const method = detectApplyMethod(params.sourceUrl);
    console.log(`Auto-applying for "${params.jobTitle}" at ${params.company} via ${method}`);

    const response = await fetch(`${supabaseUrl}/functions/v1/auto-apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        userId: params.userId,
        applicationId: params.applicationId,
        jobId: params.jobId,
        method,
        userName: params.userName,
        userEmail: params.userEmail,
        jobTitle: params.jobTitle,
        company: params.company,
        sourceUrl: params.sourceUrl,
        sourcePlatform: params.sourcePlatform,
        cvFileUrl: params.cvFileUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Auto-apply failed for ${params.applicationId}: ${errorText}`);
      return false;
    }

    const result = await response.json();
    console.log(`Auto-apply result for ${params.applicationId}:`, result.success ? "SUCCESS" : "FAILED");
    return result.success === true;
  } catch (error) {
    console.error(`Auto-apply error for ${params.applicationId}:`, error);
    return false;
  }
}

/**
 * Detects the best application method based on the job source URL.
 */
function detectApplyMethod(sourceUrl: string): "email" | "ats_api" | "assisted" {
  const url = sourceUrl.toLowerCase();
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) return "ats_api";
  if (url.includes("lever.co")) return "ats_api";
  if (url.includes("workday")) return "assisted";
  if (url.includes("linkedin.com")) return "assisted";
  // Default to email for company websites and other sources
  return "email";
}
