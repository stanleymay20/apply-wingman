import { callAI, callAIJson, AIRateLimitError, AICreditsError, preflightAI, AIError } from "../_shared/aiClient.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyFromLifecycle } from "../_shared/notifications.ts";
import { classifyError, computeNextRetryAt, loadRetryConfig } from "../_shared/retry.ts";
import { prepareApplicationMaterials } from "../_shared/materials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Email sender configuration
// scrolllibrary.app is a VERIFIED sending domain in Resend, so emails to real
// recruiter inboxes will deliver. Override with the SENDER_EMAIL secret if you
// want to send from a different verified domain/address.
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") ?? "stanley@scrolllibrary.app";
const SENDER_NAME = "ApplyPilot";
const REPLY_TO_EMAIL = Deno.env.get("REPLY_TO_EMAIL");


// Application cap - raised for real usage
const MAX_DAILY_APPLICATIONS = 200;

interface ApplyRequest {
  applicationId: string;
  jobId: string;
  method: "email" | "ats_api" | "assisted";
  recipientEmail?: string;
  userName: string;
  userEmail: string;
  cvFileUrl?: string;
  coverLetter?: string;
  jobTitle: string;
  company: string;
  sourceUrl: string;
  sourcePlatform: string;
  runId?: string;
  correlationId?: string;
}

// deliveryStatus is the SINGLE source of truth for the UI.
// - "delivered": provider accepted (e.g. Resend returned an id) and we persisted it
// - "manual_action_required": ATS / assisted handoff; user must finish in browser
// - "failed": terminal failure
// - "retrying": transient failure scheduled for retry
interface ApplyResult {
  success: boolean;
  method: string;
  message: string;
  applicationUrl?: string;
  emailSent?: boolean;
  apiSubmitted?: boolean;
  deliveryStatus: "delivered" | "manual_action_required" | "failed" | "retrying";
  emailId?: string;
}

