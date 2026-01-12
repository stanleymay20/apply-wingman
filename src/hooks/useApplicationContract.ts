import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCVProfile } from "./useCVProfile";
import { toast } from "sonner";

interface SkillMatch {
  matched: string[];
  missing: string[];
  partialMatch: string[];
}

export interface ApplicationContract {
  skillMatch: SkillMatch;
  coverLetter: string;
  talkingPoints: string[];
  gapsToAddress: string[];
  interviewPrep: string[];
  overallFitScore: number;
  honestAssessment: string;
}

interface JobData {
  title: string;
  company: string;
  description: string;
  requirements: string[];
}

export function useApplicationContract() {
  const { user } = useAuth();
  const { cvProfile } = useCVProfile();
  const queryClient = useQueryClient();

  const generateContractMutation = useMutation({
    mutationFn: async (job: JobData): Promise<ApplicationContract> => {
      if (!cvProfile) {
        throw new Error("Please upload your CV first");
      }

      const { data, error } = await supabase.functions.invoke("generate-application-contract", {
        body: {
          job,
          cvProfile: {
            skills: cvProfile.skills || [],
            experience_years: cvProfile.experience_years || 0,
            seniority_level: cvProfile.seniority_level || "mid",
            work_history: cvProfile.work_history || [],
            education: cvProfile.education || [],
            summary: cvProfile.summary || "",
          },
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.contract;
    },
    onSuccess: () => {
      toast.success("Application contract generated!");
    },
    onError: (error: Error) => {
      if (error.message.includes("Rate limit")) {
        toast.error("Too many requests. Please wait a moment.");
      } else if (error.message.includes("credits")) {
        toast.error("AI credits exhausted. Please add credits.");
      } else {
        toast.error(`Failed: ${error.message}`);
      }
    },
  });

  const saveContractMutation = useMutation({
    mutationFn: async ({
      applicationId,
      contract,
    }: {
      applicationId: string;
      contract: ApplicationContract;
    }) => {
      const { error } = await supabase
        .from("applications")
        .update({ application_contract: JSON.parse(JSON.stringify(contract)) })
        .eq("id", applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Contract saved to application");
    },
    onError: () => {
      toast.error("Failed to save contract");
    },
  });

  return {
    generateContract: generateContractMutation.mutate,
    generateContractAsync: generateContractMutation.mutateAsync,
    isGenerating: generateContractMutation.isPending,
    saveContract: saveContractMutation.mutate,
    isSaving: saveContractMutation.isPending,
  };
}