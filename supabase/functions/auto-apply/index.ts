import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApplyRequest {
  applicationId: string;
  jobId: string;
  method: "email" | "ats_api" | "assisted";
  // For email applications
  recipientEmail?: string;
  // User details
  userName: string;
  userEmail: string;
  cvFileUrl?: string;
  coverLetter?: string;
  // Job details
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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: ApplyRequest = await req.json();
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

    let result: ApplyResult;

    // Method 1: Email Application
    if (method === "email") {
      if (!resendKey) {
        throw new Error("Email sending not configured. Please add RESEND_API_KEY.");
      }

      if (!recipientEmail) {
        throw new Error("Recipient email is required for email applications");
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

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: `${userName} <applications@resend.dev>`,
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
        throw new Error(`Email failed: ${emailError.message}`);
      }

      result = {
        success: true,
        method: "email",
        message: `Application email sent to ${recipientEmail}`,
        emailSent: true,
      };

      // Update application status
      await supabase
        .from("applications")
        .update({
          status: "submitted",
          applied_at: new Date().toISOString(),
          application_method: "email",
        })
        .eq("id", applicationId);

      // Log the action
      await supabase.from("application_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        application_id: applicationId,
        job_id: jobId,
        action: "auto_apply_email",
        message: `Application email sent to ${recipientEmail}`,
        level: "info",
        details: { recipientEmail, emailId: emailData?.id },
      });
    }
    // Method 2: ATS API Integration (Greenhouse, Lever)
    else if (method === "ats_api") {
      const url = sourceUrl.toLowerCase();
      let submitted = false;
      let apiMessage = "";

      // Greenhouse integration
      if (url.includes("greenhouse.io") || url.includes("boards.greenhouse")) {
        // Extract job ID from Greenhouse URL
        const ghMatch = url.match(/\/jobs\/(\d+)|gh_jid=(\d+)/);
        const ghJobId = ghMatch?.[1] || ghMatch?.[2];

        if (ghJobId) {
          // Greenhouse has a public application API
          // Note: This requires the company to enable API applications
          apiMessage = `Greenhouse job detected (ID: ${ghJobId}). Direct API submission requires company approval. Opening application form with pre-filled data.`;
          
          // For now, we'll use assisted apply with pre-filled URL params
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
        // Extract job ID from Lever URL
        const leverMatch = url.match(/lever\.co\/([^/]+)\/([a-f0-9-]+)/);
        const leverCompany = leverMatch?.[1];
        const leverJobId = leverMatch?.[2];

        if (leverJobId) {
          // Lever has a public postings API
          // Submit application via Lever API
          apiMessage = `Lever job detected (ID: ${leverJobId}). Opening application form.`;
          
          // Lever apply URL with prefill
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
      // Prepare clipboard data
      const clipboardData = {
        name: userName,
        email: userEmail,
        coverLetter: coverLetter || "",
        jobTitle,
        company,
        applyUrl: sourceUrl,
      };

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
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Auto-apply failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
