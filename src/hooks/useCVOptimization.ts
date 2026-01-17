import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OptimizationResult {
  success: boolean;
  originalScore: number;
  optimizedScore: number;
  improvements: string[];
  error?: string;
}

interface CVOptimizationParams {
  cvProfileId: string;
  cvText: string;
  skills?: string[];
  experience_years?: number;
  seniority_level?: string;
  targetScore?: number;
}

const MIN_SCORE_FOR_AUTO_APPLY = 90;
const MAX_OPTIMIZATION_ATTEMPTS = 3;

export function useCVOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);

  const optimizeCV = useCallback(async (params: CVOptimizationParams): Promise<OptimizationResult> => {
    setIsOptimizing(true);
    const targetScore = params.targetScore || MIN_SCORE_FOR_AUTO_APPLY;
    const improvements: string[] = [];
    
    try {
      // First, get the current score
      const { data: initialScoreData, error: scoreError } = await supabase.functions.invoke("score-resume", {
        body: {
          cvText: params.cvText,
          skills: params.skills,
          experience_years: params.experience_years,
          seniority_level: params.seniority_level,
        },
      });

      if (scoreError) throw new Error(scoreError.message);
      
      const originalScore = initialScoreData?.score || 0;
      
      // If already at target, no optimization needed
      if (originalScore >= targetScore) {
        const result: OptimizationResult = {
          success: true,
          originalScore,
          optimizedScore: originalScore,
          improvements: ["CV already meets the target score!"],
        };
        setOptimizationResult(result);
        setIsOptimizing(false);
        return result;
      }

      // Get AI suggestions for optimization
      const suggestions = initialScoreData?.suggestions || [];
      const highPrioritySuggestions = suggestions
        .filter((s: { priority: string }) => s.priority === "high" || s.priority === "medium")
        .map((s: { suggestion: string }) => s.suggestion);

      if (highPrioritySuggestions.length > 0) {
        improvements.push(...highPrioritySuggestions.slice(0, 5));
      }

      // Store suggestions in CV profile
      await supabase
        .from("cv_profiles")
        .update({
          resume_score: originalScore,
          ats_suggestions: initialScoreData,
        })
        .eq("id", params.cvProfileId);

      const result: OptimizationResult = {
        success: originalScore >= targetScore,
        originalScore,
        optimizedScore: originalScore,
        improvements,
      };

      if (originalScore < targetScore) {
        result.error = `CV score is ${originalScore}%, needs ${targetScore}% for auto-apply. Apply the suggested improvements to optimize your CV.`;
      }

      setOptimizationResult(result);
      setIsOptimizing(false);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const result: OptimizationResult = {
        success: false,
        originalScore: 0,
        optimizedScore: 0,
        improvements: [],
        error: errorMessage,
      };
      setOptimizationResult(result);
      setIsOptimizing(false);
      return result;
    }
  }, []);

  const checkCVReadyForAutoApply = useCallback(async (cvProfileId: string): Promise<{
    ready: boolean;
    score: number;
    suggestions: string[];
  }> => {
    try {
      // First check if we already have a recent score
      const { data: profile } = await supabase
        .from("cv_profiles")
        .select("resume_score, ats_suggestions, summary, skills, experience_years, seniority_level")
        .eq("id", cvProfileId)
        .single();

      if (profile?.resume_score && profile.resume_score >= MIN_SCORE_FOR_AUTO_APPLY) {
        return {
          ready: true,
          score: profile.resume_score,
          suggestions: [],
        };
      }

      // Need to calculate/recalculate score
      const cvText = [
        profile?.summary || "",
        (profile?.skills || []).join(", "),
      ].join("\n\n");

      if (cvText.length < 100) {
        return {
          ready: false,
          score: 0,
          suggestions: ["Your CV profile is incomplete. Please upload a CV or add more details."],
        };
      }

      const { data: scoreData, error } = await supabase.functions.invoke("score-resume", {
        body: {
          cvText,
          skills: profile?.skills,
          experience_years: profile?.experience_years,
          seniority_level: profile?.seniority_level,
        },
      });

      if (error) {
        return {
          ready: false,
          score: 0,
          suggestions: ["Unable to score CV. Please try again later."],
        };
      }

      const score = scoreData?.score || 0;
      const suggestions = (scoreData?.suggestions || [])
        .filter((s: { priority: string }) => s.priority === "high")
        .map((s: { suggestion: string }) => s.suggestion);

      // Update the profile with the new score
      await supabase
        .from("cv_profiles")
        .update({
          resume_score: score,
          ats_suggestions: scoreData,
        })
        .eq("id", cvProfileId);

      return {
        ready: score >= MIN_SCORE_FOR_AUTO_APPLY,
        score,
        suggestions,
      };
    } catch (error) {
      console.error("CV readiness check error:", error);
      return {
        ready: false,
        score: 0,
        suggestions: ["Error checking CV readiness."],
      };
    }
  }, []);

  return {
    optimizeCV,
    checkCVReadyForAutoApply,
    isOptimizing,
    optimizationResult,
    MIN_SCORE_FOR_AUTO_APPLY,
  };
}
