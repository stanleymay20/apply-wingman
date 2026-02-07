import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Production email sender configuration
const SENDER_EMAIL = "jobs@scrolllibrary.app";
const SENDER_NAME = "ApplyPilot";

// Application cap - raised for real usage
const MAX_DAILY_APPLICATIONS = 25;

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
}

interface ApplyResult {
  success: boolean;
  method: string;
  message: string;
  applicationUrl?: string;
  emailSent?: boolean;
  apiSubmitted?: boolean;
  deliveryStatus?: "sent" | "failed";
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
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

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
          level: "warn",
          details: { limit: MAX_DAILY_APPLICATIONS, current: todayCount },
        });

        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

      // Generate professional application email using AI
      let emailBody = coverLetter || "";
      if (!emailBody && lovableKey) {
        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
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
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            emailBody = aiData.choices?.[0]?.message?.content || "";
          }
        } catch (e) {
          console.warn("AI email generation failed:", e);
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
      if (cvFileUrl) {
        attachments.push({
          filename: `${userName.replace(/\s+/g, "_")}_Resume.pdf`,
          path: cvFileUrl,
        });
      }

      console.log(`Sending email from ${SENDER_EMAIL} to ${recipientEmail}`);

      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `${userName} via ${SENDER_NAME} <${SENDER_EMAIL}>`,
          to: [recipientEmail],
          reply_to: userEmail,
          subject: `Application for ${jobTitle} - ${userName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
          
          // Log delivery failure
          await logDeliveryFailure(supabase, userId, applicationId, jobId, recipientEmail, emailError.message, jobTitle, company);
          
          throw new Error(`Email delivery failed: ${emailError.message}`);
        }

        console.log("Email sent successfully:", emailData);

        result = {
          success: true,
          method: "email",
          message: `Application email sent to ${recipientEmail}`,
          emailSent: true,
          deliveryStatus: "sent",
          emailId: emailData?.id,
        };

        // Update application status
        const { error: updateError } = await supabase
          .from("applications")
          .update({
            status: "submitted",
            applied_at: new Date().toISOString(),
            application_method: "email",
          })
          .eq("id", applicationId);

        if (updateError) {
          console.error("Failed to update application:", updateError);
        }

        // Log successful delivery
        await supabase.from("application_logs").insert({
          user_id: userId,
          application_id: applicationId,
          job_id: jobId,
          action: "auto_apply_email",
          message: `✅ Email delivered to ${recipientEmail}`,
          level: "info",
          details: { 
            recipientEmail, 
            emailId: emailData?.id,
            deliveryStatus: "sent",
            senderEmail: SENDER_EMAIL,
          },
        });

        // Create success notification
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "application_sent",
          title: "✅ Application Delivered!",
          message: `Your application for ${jobTitle} at ${company} was emailed to ${recipientEmail}`,
          data: { 
            applicationId, 
            jobId, 
            recipientEmail, 
            emailId: emailData?.id,
            deliveryStatus: "sent",
          },
        });

      } catch (sendError) {
        const errorMessage = sendError instanceof Error ? sendError.message : "Unknown email error";
        console.error("Email send failed:", errorMessage);
        
        // Already logged in logDeliveryFailure if it was a Resend error
        if (!errorMessage.includes("Email delivery failed")) {
          await logDeliveryFailure(supabase, userId, applicationId, jobId, recipientEmail, errorMessage, jobTitle, company);
        }
        
        throw sendError;
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
        };
      }

      // Update application with pending status
      await supabase
        .from("applications")
        .update({
          status: result.apiSubmitted ? "submitted" : "pending",
          application_method: "ats_api",
        })
        .eq("id", applicationId);
    }
    // Method 3: Assisted Apply
    else if (method === "assisted") {
      result = {
        success: true,
        method: "assisted",
        message: "Application data prepared. Open the job link and paste your details.",
        applicationUrl: sourceUrl,
      };

      // Mark as pending (user will confirm when done)
      await supabase
        .from("applications")
        .update({
          status: "pending",
          application_method: "assisted",
        })
        .eq("id", applicationId);
    } else {
      throw new Error(`Unknown apply method: ${method}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-apply error:", error);
    const errorMessage = error instanceof Error ? error.message : "Auto-apply failed";
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        deliveryStatus: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

// Helper function to log delivery failures with notification
async function logDeliveryFailure(
  supabase: any,
  userId: string,
  applicationId: string,
  jobId: string,
  recipientEmail: string,
  errorMessage: string,
  jobTitle: string,
  company: string
) {
  // Update application with error
  await supabase
    .from("applications")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", applicationId);

  // Log the failure
  await supabase.from("application_logs").insert({
    user_id: userId,
    application_id: applicationId,
    job_id: jobId,
    action: "auto_apply_email_failed",
    message: `❌ Email delivery failed to ${recipientEmail}: ${errorMessage}`,
    level: "error",
    details: { 
      recipientEmail, 
      errorMessage,
      deliveryStatus: "failed",
    },
  });

  // Create failure notification
  await supabase.from("notifications").insert({
    user_id: userId,
    type: "application_failed",
    title: "❌ Email Delivery Failed",
    message: `Failed to send application for ${jobTitle} at ${company} to ${recipientEmail}. Error: ${errorMessage}`,
    data: { 
      applicationId, 
      jobId, 
      recipientEmail, 
      errorMessage,
      deliveryStatus: "failed",
    },
  });

  // Increment error count in daily stats
  const today = new Date().toISOString().split("T")[0];
  const { data: existingStats } = await supabase
    .from("daily_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .single();

  if (existingStats) {
    await supabase
      .from("daily_stats")
      .update({
        applications_failed: (existingStats.applications_failed || 0) + 1,
      })
      .eq("id", existingStats.id);
  } else {
    await supabase.from("daily_stats").insert({
      user_id: userId,
      date: today,
      applications_failed: 1,
    });
  }
}
