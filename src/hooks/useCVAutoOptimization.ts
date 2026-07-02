import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OptimizationChange {
  section: string;
  original: string;
  optimized: string;
  improvement: string;
  impact: "high" | "medium" | "low";
}

export interface WorkHistoryEntry {
  title: string;
  company: string;
  location?: string | null;
  duration: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
  highlights: string[];
}

export interface OptimizationResult {
  success: boolean;
  original: {
    summary: string;
    skills: string[];
    work_history: WorkHistoryEntry[];
    keywords: string[];
  };
  optimized: {
    summary: string;
    skills: string[];
    work_history: WorkHistoryEntry[];
    keywords: string[];
  };
  changes: OptimizationChange[];
  estimated_score: number;
  notes: string;
  error?: string;
}

export interface AutoOptimizationProgress {
  status: "idle" | "scoring" | "optimizing" | "applying" | "verifying" | "complete" | "failed";
  currentScore: number | null;
  targetScore: number;
  iteration: number;
  maxIterations: number;
  message: string;
}

// Lowered to allow applications without perfect CVs
const TARGET_SCORE = 50;
const MAX_ITERATIONS = 3;

export function useCVAutoOptimization() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<AutoOptimizationProgress>({
    status: "idle",
    currentScore: null,
    targetScore: TARGET_SCORE,
    iteration: 0,
    maxIterations: MAX_ITERATIONS,
    message: "",
  });
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [pendingChanges, setPendingChanges] = useState<OptimizationResult | null>(null);

  // Mutation for generating optimization suggestions
  const optimizeMutation = useMutation({
    mutationFn: async ({
      cvProfileId,
      currentScore,
      atsSuggestions,
      targetScore = TARGET_SCORE,
    }: {
      cvProfileId: string;
      currentScore?: number;
      atsSuggestions?: any;
      targetScore?: number;
    }): Promise<OptimizationResult> => {
      const { data, error } = await supabase.functions.invoke("optimize-cv", {
        body: { cvProfileId, currentScore, atsSuggestions, targetScore },
      });

      if (error) throw new Error(error.message);
      if (data?.unavailable) throw new Error(data.error || "AI scoring is temporarily unavailable.");
      if (data?.error) throw new Error(data.error);

      return data as OptimizationResult;
    },
    onSuccess: (data) => {
      setPendingChanges(data);
      setOptimizationResult(data);
    },
    onError: (error) => {
      toast.error(`Optimization failed: ${error.message}`);
    },
  });

  // Apply optimized changes to the CV profile
  const applyOptimization = useCallback(async (
    cvProfileId: string,
    optimized: OptimizationResult["optimized"]
  ): Promise<boolean> => {
    try {
      // Convert work_history to JSON-compatible format
      const workHistoryJson = optimized.work_history.map(entry => ({
        title: entry.title,
        company: entry.company,
        location: entry.location || null,
        duration: entry.duration,
        start_date: entry.start_date,
        end_date: entry.end_date,
        is_current: entry.is_current || false,
        highlights: entry.highlights,
      }));

      const { error } = await supabase
        .from("cv_profiles")
        .update({
          summary: optimized.summary,
          skills: optimized.skills,
          work_history: workHistoryJson as unknown as any,
          keywords: optimized.keywords,
        })
        .eq("id", cvProfileId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["cv-profile"] });
      queryClient.invalidateQueries({ queryKey: ["cv-profiles-list"] });
      toast.success("Optimizations applied successfully!");
      return true;
    } catch (error) {
      toast.error(`Failed to apply changes: ${error instanceof Error ? error.message : "Unknown error"}`);
      return false;
    }
  }, [queryClient]);

  // Score the CV using the existing score-resume function
  const scoreCV = useCallback(async (
    cvProfileId: string,
    cvText: string,
    skills?: string[],
    experienceYears?: number,
    seniorityLevel?: string
  ): Promise<{ score: number; suggestions: any } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("score-resume", {
        body: {
          cvText,
          skills,
          experience_years: experienceYears,
          seniority_level: seniorityLevel,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Update the CV profile with the new score
      await supabase
        .from("cv_profiles")
        .update({
          resume_score: data.score,
          ats_suggestions: data,
        })
        .eq("id", cvProfileId);

      return { score: data.score, suggestions: data };
    } catch (error) {
      console.error("Scoring failed:", error);
      return null;
    }
  }, []);

  // Full auto-optimization workflow: score → optimize → apply → verify → repeat if needed
  const runAutoOptimization = useCallback(async (
    cvProfileId: string,
    initialCVData: {
      summary: string;
      skills: string[];
      experienceYears?: number;
      seniorityLevel?: string;
    }
  ): Promise<{ success: boolean; finalScore: number; iterations: number }> => {
    setProgress({
      status: "scoring",
      currentScore: null,
      targetScore: TARGET_SCORE,
      iteration: 1,
      maxIterations: MAX_ITERATIONS,
      message: "Analyzing current ATS score...",
    });

    let currentScore = 0;
    let suggestions: any = null;
    let iteration = 0;

    // Build CV text for scoring
    const buildCVText = (summary: string, skills: string[]) => {
      return [summary, skills.join(", ")].filter(Boolean).join("\n\n");
    };

    let currentSummary = initialCVData.summary;
    let currentSkills = initialCVData.skills;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // Step 1: Score current CV
      setProgress(prev => ({
        ...prev,
        status: "scoring",
        iteration,
        message: `Iteration ${iteration}: Scoring current CV...`,
      }));

      const scoreResult = await scoreCV(
        cvProfileId,
        buildCVText(currentSummary, currentSkills),
        currentSkills,
        initialCVData.experienceYears,
        initialCVData.seniorityLevel
      );

      if (!scoreResult) {
        setProgress(prev => ({ ...prev, status: "failed", message: "Failed to score CV" }));
        return { success: false, finalScore: currentScore, iterations: iteration };
      }

      currentScore = scoreResult.score;
      suggestions = scoreResult.suggestions;

      setProgress(prev => ({
        ...prev,
        currentScore,
        message: `Iteration ${iteration}: Current score is ${currentScore}%`,
      }));

      // Check if target reached
      if (currentScore >= TARGET_SCORE) {
        setProgress(prev => ({
          ...prev,
          status: "complete",
          message: `Target score achieved! Final score: ${currentScore}%`,
        }));
        toast.success(`CV optimized to ${currentScore}% ATS score!`);
        return { success: true, finalScore: currentScore, iterations: iteration };
      }

      // Step 2: Generate optimizations
      setProgress(prev => ({
        ...prev,
        status: "optimizing",
        message: `Iteration ${iteration}: Generating AI optimizations...`,
      }));

      try {
        const optimizationResult = await optimizeMutation.mutateAsync({
          cvProfileId,
          currentScore,
          atsSuggestions: suggestions,
          targetScore: TARGET_SCORE,
        });

        if (!optimizationResult.success) {
          throw new Error("Optimization failed");
        }

        // Step 3: Apply optimizations
        setProgress(prev => ({
          ...prev,
          status: "applying",
          message: `Iteration ${iteration}: Applying optimizations...`,
        }));

        const applied = await applyOptimization(cvProfileId, optimizationResult.optimized);
        if (!applied) {
          throw new Error("Failed to apply optimizations");
        }

        // Update local state for next iteration
        currentSummary = optimizationResult.optimized.summary;
        currentSkills = optimizationResult.optimized.skills;

        // Step 4: Verify new score
        setProgress(prev => ({
          ...prev,
          status: "verifying",
          message: `Iteration ${iteration}: Verifying new score...`,
        }));

        // Small delay to ensure database is updated
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Iteration ${iteration} failed:`, error);
        if (iteration === MAX_ITERATIONS) {
          setProgress(prev => ({
            ...prev,
            status: "failed",
            message: `Optimization incomplete after ${iteration} iterations. Current score: ${currentScore}%`,
          }));
          return { success: false, finalScore: currentScore, iterations: iteration };
        }
      }
    }

    // Max iterations reached
    setProgress(prev => ({
      ...prev,
      status: currentScore >= TARGET_SCORE ? "complete" : "failed",
      message: currentScore >= TARGET_SCORE 
        ? `Target achieved! Final score: ${currentScore}%`
        : `Max iterations reached. Final score: ${currentScore}%. Consider manual improvements.`,
    }));

    return { 
      success: currentScore >= TARGET_SCORE, 
      finalScore: currentScore, 
      iterations: iteration 
    };
  }, [scoreCV, optimizeMutation, applyOptimization]);

  // Single optimization step (for preview/manual control)
  const generateOptimization = useCallback(async (
    cvProfileId: string,
    currentScore?: number,
    atsSuggestions?: any
  ) => {
    return optimizeMutation.mutateAsync({
      cvProfileId,
      currentScore,
      atsSuggestions,
      targetScore: TARGET_SCORE,
    });
  }, [optimizeMutation]);

  const resetOptimization = useCallback(() => {
    setProgress({
      status: "idle",
      currentScore: null,
      targetScore: TARGET_SCORE,
      iteration: 0,
      maxIterations: MAX_ITERATIONS,
      message: "",
    });
    setOptimizationResult(null);
    setPendingChanges(null);
  }, []);

  return {
    // Full auto-optimization
    runAutoOptimization,
    progress,
    
    // Manual/preview optimization
    generateOptimization,
    applyOptimization,
    optimizationResult,
    pendingChanges,
    
    // State
    isOptimizing: optimizeMutation.isPending || progress.status === "optimizing",
    isRunning: ["scoring", "optimizing", "applying", "verifying"].includes(progress.status),
    
    // Controls
    resetOptimization,
    TARGET_SCORE,
    MAX_ITERATIONS,
  };
}
