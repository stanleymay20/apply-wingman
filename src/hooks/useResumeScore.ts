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

export class ResumeScoreUnavailableError extends Error {
  code?: string;
  retryable: boolean;

  constructor(message: string, code?: string, retryable = false) {
    super(message);
    this.name = "ResumeScoreUnavailableError";
    this.code = code;
    this.retryable = retryable;
  }
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

      if (error) throw new ResumeScoreUnavailableError(error.message, "EDGE_FUNCTION_ERROR", false);
      if (data?.unavailable) {
        throw new ResumeScoreUnavailableError(
          data.error || "AI scoring is temporarily unavailable.",
          data.code,
          Boolean(data.retryable)
        );
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
      if (error instanceof ResumeScoreUnavailableError) {
        toast.error(error.message);
        return;
      }
      toast.error(`Failed to score resume: ${error.message}`);
    },
  });

  return {
    scoreResume: scoreMutation.mutate,
    scoreResumeAsync: scoreMutation.mutateAsync,
    isScoring: scoreMutation.isPending,
    scoreResult: scoreMutation.data,
    scoreError: scoreMutation.error,
  };
}