// Input validation
function validateApplyRequest(data: unknown): { valid: boolean; error?: string; data?: ApplyRequest } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const req = data as Record<string, unknown>;

  // Required fields
  const requiredFields = ["applicationId", "jobId", "method", "userName", "userEmail", "jobTitle", "company", "sourceUrl", "sourcePlatform"];
  for (const field of requiredFields) {
    if (!req[field] || typeof req[field] !== "string") {
      return { valid: false, error: `Missing or invalid required field: ${field}` };
    }
  }

  // Validate method
  if (!["email", "ats_api", "assisted"].includes(req.method as string)) {
    return { valid: false, error: "Invalid method. Must be 'email', 'ats_api', or 'assisted'" };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(req.userEmail as string)) {
    return { valid: false, error: "Invalid user email format" };
  }

  if (req.recipientEmail && !emailRegex.test(req.recipientEmail as string)) {
    return { valid: false, error: "Invalid recipient email format" };
  }

  // Validate string lengths
  if ((req.userName as string).length > 200) {
    return { valid: false, error: "User name too long (max 200 chars)" };
  }

  if ((req.jobTitle as string).length > 500) {
    return { valid: false, error: "Job title too long (max 500 chars)" };
  }

  if ((req.company as string).length > 500) {
    return { valid: false, error: "Company name too long (max 500 chars)" };
  }

  if (req.coverLetter && (req.coverLetter as string).length > 10000) {
    return { valid: false, error: "Cover letter too long (max 10000 chars)" };
  }

  return {
    valid: true,
    data: {
      applicationId: req.applicationId as string,
      jobId: req.jobId as string,
      method: req.method as "email" | "ats_api" | "assisted",
      recipientEmail: req.recipientEmail as string | undefined,
      userName: req.userName as string,
      userEmail: req.userEmail as string,
      cvFileUrl: req.cvFileUrl as string | undefined,
      coverLetter: req.coverLetter as string | undefined,
      jobTitle: req.jobTitle as string,
      company: req.company as string,
      sourceUrl: req.sourceUrl as string,
      sourcePlatform: req.sourcePlatform as string,
      runId: typeof req.runId === "string" ? req.runId : undefined,
      correlationId: typeof req.correlationId === "string" ? req.correlationId : undefined,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");

  // ===== AUTHENTICATION =====
  // Support both user JWT auth and service-role internal calls
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized - missing auth token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  let userId: string;

  // Check if this is a service-role internal call
  if (token === supabaseServiceKey) {
    // Internal call from scheduled-automation — userId must be in the body
    const bodyClone = req.clone();
    const bodyData = await bodyClone.json();
    if (!bodyData.userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Internal call missing userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = bodyData.userId;
    console.log(`Internal service call for user: ${userId}`);
  } else {
    // User JWT auth
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error("JWT validation failed:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized - invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = claimsData.claims.sub as string;
  }
  console.log(`Authenticated user for auto-apply: ${userId}`);
  // ===== END AUTHENTICATION =====

  // Use service role for database operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse and validate input
    const rawRequest = await req.json();
    const validation = validateApplyRequest(rawRequest);

    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI health preflight — per-job CV/cover-letter tailoring requires AI.
    // Without a configured provider we cannot produce tailored materials, so
    // block rather than silently sending a generic application.
    try {
      await preflightAI();
    } catch (e) {
      if (e instanceof AIError) {
        return new Response(
          JSON.stringify({ success: false, error: e.message, code: "AI_NOT_CONFIGURED", deliveryStatus: "failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }

    const request = validation.data;
    const {
      applicationId,
      jobId,
      method,
      recipientEmail,
      userName,
      userEmail,
      cvFileUrl,
      coverLetter,
      jobTitle,
      company,
      sourceUrl,
      sourcePlatform,
    } = request;

    console.log(`Auto-apply request: ${method} for ${jobTitle} at ${company}`);
    console.log(`User: ${userName} (${userEmail}), Application ID: ${applicationId}`);

    // Check daily application cap
    if (method === "email") {
      const today = new Date().toISOString().split("T")[0];
      const { data: todayApps } = await supabase
        .from("application_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("action", "auto_apply_email")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);

      const todayCount = todayApps?.length || 0;
      if (todayCount >= MAX_DAILY_APPLICATIONS) {
        const errorMsg = `Daily application limit reached (${MAX_DAILY_APPLICATIONS}). Contact support to increase.`;
        console.warn(errorMsg);
        
        // Log the rate limit
        await supabase.from("application_logs").insert({
          user_id: userId,
          application_id: applicationId,
          job_id: jobId,
          action: "auto_apply_rate_limited",
          message: errorMsg,
          level: "warning",
          details: { limit: MAX_DAILY_APPLICATIONS, current: todayCount },
        });

        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== LIFECYCLE: queued → preparing → (submitted → delivered) | manual_action_required | failed | retrying =====
    await transition(supabase, {
      userId, applicationId, jobId, jobTitle, company,
      status: "queued", action: "lifecycle_queued", level: "info",
      message: `Queued ${jobTitle} at ${company} for ${method} apply`,
      details: { method, sourcePlatform },
    });

    await transition(supabase, {
      userId, applicationId, jobId, jobTitle, company,
      status: "preparing", action: "lifecycle_preparing", level: "info",
      message: `Preparing ${method} application payload`,
      details: { method },
    });

    // ===== PER-JOB TAILORED MATERIALS =====
    // Ensure EVERY application (including manual/bulk from the UI) applies with a
    // job-specific tailored CV + cover letter — never a generic one. Materials
    // are cached on the application row, so this is idempotent and cheap on
    // retries or when a caller (scheduled-automation / drain) already tailored.
    let effectiveCvFileUrl = cvFileUrl;
    let effectiveCoverLetter = coverLetter;
    try {
      const [{ data: jobRow }, { data: cvRow }] = await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, company, description, requirements, location")
          .eq("id", jobId)
          .maybeSingle(),
        (async () => {
          const { data: app } = await supabase
            .from("applications")
            .select("cv_profile_id")
            .eq("id", applicationId)
            .maybeSingle();
          const cvQuery = supabase
            .from("cv_profiles")
            .select("id, cv_file_url, summary, skills, work_history, experience_years, seniority_level");
          if (app?.cv_profile_id) {
            return await cvQuery.eq("id", app.cv_profile_id).maybeSingle();
          }
          return await cvQuery
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
        })(),
      ]);

      if (jobRow && cvRow) {
        const materials = await prepareApplicationMaterials(supabase, {
          userId,
          applicationId,
          userName,
          job: {
            id: jobRow.id,
            title: jobRow.title ?? jobTitle,
            company: jobRow.company ?? company,
            description: jobRow.description,
            requirements: jobRow.requirements,
            location: jobRow.location,
          },
          cvProfile: cvRow,
        });
        // Prefer freshly tailored materials over any generic ones passed in.
        if (materials.tailoredCvPdfUrl) effectiveCvFileUrl = materials.tailoredCvPdfUrl;
        else if (!effectiveCvFileUrl && cvRow.cv_file_url) effectiveCvFileUrl = cvRow.cv_file_url;
        if (materials.coverLetter) effectiveCoverLetter = materials.coverLetter;
      }
    } catch (matErr) {
      // Best-effort: never block the apply on tailoring failure.
      console.warn(`[auto-apply] tailoring failed for app ${applicationId}:`, matErr);
    }

    let result: ApplyResult;

    // Method 1: Email Application
    if (method === "email") {
      if (!resendKey) {
        const error = "Email sending not configured. Please add RESEND_API_KEY.";
        await logError(supabase, userId, applicationId, jobId, error, "config_error");
        throw new Error(error);
      }

      if (!recipientEmail) {
        const error = "Recipient email is required for email applications";
        await logError(supabase, userId, applicationId, jobId, error, "validation_error");
        throw new Error(error);
      }

      const resend = new Resend(resendKey);

      // ===== DELIVERY MODE ROUTING =====
      // Read user's delivery mode + test email override.
      const { data: deliveryProfile } = await supabase
        .from("profiles")
        .select("delivery_mode, test_email_override")
        .eq("id", userId)
        .maybeSingle();

      const deliveryMode = (deliveryProfile?.delivery_mode as string) || "test";
      const testOverride = (deliveryProfile?.test_email_override as string) || userEmail;

      const originalRecipient = recipientEmail;
      let actualRecipient = recipientEmail;

      if (deliveryMode === "disabled") {
        const msg = `Delivery is disabled in user settings. Email NOT sent to ${recipientEmail}.`;
        console.warn(msg);
        await transition(supabase, {
          userId, applicationId, jobId, jobTitle, company,
          status: "manual_action_required",
          action: "auto_apply_email_blocked",
          level: "warning",
          message: msg,
          details: { originalRecipient, deliveryMode },
          fields: {
            original_recipient: originalRecipient,
            actual_recipient: null,
            delivery_mode: deliveryMode,
            error_message: "Delivery disabled in settings",
            application_method: "email",
          },
        });
        return new Response(
          JSON.stringify({
            success: false,
            status: "manual_action_required",
            message: msg,
            deliveryMode,
            originalRecipient,
            retryable: false,
            deliveryStatus: "manual_action_required",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (deliveryMode === "test") {
        actualRecipient = testOverride;
        console.log(`[TEST MODE] Redirecting recipient ${originalRecipient} -> ${actualRecipient}`);
      }
      // ===== END DELIVERY MODE ROUTING =====

      // Generate professional application email using AI
      let emailBody = effectiveCoverLetter || "";
      if (!emailBody) {
        try {
          emailBody = await callAI({
            messages: [
              {
                role: "system",
                content: "You write professional, concise job application emails. No fluff, just genuine interest and relevant qualifications.",
              },
              {
                role: "user",
                content: `Write a brief application email for:
Position: ${jobTitle}
Company: ${company}
Applicant: ${userName}

Keep it under 150 words. Professional but personable. End with expressing enthusiasm to discuss further.`,
              },
            ],
            temperature: 0.6,
          });
        } catch (e) {
          console.warn("AI email generation failed, using default body:", e);
        }
      }

      if (!emailBody) {
        emailBody = `Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position at ${company}. I believe my skills and experience make me a strong candidate for this role.

Please find my resume attached for your review. I would welcome the opportunity to discuss how I can contribute to your team.

Thank you for considering my application.

Best regards,
${userName}`;
      }

      // Build attachments array
      const attachments: { filename: string; path: string }[] = [];
      if (effectiveCvFileUrl) {
        attachments.push({
          filename: `${userName.replace(/\s+/g, "_")}_Resume.pdf`,
          path: effectiveCvFileUrl,
        });
      }

      const testBanner =
        deliveryMode === "test"
          ? `<div style="background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:12px;border-radius:6px;margin-bottom:16px;font-size:13px;">
              <strong>⚠ TEST MODE</strong> — This email was redirected from <code>${originalRecipient}</code> to your test inbox. No real recruiter received it.
            </div>`
          : "";

      const subjectPrefix = deliveryMode === "test" ? "[TEST] " : "";

      console.log(`Sending email from ${SENDER_EMAIL} to ${actualRecipient} (mode=${deliveryMode}, original=${originalRecipient})`);

      // Mark as submitted (handed off to Resend) BEFORE we know delivery status
      await transition(supabase, {
        userId, applicationId, jobId, jobTitle, company,
        status: "submitted",
        action: "lifecycle_submitted",
        level: "info",
        message: `Handing off email to Resend → ${actualRecipient}`,
        details: { originalRecipient, actualRecipient, deliveryMode, senderEmail: SENDER_EMAIL },
        fields: {
          application_method: "email",
          original_recipient: originalRecipient,
          actual_recipient: actualRecipient,
          delivery_mode: deliveryMode,
        },
      });

      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `${userName} via ${SENDER_NAME} <${SENDER_EMAIL}>`,
          to: [actualRecipient],
          reply_to: REPLY_TO_EMAIL || userEmail,
          subject: `${subjectPrefix}Application for ${jobTitle} - ${userName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              ${testBanner}
              ${emailBody.split("\n").map((p) => `<p style="margin: 0 0 16px 0;">${p}</p>`).join("")}
              <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0;" />
              <p style="color: #666; font-size: 12px;">
                This application was sent via ApplyPilot on behalf of ${userName} (${userEmail})
              </p>
            </div>
          `,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        if (emailError) {
          console.error("Resend API error:", emailError);
          const outcome = await handleFailure(supabase, {
            userId, applicationId, jobId, jobTitle, company,
            action: "lifecycle_email_failed",
            rawMessage: emailError.message,
            providerContext: { originalRecipient, actualRecipient, deliveryMode, provider: "resend" },
          });
          await bumpFailedStats(supabase, userId);
          return new Response(
            JSON.stringify({ success: false, status: outcome.status, error: emailError.message, retryable: outcome.retryable, nextRetryAt: outcome.nextRetryAt, deliveryStatus: "failed" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Email sent successfully:", emailData);

        const deliveredLabel =
          deliveryMode === "test"
            ? `[TEST] ${actualRecipient} (would be ${originalRecipient})`
            : actualRecipient;

        // Resend accepted → mark delivered (with provider id as proof)
        const providerMessageId = emailData?.id ?? null;
        if (!providerMessageId) {
          // Defensive: Resend returned no id but no error — treat as unverified.
          await transition(supabase, {
            userId, applicationId, jobId, jobTitle, company,
            status: "submitted",
            action: "lifecycle_unverified",
            level: "warning",
            message: `⚠ Resend returned no id — cannot verify delivery to ${actualRecipient}`,
            details: { originalRecipient, actualRecipient, deliveryMode },
          });
          return new Response(
            JSON.stringify({ success: false, status: "submitted", error: "Provider did not return a message id; delivery unverified", retryable: true, deliveryStatus: "failed" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const verifiedAt = new Date().toISOString();
        await transition(supabase, {
          userId, applicationId, jobId, jobTitle, company,
          status: "delivered",
          action: "lifecycle_delivered",
          level: "info",
          message:
            deliveryMode === "test"
              ? `🧪 TEST email delivered to ${actualRecipient} (intercepted from ${originalRecipient})`
              : `✅ Email delivered to ${actualRecipient}`,
          details: { originalRecipient, actualRecipient, deliveryMode, providerMessageId, senderEmail: SENDER_EMAIL },
          fields: {
            applied_at: verifiedAt,
            delivery_provider: "resend",
            delivery_provider_message_id: providerMessageId,
            delivery_verified_at: verifiedAt,
          },
        });

        // In-app notification is emitted by transition() → notifyFromLifecycle (rules engine).


        result = {
          success: true,
          method: "email",
          message: `Application email delivered to ${deliveredLabel}`,
          emailSent: true,
          deliveryStatus: "delivered",
          emailId: providerMessageId,
        };

      } catch (sendError) {
        const errorMessage = sendError instanceof Error ? sendError.message : "Unknown email error";
        console.error("Email send failed (network/exception):", errorMessage);
        const outcome = await handleFailure(supabase, {
          userId, applicationId, jobId, jobTitle, company,
          action: "lifecycle_email_exception",
          rawMessage: errorMessage,
          providerContext: { originalRecipient, actualRecipient, deliveryMode, provider: "resend", exception: true },
        });
        await bumpFailedStats(supabase, userId);
        return new Response(
          JSON.stringify({ success: false, status: outcome.status, error: errorMessage, retryable: outcome.retryable, nextRetryAt: outcome.nextRetryAt, deliveryStatus: "failed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Method 2: ATS API Integration (Greenhouse, Lever)
    else if (method === "ats_api") {
      const url = sourceUrl.toLowerCase();
      let apiMessage = "";

      // Greenhouse integration
      if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) {
        const ghMatch = url.match(/\/jobs\/(\d+)|gh_jid=(\d+)/);
        const ghJobId = ghMatch?.[1] || ghMatch?.[2];

        if (ghJobId) {
          apiMessage = `Greenhouse job detected (ID: ${ghJobId}). Opening application form with pre-filled data.`;
          const applyUrl = `${sourceUrl}${sourceUrl.includes("?") ? "&" : "?"}name=${encodeURIComponent(userName)}&email=${encodeURIComponent(userEmail)}`;
          
          result = {
            success: true,
            method: "ats_api",
            message: apiMessage,
            applicationUrl: applyUrl,
            apiSubmitted: false,
            deliveryStatus: "manual_action_required",
          };
        } else {
          throw new Error("Could not extract Greenhouse job ID");
        }
      }
      // Lever integration
      else if (url.includes("lever.co")) {
        const leverMatch = url.match(/lever\.co\/([^/]+)\/([a-f0-9-]+)/);
        const leverCompany = leverMatch?.[1];
        const leverJobId = leverMatch?.[2];

        if (leverJobId) {
          apiMessage = `Lever job detected (ID: ${leverJobId}). Opening application form.`;
          const applyUrl = `https://jobs.lever.co/${leverCompany}/${leverJobId}/apply`;

          result = {
            success: true,
            method: "ats_api",
            message: apiMessage,
            applicationUrl: applyUrl,
            apiSubmitted: false,
            deliveryStatus: "manual_action_required",
          };
        } else {
          throw new Error("Could not extract Lever job ID");
        }
      }
      // Workday - complex, use assisted
      else if (url.includes("workday")) {
        result = {
          success: true,
          method: "ats_api",
          message: "Workday requires manual application. Opening job page.",
          applicationUrl: sourceUrl,
          apiSubmitted: false,
          deliveryStatus: "manual_action_required",
        };
      }
      // Unknown ATS - fallback to assisted
      else {
        result = {
          success: true,
          method: "ats_api",
          message: `Unknown ATS platform. Opening job page for manual application.`,
          applicationUrl: sourceUrl,
          apiSubmitted: false,
          deliveryStatus: "manual_action_required",
        };
      }

      // ATS path never confirms true submission server-side → user must finish in-browser
      const finalStatus = result.apiSubmitted ? "delivered" : "manual_action_required";
      await transition(supabase, {
        userId, applicationId, jobId, jobTitle, company,
        status: finalStatus,
        action: "lifecycle_ats_handoff",
        level: "info",
        message: result.apiSubmitted
          ? `✅ ATS submission confirmed: ${result.message}`
          : `📝 Action needed — open ${result.applicationUrl || sourceUrl} to finish the ATS form`,
        details: { applicationUrl: result.applicationUrl, sourcePlatform, apiSubmitted: result.apiSubmitted },
        fields: { application_method: "form_submit" },
      });
      result.deliveryStatus = finalStatus === "delivered" ? "delivered" : "manual_action_required";
      result.message = `${result.message} (status: ${finalStatus})`;
    }
    // Method 3: Assisted Apply
    else if (method === "assisted") {
      result = {
        success: true,
        method: "assisted",
        message: "Application data prepared. Open the job link and paste your details.",
        applicationUrl: sourceUrl,
        deliveryStatus: "manual_action_required",
      };

      // Assisted apply requires manual user action → never auto-success
      await transition(supabase, {
        userId, applicationId, jobId, jobTitle, company,
        status: "manual_action_required",
        action: "lifecycle_assisted_handoff",
        level: "info",
        message: `📝 Assisted apply prepared — open ${sourceUrl} and submit manually`,
        details: { applicationUrl: sourceUrl, sourcePlatform },
        fields: { application_method: "manual" },
      });
      result.message = `${result.message} (status: manual_action_required)`;
    } else {
      throw new Error(`Unknown apply method: ${method}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-apply error:", error);
    const errorMessage = error instanceof Error ? error.message : "Auto-apply failed";

    let outcome: { status: "retrying" | "failed"; retryable: boolean; nextRetryAt?: string } = {
      status: "failed", retryable: false,
    };
    try {
      const body = await req.clone().json().catch(() => ({} as any));
      if (body?.applicationId && userId) {
        outcome = await handleFailure(supabase, {
          userId,
          applicationId: body.applicationId,
          jobId: body.jobId ?? "",
          jobTitle: body.jobTitle ?? "",
          company: body.company ?? "",
          action: "lifecycle_unhandled_error",
          rawMessage: errorMessage,
        });
      }
    } catch (logErr) {
      console.error("Failed to log unhandled error:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: outcome.status,
        error: errorMessage,
        retryable: outcome.retryable,
        nextRetryAt: outcome.nextRetryAt,
        deliveryStatus: "failed",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to log errors
async function logError(
  supabase: any,
  userId: string,
  applicationId: string,
  jobId: string,
  errorMessage: string,
  errorType: string
) {
  await supabase.from("application_logs").insert({
    user_id: userId,
    application_id: applicationId,
    job_id: jobId,
    action: `auto_apply_error_${errorType}`,
    message: `❌ ${errorMessage}`,
    level: "error",
    details: { errorType, errorMessage },
  });
}

// Bump failed counter in daily_stats
async function bumpFailedStats(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];
  const { data: existingStats } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (existingStats) {
    await supabase
      .from("daily_stats")
      .update({ applications_failed: (existingStats.applications_failed || 0) + 1 })
      .eq("id", existingStats.id);
  } else {
    await supabase.from("daily_stats").insert({
      user_id: userId,
      date: today,
      applications_failed: 1,
    });
  }
}

// Retry classification has moved to ../_shared/retry.ts (classifyError).

// Atomic-ish lifecycle transition: update applications row + write audit log
async function transition(
  supabase: any,
  params: {
    userId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    company: string;
    status: string;
    action: string;
    level: "info" | "warning" | "error";
    message: string;
    details?: Record<string, unknown>;
    fields?: Record<string, unknown>;
  }
) {
  const { userId, applicationId, jobId, status, action, level, message, details = {}, fields = {} } = params;

  const update: Record<string, unknown> = { status, ...fields };
  const { error: updateError } = await supabase
    .from("applications")
    .update(update)
    .eq("id", applicationId);

  if (updateError) {
    console.error(`[transition→${status}] Failed to update application ${applicationId}:`, updateError);
    await supabase.from("application_logs").insert({
      user_id: userId,
      application_id: applicationId,
      job_id: jobId,
      action: "lifecycle_update_failed",
      level: "error",
      message: `Failed to write status=${status}: ${updateError.message}`,
      details: { attemptedStatus: status, updateError: updateError.message, ...details },
    });
    return;
  }

  await supabase.from("application_logs").insert({
    user_id: userId,
    application_id: applicationId,
    job_id: jobId,
    action,
    level,
    message,
    details: { status, ...details },
  });

  // Fire lifecycle notification (cooldown/dedup handled inside helper; never throws).
  if (["delivered", "manual_action_required", "failed", "retrying", "responded"].includes(status)) {
    await notifyFromLifecycle(supabase, {
      userId,
      applicationId,
      status,
      jobTitle: params.jobTitle,
      company: params.company,
      errorMessage: typeof (details as any)?.error === "string" ? (details as any).error : message,
      extra: { action },
    });
  }
}

/**
 * Centralized failure handler.
 * - Classifies error (retryable vs terminal).
 * - Increments retry_count.
 * - Computes next_retry_at via exponential backoff + jitter (when retryable).
 * - Dead-letters once retry_count >= max_retries.
 * - Always writes application_logs + lifecycle notification via transition().
 */
async function handleFailure(
  supabase: any,
  params: {
    userId: string;
    applicationId: string;
    jobId: string;
    jobTitle: string;
    company: string;
    action: string;
    rawMessage: string;
    providerStatus?: number;
    providerContext?: Record<string, unknown>;
  },
): Promise<{ status: "retrying" | "failed"; retryable: boolean; nextRetryAt?: string; dead_lettered: boolean }> {
  const cls = classifyError(params.rawMessage, params.providerStatus);
  const cfg = await loadRetryConfig(supabase);

  // Load current retry state.
  const { data: appRow } = await supabase
    .from("applications")
    .select("retry_count, max_retries, first_failure_at, idempotency_key")
    .eq("id", params.applicationId)
    .maybeSingle();

  const prevRetryCount: number = appRow?.retry_count ?? 0;
  const maxRetries: number = appRow?.max_retries ?? cfg.max_retries;
  const nextRetryCount = prevRetryCount + 1;
  const nowIso = new Date().toISOString();

  const willRetry = cls.retryable && nextRetryCount <= maxRetries;
  const status: "retrying" | "failed" = willRetry ? "retrying" : "failed";
  const nextRetryAt = willRetry ? computeNextRetryAt(prevRetryCount, cfg).toISOString() : null;
  const deadLettered = !willRetry && cls.retryable; // we hit cap on a retryable error

  const fields: Record<string, unknown> = {
    retry_count: nextRetryCount,
    last_retry_reason: cls.retry_reason,
    error_code: cls.error_code,
    error_message: cls.normalized_message.slice(0, 1000),
    last_failure_at: nowIso,
    first_failure_at: appRow?.first_failure_at ?? nowIso,
    next_retry_at: nextRetryAt,
    provider_context: params.providerContext ?? null,
  };
  if (status === "failed") {
    fields.dead_lettered_at = deadLettered ? nowIso : null;
  }

  await transition(supabase, {
    userId: params.userId,
    applicationId: params.applicationId,
    jobId: params.jobId,
    jobTitle: params.jobTitle,
    company: params.company,
    status,
    action: params.action,
    level: "error",
    message: willRetry
      ? `Retry scheduled (${nextRetryCount}/${maxRetries}) — ${cls.retry_reason}: ${cls.normalized_message}`
      : `Failed (${cls.retry_reason}): ${cls.normalized_message}`,
    details: {
      error_code: cls.error_code,
      retry_reason: cls.retry_reason,
      retryable: cls.retryable,
      retry_count: nextRetryCount,
      max_retries: maxRetries,
      next_retry_at: nextRetryAt,
      dead_lettered: deadLettered,
      provider_status: params.providerStatus,
    },
    fields,
  });

  // Write to automation_failures ledger.
  await supabase.from("automation_failures").insert({
    user_id: params.userId,
    application_id: params.applicationId,
    error_code: cls.error_code,
    error_message: cls.normalized_message.slice(0, 1000),
    retryable: cls.retryable,
    retry_count: nextRetryCount,
    dead_lettered: deadLettered,
    context: {
      action: params.action,
      retry_reason: cls.retry_reason,
      provider_status: params.providerStatus,
      provider_context: params.providerContext ?? null,
    },
  });

  return { status, retryable: cls.retryable, nextRetryAt: nextRetryAt ?? undefined, dead_lettered: deadLettered };
}
