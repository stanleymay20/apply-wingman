import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScoreResult {
  score: number;
  suggestions: {
    category: string;
    priority: string;
    suggestion: string;
  }[];
  strengths: string[];
  missing_elements: string[];
  keyword_density: string;
}

interface ScoreParams {
  cvProfileId: string;
  cvText: string;
  skills?: string[];
  experience_years?: number;
  seniority_level?: string;
}

export function useResumeScore() {
  const queryClient = useQueryClient();

  const scoreMutation = useMutation({
    mutationFn: async (params: ScoreParams): Promise<ScoreResult> => {
      const { data, error } = await supabase.functions.invoke("score-resume", {
        body: {
          cvText: params.cvText,
          skills: params.skills,
          experience_years: params.experience_years,
          seniority_level: params.seniority_level,
        },
      });

      if (error) {
        // Try to extract real error body from the function response
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch {}
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      // Save score to database
      const { error: updateError } = await supabase
        .from("cv_profiles")
        .update({
          resume_score: data.score,
          ats_suggestions: data,
        })
        .eq("id", params.cvProfileId);

      if (updateError) {
        console.error("Failed to save score:", updateError);
      }

      return data as ScoreResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cv-profile"] });
      toast.success("Resume scored successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to score resume: ${error.message}`);
    },
  });

  return {
    scoreResume: scoreMutation.mutate,
    scoreResumeAsync: scoreMutation.mutateAsync,
    isScoring: scoreMutation.isPending,
    scoreResult: scoreMutation.data,
  };
}
