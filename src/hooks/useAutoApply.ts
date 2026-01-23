import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCVProfile } from "./useCVProfile";
import { useCVOptimization } from "./useCVOptimization";
import { useCVAutoOptimization } from "./useCVAutoOptimization";
import { toast } from "sonner";
import { 
  detectApplicationMethod, 
  shouldUseEmail,
  type ApplicationMethodType 
} from "@/lib/applicationMethods";

interface AutoApplyParams {
  applicationId: string;
  jobId: string;
  method: ApplicationMethodType | "email" | "ats_api" | "assisted";
  recipientEmail?: string;
  jobTitle: string;
  company: string;
  sourceUrl: string;
  sourcePlatform: string;
  coverLetter?: string;
  jobDescription?: string;
}

interface AutoApplyResult {
  success: boolean;
  method: string;
  message: string;
  applicationUrl?: string;
  emailSent?: boolean;
  apiSubmitted?: boolean;
  deliveryStatus?: "sent" | "failed" | "pending";
  confirmationExpected?: boolean;
}

export function useAutoApply() {
  const { user, profile } = useAuth();
  const { cvProfile } = useCVProfile();
  const { checkCVReadyForAutoApply, MIN_SCORE_FOR_AUTO_APPLY } = useCVOptimization();
  const { runAutoOptimization, isRunning: isOptimizing, TARGET_SCORE } = useCVAutoOptimization();
  const queryClient = useQueryClient();

  const autoApplyMutation = useMutation({
    mutationFn: async (params: AutoApplyParams): Promise<AutoApplyResult> => {
      if (!user || !profile) throw new Error("Not authenticated");

      // Normalize method for edge function compatibility
      let normalizedMethod = params.method;
      if (normalizedMethod.startsWith("ats_")) {
        normalizedMethod = "ats_api";
      } else if (normalizedMethod === "linkedin_easy_apply" || normalizedMethod === "company_form") {
        normalizedMethod = "assisted";
      }

      const { data, error } = await supabase.functions.invoke("auto-apply", {
        body: {
          ...params,
          method: normalizedMethod,
          userName: profile.full_name || profile.email,
          userEmail: profile.email,
          cvFileUrl: cvProfile?.cv_file_url,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Auto-apply failed");

      return data as AutoApplyResult;
    },
    onSuccess: (result, params) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });

      if (result.emailSent) {
        if (result.deliveryStatus === "sent") {
          toast.success(`Application sent to ${params.company}!`, {
            description: "Note: Email applications typically don't receive automated confirmations.",
          });
        }
      } else if (result.applicationUrl) {
        // Open the application URL
        window.open(result.applicationUrl, "_blank");
        toast.success(result.message, {
          description: result.confirmationExpected 
            ? "You should receive a confirmation email from the company."
            : "Complete your application on the opened page.",
        });
      } else {
        toast.success(result.message);
      }
    },
    onError: (error) => {
      toast.error(`Auto-apply failed: ${error.message}`);
    },
  });

  /**
   * Smart method detection - prioritizes ATS/forms over email
   */
  const detectBestMethod = (
    sourceUrl: string, 
    sourcePlatform: string,
    jobDescription?: string
  ) => {
    return detectApplicationMethod(sourceUrl, sourcePlatform, jobDescription);
  };

  /**
   * Check if email should be used for this job
   */
  const checkEmailUsage = (
    sourceUrl: string,
    sourcePlatform: string,
    jobDescription?: string
  ) => {
    return shouldUseEmail(sourceUrl, sourcePlatform, jobDescription);
  };

  /**
   * Legacy method detection for backward compatibility
   */
  const detectApplyMethod = (
    sourceUrl: string, 
    sourcePlatform: string
  ): "email" | "ats_api" | "assisted" => {
    const method = detectApplicationMethod(sourceUrl, sourcePlatform);
    
    if (method.type.startsWith("ats_")) {
      return "ats_api";
    }
    if (method.type === "email") {
      return "email";
    }
    return "assisted";
  };

  // Bulk auto-apply to multiple jobs with CV optimization check
  const bulkAutoApply = async (
    jobs: Array<{
      id: string;
      applicationId?: string;
      title: string;
      company: string;
      source_url: string;
      source_platform: string;
      description?: string;
      cover_letter?: string;
    }>,
    forceMethod?: "email" | "ats_api" | "assisted",
    skipCVCheck?: boolean
  ) => {
    const results: Array<{ 
      jobId: string; 
      success: boolean; 
      error?: string;
      method?: string;
      confirmationExpected?: boolean;
    }> = [];

    // Check CV readiness before bulk apply (unless skipped)
    if (!skipCVCheck && cvProfile?.id) {
      const cvReadiness = await checkCVReadyForAutoApply(cvProfile.id);
      
      if (!cvReadiness.ready) {
        // Auto-optimize if score is below threshold
        toast.info(
          `CV score is ${cvReadiness.score}%, auto-optimizing to ${TARGET_SCORE}%...`,
          { duration: 5000 }
        );
        
        try {
          const optimizationResult = await runAutoOptimization(
            cvProfile.id,
            {
              summary: cvProfile.summary || "",
              skills: cvProfile.skills || [],
              experienceYears: cvProfile.experience_years || undefined,
              seniorityLevel: cvProfile.seniority_level || undefined,
            }
          );
          
          if (optimizationResult && optimizationResult.finalScore >= MIN_SCORE_FOR_AUTO_APPLY) {
            toast.success(
              `CV optimized to ${optimizationResult.finalScore}%! Proceeding with applications.`,
              { duration: 4000 }
            );
          } else {
            toast.error(
              `CV optimization completed but score (${optimizationResult?.finalScore || cvReadiness.score}%) is still below ${MIN_SCORE_FOR_AUTO_APPLY}%`,
              {
                description: "Please manually review your CV before applying",
                duration: 8000,
                action: {
                  label: "View Profile",
                  onClick: () => window.location.href = "/profile",
                },
              }
            );
            
            // Return early with all jobs marked as blocked
            return jobs.map(job => ({
              jobId: job.id,
              success: false,
              error: `CV score too low after optimization`,
            }));
          }
        } catch (optimizeError) {
          console.error("Auto-optimization failed:", optimizeError);
          toast.error(
            `CV auto-optimization failed. Score: ${cvReadiness.score}%`,
            {
              description: cvReadiness.suggestions[0] || "Optimize your CV manually before applying",
              duration: 8000,
              action: {
                label: "View Suggestions",
                onClick: () => window.location.href = "/profile",
              },
            }
          );
          
          // Return early with all jobs marked as blocked
          return jobs.map(job => ({
            jobId: job.id,
            success: false,
            error: `CV score too low (${cvReadiness.score}% < ${MIN_SCORE_FOR_AUTO_APPLY}%) and auto-optimization failed`,
          }));
        }
      } else {
        toast.success(`CV score: ${cvReadiness.score}% ✓ Ready for auto-apply!`);
      }
    }

    for (const job of jobs) {
      try {
        // Create application if doesn't exist
        let appId = job.applicationId;
        if (!appId && user) {
          const { data: app } = await supabase
            .from("applications")
            .insert({
              user_id: user.id,
              job_id: job.id,
              match_score: 0,
              status: "pending",
            })
            .select()
            .single();
          appId = app?.id;
        }

        if (!appId) {
          results.push({ jobId: job.id, success: false, error: "Failed to create application" });
          continue;
        }

        // Detect best method for this job
        const detectedMethod = detectApplicationMethod(
          job.source_url, 
          job.source_platform,
          job.description
        );
        
        // Use forced method or detected method
        let applyMethod = forceMethod || detectApplyMethod(job.source_url, job.source_platform);
        
        // Warn if using email when ATS is available
        if (applyMethod === "email" && !detectedMethod.requiresEmail) {
          console.warn(`Using email for ${job.company} but ATS may be available: ${detectedMethod.label}`);
        }

        await autoApplyMutation.mutateAsync({
          applicationId: appId,
          jobId: job.id,
          method: applyMethod,
          jobTitle: job.title,
          company: job.company,
          sourceUrl: job.source_url,
          sourcePlatform: job.source_platform,
          coverLetter: job.cover_letter,
          jobDescription: job.description,
        });

        results.push({ 
          jobId: job.id, 
          success: true,
          method: applyMethod,
          confirmationExpected: detectedMethod.confirmationExpected,
        });

        // Delay between applications to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        results.push({
          jobId: job.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const emailCount = results.filter((r) => r.method === "email").length;
    const atsCount = results.filter((r) => r.method === "ats_api").length;
    
    let description = "";
    if (atsCount > 0) description += `${atsCount} via ATS (confirmation expected). `;
    if (emailCount > 0) description += `${emailCount} via email (no confirmation expected).`;
    
    toast.success(`Applied to ${successCount}/${jobs.length} jobs`, { description });

    return results;
  };

  return {
    autoApply: autoApplyMutation.mutate,
    autoApplyAsync: autoApplyMutation.mutateAsync,
    bulkAutoApply,
    isApplying: autoApplyMutation.isPending,
    detectApplyMethod,
    detectBestMethod,
    checkEmailUsage,
    checkCVReadyForAutoApply,
    MIN_SCORE_FOR_AUTO_APPLY,
  };
}
