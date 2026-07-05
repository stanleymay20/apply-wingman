import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  openRun,
  closeRun,
  emitStep,
  incrementRunCounter,
  recordFailure,
  WORKER_VERSION,
} from "../_shared/runLedger.ts";
import { prepareApplicationMaterials } from "../_shared/materials.ts";

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

  console.log(`🚀 Scheduled automation starting (worker ${WORKER_VERSION})...`);

  try {
    const { data: activeUsers, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, automation_status, minimum_fit_score, daily_application_cap, company_cooldown_days, max_apps_per_company")
      .eq("automation_status", "running");

    if (usersError) throw usersError;

    console.log(`Found ${activeUsers?.length || 0} users with automation enabled`);

    const results: { userId: string; runId: string | null; jobsDiscovered: number; applicationsAttempted: number; applicationsSubmitted: number; errors: string[] }[] = [];

    for (const user of activeUsers || []) {
      const userResult = { userId: user.id, runId: null as string | null, jobsDiscovered: 0, applicationsAttempted: 0, applicationsSubmitted: 0, errors: [] as string[] };

      // ===== Open a run row for THIS user/tick =====
      const run = await openRun(supabase, {
        userId: user.id,
        triggerType: "cron",
        executionSource: "scheduled-automation",
        metadata: { cap: user.daily_application_cap, minScore: user.minimum_fit_score },
      });
      if (!run) {
        userResult.errors.push("Failed to open automation run row");
        results.push(userResult);
        continue;
      }
      userResult.runId = run.id;

      let runStatus: "completed" | "partial" | "failed" = "completed";

      try {
        const { data: savedSearches } = await supabase
          .from("saved_searches")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (!savedSearches?.length) {
          console.log(`User ${user.id} has no active saved searches, skipping`);
          await closeRun(supabase, { runId: run.id, startedAt: run.startedAt, status: "completed", errorSummary: "no_active_saved_searches" });
          results.push(userResult);
          continue;
        }

        const { data: cvProfile } = await supabase
          .from("cv_profiles")
          .select("id, resume_score, skills, summary, cv_file_url, work_history, experience_years, seniority_level")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        const today = new Date().toISOString().split("T")[0];
        const { data: todayApps } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", user.id)
          .gte("applied_at", `${today}T00:00:00`)
          .lte("applied_at", `${today}T23:59:59`);

        const dailyCap = user.daily_application_cap || 200;
        const remainingCap = dailyCap - (todayApps?.length || 0);

        if (remainingCap <= 0) {
          console.log(`User ${user.id} reached daily cap (${dailyCap}), skipping`);
          await closeRun(supabase, { runId: run.id, startedAt: run.startedAt, status: "completed", errorSummary: "daily_cap_reached" });
          results.push(userResult);
          continue;
        }

        for (const search of savedSearches) {
          const discStarted = Date.now();
          await emitStep(supabase, {
            runId: run.id, userId: user.id, stepName: "discover_started",
            status: "running",
            payload: { searchId: search.id, name: search.name, keywords: search.keywords },
            idempotencyKey: `discover_started:${search.id}`,
          });

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
              await emitStep(supabase, {
                runId: run.id, userId: user.id, stepName: "discover_completed",
                status: "failed", error: errorText, startedAt: discStarted,
                payload: { searchId: search.id },
                idempotencyKey: `discover_completed:${search.id}`,
              });
              await recordFailure(supabase, {
                runId: run.id, userId: user.id, stepName: "discover_completed",
                errorCode: `http_${discoverResponse.status}`, errorMessage: errorText,
                retryable: discoverResponse.status >= 500 || discoverResponse.status === 429,
                context: { searchId: search.id },
              });
              runStatus = "partial";
              continue;
            }

            const discoverData = await discoverResponse.json();
            const jobs = discoverData.jobs || [];
            userResult.jobsDiscovered += jobs.length;
            await incrementRunCounter(supabase, run.id, "jobs_discovered", jobs.length);

            await emitStep(supabase, {
              runId: run.id, userId: user.id, stepName: "discover_completed",
              status: "completed", startedAt: discStarted,
              payload: { searchId: search.id, jobsFound: jobs.length },
              idempotencyKey: `discover_completed:${search.id}`,
            });

            if (jobs.length > 0) {
              const { data: existingJobs } = await supabase
                .from("jobs").select("source_url").eq("user_id", user.id);
              const existingUrls = new Set((existingJobs || []).map((j: any) => j.source_url?.toLowerCase()));
              const newJobs = jobs.filter((job: any) => !existingUrls.has(job.source_url?.toLowerCase()));

              if (newJobs.length > 0) {
                const jobsToInsert = newJobs.map((job: any) => ({
                  title: job.title, company: job.company, location: job.location || null,
                  source_platform: job.source_platform, source_url: job.source_url,
                  description: job.description || null, requirements: job.requirements || [],
                  is_remote: job.is_remote ?? false, job_type: job.job_type || null,
                  user_id: user.id, status: "discovered",
                }));

                const { data: insertedJobs, error: insertError } = await supabase
                  .from("jobs").insert(jobsToInsert)
                  .select("id, title, company, source_url, source_platform, description, requirements, location");

                if (insertError) {
                  userResult.errors.push(`Insert failed: ${insertError.message}`);
                  runStatus = "partial";
                } else if (cvProfile && insertedJobs) {
                  for (const job of insertedJobs.slice(0, 10)) {
                    const matchStarted = Date.now();
                    await emitStep(supabase, {
                      runId: run.id, userId: user.id, stepName: "match_started", status: "running",
                      jobId: job.id, idempotencyKey: `match_started:${job.id}`,
                    });
                    try {
                      const matchResponse = await fetch(`${supabaseUrl}/functions/v1/match-job`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseServiceKey}` },
                        body: JSON.stringify({ jobId: job.id, cvProfileId: cvProfile.id }),
                      });
                      if (!matchResponse.ok) {
                        await emitStep(supabase, {
                          runId: run.id, userId: user.id, stepName: "match_completed",
                          status: "failed", jobId: job.id, startedAt: matchStarted,
                          error: `http_${matchResponse.status}`,
                          idempotencyKey: `match_completed:${job.id}`,
                        });
                        continue;
                      }
                      const matchData = await matchResponse.json();
                      const score = matchData.data?.score || 0;

                      await supabase.from("jobs").update({ match_score: score, match_details: matchData.data }).eq("id", job.id);
                      await incrementRunCounter(supabase, run.id, "jobs_matched", 1);
                      await emitStep(supabase, {
                        runId: run.id, userId: user.id, stepName: "match_completed",
                        status: "completed", jobId: job.id, startedAt: matchStarted,
                        payload: { score },
                        idempotencyKey: `match_completed:${job.id}`,
                      });

                      const minScore = user.minimum_fit_score || 70;
                      if (score >= minScore && userResult.applicationsAttempted < remainingCap) {
                        // ===== Recruiter cooldown =====
                        const cooldownDays = (user as any).company_cooldown_days ?? 30;
                        const maxPerCompany = (user as any).max_apps_per_company ?? 1;
                        const { data: recentCount } = await supabase.rpc(
                          "recent_applications_to_company",
                          { p_user_id: user.id, p_company: job.company, p_days: cooldownDays }
                        );
                        if ((recentCount ?? 0) >= maxPerCompany) {
                          console.log(`⏸  Cooldown active for ${job.company}`);
                          await emitStep(supabase, {
                            runId: run.id, userId: user.id, stepName: "cooldown_skipped",
                            status: "skipped", jobId: job.id,
                            payload: { company: job.company, recentCount, maxPerCompany, cooldownDays },
                            idempotencyKey: `cooldown_skipped:${job.id}`,
                          });
                          await supabase.from("application_logs").insert({
                            user_id: user.id, job_id: job.id, action: "cooldown_skipped", level: "info",
                            message: `Skipped ${job.title} at ${job.company} — company cooldown active`,
                            details: { company: job.company, recentCount, maxPerCompany, cooldownDays, runId: run.id },
                          });
                          continue;
                        }

                        // Create application
                        const { data: app } = await supabase
                          .from("applications").insert({
                            user_id: user.id, job_id: job.id, cv_profile_id: cvProfile.id,
                            match_score: score, status: "pending",
                            correlation_id: run.correlationId,
                          })
                          .select().single();

                        if (app) {
                          userResult.applicationsAttempted++;
                          await incrementRunCounter(supabase, run.id, "applications_attempted", 1);

                          // ===== Tailor CV + cover letter for THIS job =====
                          const materialsStarted = Date.now();
                          await emitStep(supabase, {
                            runId: run.id, userId: user.id, stepName: "materials_started", status: "running",
                            applicationId: app.id, jobId: job.id,
                            idempotencyKey: `materials_started:${app.id}`,
                          });
                          const materials = await prepareApplicationMaterials(supabase, {
                            userId: user.id,
                            applicationId: app.id,
                            userName: user.full_name || user.email,
                            job,
                            cvProfile,
                          });
                          await emitStep(supabase, {
                            runId: run.id, userId: user.id, stepName: "materials_completed",
                            status: materials.coverLetter || materials.tailoredCvPdfUrl ? "completed" : "failed",
                            applicationId: app.id, jobId: job.id, startedAt: materialsStarted,
                            payload: {
                              coverLetter: Boolean(materials.coverLetter),
                              tailoredCvPdf: Boolean(materials.tailoredCvPdfUrl),
                            },
                            idempotencyKey: `materials_completed:${app.id}`,
                          });

                          const applyStarted = Date.now();
                          await emitStep(supabase, {
                            runId: run.id, userId: user.id, stepName: "apply_started", status: "running",
                            applicationId: app.id, jobId: job.id,
                            idempotencyKey: `apply_started:${app.id}`,
                          });

                          const { verified, message } = await triggerAutoApply(supabaseUrl, supabaseServiceKey, {
                            userId: user.id, applicationId: app.id, jobId: job.id,
                            jobTitle: job.title, company: job.company,
                            sourceUrl: job.source_url, sourcePlatform: job.source_platform,
                            userName: user.full_name || user.email, userEmail: user.email,
                            cvFileUrl: materials.tailoredCvPdfUrl || cvProfile.cv_file_url || undefined,
                            coverLetter: materials.coverLetter || undefined,
                            runId: run.id, correlationId: run.correlationId,
                          });

                          if (verified) {
                            userResult.applicationsSubmitted++;
                            await incrementRunCounter(supabase, run.id, "applications_succeeded", 1);
                            await emitStep(supabase, {
                              runId: run.id, userId: user.id, stepName: "apply_completed",
                              status: "completed", applicationId: app.id, jobId: job.id, startedAt: applyStarted,
                              payload: { message },
                              idempotencyKey: `apply_completed:${app.id}`,
                            });
                          } else {
                            await incrementRunCounter(supabase, run.id, "applications_failed", 1);
                            await emitStep(supabase, {
                              runId: run.id, userId: user.id, stepName: "apply_failed",
                              status: "failed", applicationId: app.id, jobId: job.id, startedAt: applyStarted,
                              error: message ?? "Apply did not verify delivery",
                              idempotencyKey: `apply_failed:${app.id}`,
                            });
                          }

                          await supabase.from("notifications").insert({
                            user_id: user.id, type: "high_match_job",
                            title: "🎯 High Match Job Found",
                            message: `${job.title} at ${job.company} — ${score}% match${verified ? " (delivered)" : " (action may be required)"}`,
                            data: { jobId: job.id, score, verified, runId: run.id },
                          });
                        }
                      }
                    } catch (matchError) {
                      console.error(`Match error for job ${job.id}:`, matchError);
                      await emitStep(supabase, {
                        runId: run.id, userId: user.id, stepName: "match_completed",
                        status: "failed", jobId: job.id, startedAt: matchStarted,
                        error: String(matchError),
                        idempotencyKey: `match_completed:${job.id}`,
                      });
                    }
                  }
                }
              }
            }

            await supabase.from("saved_searches").update({ last_run_at: new Date().toISOString() }).eq("id", search.id);
          } catch (searchError) {
            console.error(`Error processing search ${search.id}:`, searchError);
            userResult.errors.push(`Search ${search.name} failed`);
            runStatus = "partial";
            await recordFailure(supabase, {
              runId: run.id, userId: user.id, stepName: "discover_completed",
              errorCode: "search_exception", errorMessage: String(searchError),
              retryable: true, context: { searchId: search.id },
            });
          }
        }

        await supabase.from("job_discovery_runs").insert({
          user_id: user.id,
          params: { type: "scheduled", searchCount: savedSearches.length, runId: run.id },
          jobs_found: userResult.jobsDiscovered, jobs_saved: userResult.jobsDiscovered,
          status: userResult.errors.length > 0 ? "partial" : "completed",
          error: userResult.errors.length > 0 ? userResult.errors.join("; ") : null,
          started_at: new Date(run.startedAt).toISOString(),
          finished_at: new Date().toISOString(),
        });

        await closeRun(supabase, {
          runId: run.id, startedAt: run.startedAt,
          status: userResult.errors.length > 0 ? "partial" : "completed",
          errorSummary: userResult.errors.length > 0 ? userResult.errors.slice(0, 5).join(" | ") : null,
        });
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        userResult.errors.push(String(userError));
        await recordFailure(supabase, {
          runId: run.id, userId: user.id,
          errorCode: "user_loop_exception", errorMessage: String(userError),
          retryable: false,
        });
        await closeRun(supabase, {
          runId: run.id, startedAt: run.startedAt, status: "failed",
          errorSummary: String(userError).slice(0, 500),
        });
      }

      results.push(userResult);
    }

    const totalJobs = results.reduce((sum, r) => sum + r.jobsDiscovered, 0);
    const totalApps = results.reduce((sum, r) => sum + r.applicationsAttempted, 0);
    const totalSubmitted = results.reduce((sum, r) => sum + r.applicationsSubmitted, 0);
    console.log(`✅ Automation complete. Jobs: ${totalJobs}, Apps: ${totalApps}, Verified: ${totalSubmitted}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: { usersProcessed: results.length, totalJobsDiscovered: totalJobs, totalApplicationsCreated: totalApps, totalApplicationsVerified: totalSubmitted },
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
 * Triggers auto-apply. Only returns `verified: true` when the application reached
 * a verified delivered state (Resend accepted). manual_action_required / failed
 * → verified: false.
 */
async function triggerAutoApply(
  supabaseUrl: string,
  serviceKey: string,
  params: {
    userId: string; applicationId: string; jobId: string; jobTitle: string; company: string;
    sourceUrl: string; sourcePlatform: string; userName: string; userEmail: string;
    cvFileUrl?: string; coverLetter?: string; runId: string; correlationId: string;
  }
): Promise<{ verified: boolean; message?: string }> {
  try {
    const method = detectApplyMethod(params.sourceUrl);
    const response = await fetch(`${supabaseUrl}/functions/v1/auto-apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({
        userId: params.userId, applicationId: params.applicationId, jobId: params.jobId,
        method, userName: params.userName, userEmail: params.userEmail,
        jobTitle: params.jobTitle, company: params.company,
        sourceUrl: params.sourceUrl, sourcePlatform: params.sourcePlatform,
        cvFileUrl: params.cvFileUrl,
        coverLetter: params.coverLetter,
        runId: params.runId, correlationId: params.correlationId,
      }),
    });
    if (!response.ok) {
      return { verified: false, message: `auto-apply http ${response.status}` };
    }
    const result = await response.json();
    // Truthful: only treat as verified when auto-apply reports verified delivery.
    const verified = result?.success === true && result?.deliveryStatus === "delivered";
    return { verified, message: result?.message };
  } catch (error) {
    return { verified: false, message: String(error) };
  }
}

function detectApplyMethod(sourceUrl: string): "email" | "ats_api" | "assisted" {
  const url = sourceUrl.toLowerCase();
  if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) return "ats_api";
  if (url.includes("lever.co")) return "ats_api";
  if (url.includes("workday")) return "assisted";
  if (url.includes("linkedin.com")) return "assisted";
  return "email";
}
