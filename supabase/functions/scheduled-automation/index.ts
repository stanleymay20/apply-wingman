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
    // Get all users with active automation and saved searches
    const { data: activeUsers, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, automation_status, minimum_fit_score, daily_application_cap")
      .eq("automation_status", "running");

    if (usersError) {
      console.error("Failed to fetch users:", usersError);
      throw usersError;
    }

    console.log(`Found ${activeUsers?.length || 0} users with automation enabled`);

    const results: { userId: string; jobsDiscovered: number; applicationsAttempted: number; errors: string[] }[] = [];

    for (const user of activeUsers || []) {
      const userResult = { userId: user.id, jobsDiscovered: 0, applicationsAttempted: 0, errors: [] as string[] };

      try {
        // Get user's active saved searches
        const { data: savedSearches } = await supabase
          .from("saved_searches")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (!savedSearches || savedSearches.length === 0) {
          console.log(`User ${user.id} has no active saved searches, skipping`);
          continue;
        }

        console.log(`User ${user.id} has ${savedSearches.length} active saved searches`);

        // Get user's CV profile for matching
        const { data: cvProfile } = await supabase
          .from("cv_profiles")
          .select("id, resume_score, skills, summary")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        // Check today's application count
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
          console.log(`User ${user.id} has reached daily cap (${dailyCap}), skipping`);
          continue;
        }

        // Process each saved search
        for (const search of savedSearches) {
          try {
            // Discover jobs using the discover-jobs function via HTTP call
            // Pass userId in body for internal service-to-service auth
            const discoverResponse = await fetch(`${supabaseUrl}/functions/v1/discover-jobs`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                userId: user.id, // Required for internal calls
                keywords: search.keywords,
                locations: search.locations,
                platforms: search.platforms,
              }),
            });

            if (!discoverResponse.ok) {
              const errorText = await discoverResponse.text();
              console.error(`Discovery failed for search ${search.id}:`, errorText);
              userResult.errors.push(`Discovery failed: ${errorText}`);
              continue;
            }

            const discoverData = await discoverResponse.json();
            const jobs = discoverData.jobs || [];
            
            console.log(`Search "${search.name}" found ${jobs.length} jobs`);
            userResult.jobsDiscovered += jobs.length;

            // Save discovered jobs
            if (jobs.length > 0) {
              // Check for existing jobs to avoid duplicates
              const { data: existingJobs } = await supabase
                .from("jobs")
                .select("source_url")
                .eq("user_id", user.id);

              const existingUrls = new Set((existingJobs || []).map(j => j.source_url?.toLowerCase()));

              const newJobs = jobs.filter((job: any) => 
                !existingUrls.has(job.source_url?.toLowerCase())
              );

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
                  .select("id, title, company");

                if (insertError) {
                  console.error("Failed to insert jobs:", insertError);
                  userResult.errors.push(`Insert failed: ${insertError.message}`);
                } else {
                  console.log(`Inserted ${insertedJobs?.length || 0} new jobs for user ${user.id}`);

                  // Match jobs if CV profile exists
                  if (cvProfile && insertedJobs) {
                    for (const job of insertedJobs.slice(0, 10)) { // Limit matching to first 10
                      try {
                        const matchResponse = await fetch(`${supabaseUrl}/functions/v1/match-job`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${supabaseServiceKey}`,
                          },
                          body: JSON.stringify({
                            jobId: job.id,
                            cvProfileId: cvProfile.id,
                          }),
                        });

                        if (matchResponse.ok) {
                          const matchData = await matchResponse.json();
                          const score = matchData.data?.score || 0;

                          // Update job with match score
                          await supabase
                            .from("jobs")
                            .update({ match_score: score, match_details: matchData.data })
                            .eq("id", job.id);

                          // If high match and within cap, create application
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
                              console.log(`Created application for ${job.title} at ${job.company} (score: ${score}%)`);

                              // Create notification
                              await supabase.from("notifications").insert({
                                user_id: user.id,
                                type: "high_match_job",
                                title: "🎯 High Match Job Found!",
                                message: `${job.title} at ${job.company} - ${score}% match`,
                                data: { jobId: job.id, score },
                              });
                            }
                          }
                        }
                      } catch (matchError) {
                        console.error(`Match error for job ${job.id}:`, matchError);
                      }
                    }
                  }
                }
              }
            }

            // Update last_run_at for the saved search
            await supabase
              .from("saved_searches")
              .update({ last_run_at: new Date().toISOString() })
              .eq("id", search.id);

          } catch (searchError) {
            console.error(`Error processing search ${search.id}:`, searchError);
            userResult.errors.push(`Search ${search.name} failed`);
          }
        }

        // Create job discovery run record
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

    console.log(`✅ Scheduled automation complete. Jobs: ${totalJobs}, Applications: ${totalApps}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} users`,
        summary: {
          usersProcessed: results.length,
          totalJobsDiscovered: totalJobs,
          totalApplicationsCreated: totalApps,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scheduled automation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
