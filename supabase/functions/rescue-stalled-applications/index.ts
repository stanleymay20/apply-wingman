// Rescues applications stuck at `manual_action_required` by:
//   1. Looking up / extracting a recruiter email for the job
//   2. Re-submitting via the email path (auto-apply method: "email")
// Only processes apps where automation is still running for the user.
// Caps at BATCH_SIZE per run to stay within rate limits.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { openRun, closeRun, emitStep, WORKER_VERSION } from "../_shared/runLedger.ts";
import { prepareApplicationMaterials } from "../_shared/materials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
let running = false;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (running) {
    return new Response(JSON.stringify({ skipped: true, reason: "already_running" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  running = true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const summary = { scanned: 0, email_found: 0, retried: 0, delivered: 0, skipped: 0, failed: 0 };

  try {
    // Fetch stalled apps — only for users with automation running
    const { data: stalledApps, error: appsErr } = await supabase
      .from("applications")
      .select(`
        id, user_id, job_id, cover_letter, tailored_cv_pdf_url,
        jobs!inner(id, title, company, source_url, source_platform, description, requirements, location, recruiter_email, recruiter_email_confidence, recruiter_email_extracted_at),
        profiles!inner(email, full_name, automation_status, daily_application_cap, cv_profiles!inner(id, cv_file_url, summary, skills, cv_text, work_history, experience_years, seniority_level))
      `)
      .eq("status", "manual_action_required")
      .eq("profiles.automation_status", "running")
      .is("jobs.recruiter_email_confidence", null) // not yet attempted OR has an email
      .limit(BATCH_SIZE)
      .order("updated_at", { ascending: true });

    if (appsErr) throw appsErr;

    // Also fetch apps where we already have an email (extracted/inferred) but haven't retried
    const { data: emailReadyApps } = await supabase
      .from("applications")
      .select(`
        id, user_id, job_id, cover_letter, tailored_cv_pdf_url,
        jobs!inner(id, title, company, source_url, source_platform, description, requirements, location, recruiter_email, recruiter_email_confidence),
        profiles!inner(email, full_name, automation_status, daily_application_cap, cv_profiles!inner(id, cv_file_url, summary, skills, cv_text, work_history, experience_years, seniority_level))
      `)
      .eq("status", "manual_action_required")
      .eq("profiles.automation_status", "running")
      .in("jobs.recruiter_email_confidence", ["extracted", "inferred"])
      .limit(BATCH_SIZE)
      .order("updated_at", { ascending: true });

    const allApps = [...(stalledApps || []), ...(emailReadyApps || [])];
    summary.scanned = allApps.length;

    for (const app of allApps) {
      const job = (app as any).jobs;
      const profile = (app as any).profiles;
      const cv = profile?.cv_profiles?.[0];

      if (!job || !profile) { summary.skipped++; continue; }

      let recruiterEmail: string | null = job.recruiter_email || null;

      // Try extraction if not yet attempted
      if (!recruiterEmail && !job.recruiter_email_confidence) {
        try {
          const extractRes = await fetch(
            `${supabaseUrl}/functions/v1/extract-recruiter-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ jobId: job.id }),
            }
          );
          const extractData = await extractRes.json();
          recruiterEmail = extractData.email || null;
          if (recruiterEmail) summary.email_found++;
        } catch (e) {
          console.error("extract-recruiter-email failed for job", job.id, e);
        }
      } else if (recruiterEmail) {
        summary.email_found++;
      }

      if (!recruiterEmail) { summary.skipped++; continue; }

      // Ensure a tailored CV + cover letter exist before emailing the recruiter.
      // Reuses stored materials when present; falls back to profile CV on failure.
      let coverLetter: string | null = (app as any).cover_letter || null;
      let tailoredCvPdfUrl: string | null = (app as any).tailored_cv_pdf_url || null;
      if (cv && (!coverLetter || !tailoredCvPdfUrl)) {
        const materials = await prepareApplicationMaterials(supabase, {
          userId: (app as any).user_id,
          applicationId: app.id,
          userName: profile.full_name || profile.email,
          job,
          cvProfile: cv,
        });
        coverLetter = materials.coverLetter || coverLetter;
        tailoredCvPdfUrl = materials.tailoredCvPdfUrl || tailoredCvPdfUrl;
      }

      // Re-submit via email path
      try {
        const applyRes = await fetch(
          `${supabaseUrl}/functions/v1/auto-apply`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
              "X-Idempotency-Key": `rescue:${app.id}`,
            },
            body: JSON.stringify({
              applicationId: app.id,
              jobId: job.id,
              method: "email",
              recipientEmail: recruiterEmail,
              jobTitle: job.title,
              company: job.company,
              sourceUrl: job.source_url,
              sourcePlatform: job.source_platform,
              userName: profile.full_name || profile.email,
              userEmail: profile.email,
              cvFileUrl: tailoredCvPdfUrl || cv?.cv_file_url || undefined,
              coverLetter: coverLetter || undefined,
            }),
          }
        );

        const result = await applyRes.json();
        summary.retried++;

        if (result.deliveryStatus === "delivered") {
          summary.delivered++;
        } else {
          summary.failed++;
        }
      } catch (e) {
        console.error("auto-apply rescue failed for application", app.id, e);
        summary.failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, summary, worker: WORKER_VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rescue-stalled-applications fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", summary }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    running = false;
  }
});
