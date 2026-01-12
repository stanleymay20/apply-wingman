import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCVProfile } from "./useCVProfile";
import { toast } from "sonner";

type ApplyMethod = "email" | "ats_api" | "assisted";

interface AutoApplyParams {
  applicationId: string;
  jobId: string;
  method: ApplyMethod;
  recipientEmail?: string;
  jobTitle: string;
  company: string;
  sourceUrl: string;
  sourcePlatform: string;
  coverLetter?: string;
}

interface AutoApplyResult {
  success: boolean;
  method: string;
  message: string;
  applicationUrl?: string;
  emailSent?: boolean;
  apiSubmitted?: boolean;
}

export function useAutoApply() {
  const { user, profile } = useAuth();
  const { cvProfile } = useCVProfile();
  const queryClient = useQueryClient();

  const autoApplyMutation = useMutation({
    mutationFn: async (params: AutoApplyParams): Promise<AutoApplyResult> => {
      if (!user || !profile) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("auto-apply", {
        body: {
          ...params,
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
        toast.success(`Application sent to ${params.company}!`);
      } else if (result.applicationUrl) {
        // Open the application URL
        window.open(result.applicationUrl, "_blank");
        toast.success(result.message);
      } else {
        toast.success(result.message);
      }
    },
    onError: (error) => {
      toast.error(`Auto-apply failed: ${error.message}`);
    },
  });

  // Detect best apply method for a job
  const detectApplyMethod = (sourceUrl: string, sourcePlatform: string): ApplyMethod => {
    const url = sourceUrl.toLowerCase();

    // Greenhouse and Lever have API-friendly apply flows
    if (url.includes("greenhouse.io") || url.includes("lever.co")) {
      return "ats_api";
    }

    // LinkedIn, Indeed, Workday need assisted apply
    if (url.includes("linkedin.com") || url.includes("indeed.com") || url.includes("workday")) {
      return "assisted";
    }

    // Default to assisted for unknown platforms
    return "assisted";
  };

  // Bulk auto-apply to multiple jobs
  const bulkAutoApply = async (
    jobs: Array<{
      id: string;
      applicationId?: string;
      title: string;
      company: string;
      source_url: string;
      source_platform: string;
      cover_letter?: string;
    }>,
    method?: ApplyMethod
  ) => {
    const results: Array<{ jobId: string; success: boolean; error?: string }> = [];

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

        const applyMethod = method || detectApplyMethod(job.source_url, job.source_platform);

        await autoApplyMutation.mutateAsync({
          applicationId: appId,
          jobId: job.id,
          method: applyMethod,
          jobTitle: job.title,
          company: job.company,
          sourceUrl: job.source_url,
          sourcePlatform: job.source_platform,
          coverLetter: job.cover_letter,
        });

        results.push({ jobId: job.id, success: true });

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
    toast.success(`Applied to ${successCount}/${jobs.length} jobs`);

    return results;
  };

  return {
    autoApply: autoApplyMutation.mutate,
    autoApplyAsync: autoApplyMutation.mutateAsync,
    bulkAutoApply,
    isApplying: autoApplyMutation.isPending,
    detectApplyMethod,
  };
}
