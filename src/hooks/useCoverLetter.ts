import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Job, CVProfile } from "@/types/database";

interface GenerateCoverLetterParams {
  job: Job;
  cvProfile: CVProfile;
  applicationId: string;
  style?: "professional" | "modern" | "technical" | "creative";
}

export function useCoverLetter() {
  const queryClient = useQueryClient();

  const generateCoverLetterMutation = useMutation({
    mutationFn: async ({ job, cvProfile, applicationId, style = "professional" }: GenerateCoverLetterParams) => {
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: { job, cvProfile, style },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Save cover letter to application
      const { error: updateError } = await supabase
        .from("applications")
        .update({ cover_letter: data.coverLetter })
        .eq("id", applicationId);

      if (updateError) throw updateError;

      return data.coverLetter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Cover letter generated successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to generate cover letter: ${error.message}`);
    },
  });

  return {
    generateCoverLetter: generateCoverLetterMutation.mutate,
    generateCoverLetterAsync: generateCoverLetterMutation.mutateAsync,
    isGenerating: generateCoverLetterMutation.isPending,
  };
}
