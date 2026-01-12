import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useCVProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const cvProfileQuery = useQuery({
    queryKey: ["cv-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("cv_profiles")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createCVProfileMutation = useMutation({
    mutationFn: async (data: { cv_file_url?: string; cv_file_name?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data: result, error } = await supabase
        .from("cv_profiles")
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cv-profile"] });
      toast.success("CV profile created");
    },
  });

  const parseCVMutation = useMutation({
    mutationFn: async ({ cvText, cvProfileId }: { cvText: string; cvProfileId?: string }) => {
      const { data, error } = await supabase.functions.invoke("parse-cv", {
        body: { cvText, cvProfileId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cv-profile"] });
      toast.success("CV parsed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to parse CV: ${error.message}`);
    },
  });

  return {
    cvProfile: cvProfileQuery.data,
    isLoading: cvProfileQuery.isLoading,
    createCVProfile: createCVProfileMutation.mutate,
    parseCV: parseCVMutation.mutate,
    isParsing: parseCVMutation.isPending,
    refetch: cvProfileQuery.refetch,
  };
}
