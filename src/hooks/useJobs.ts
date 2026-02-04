import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useJobs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ["jobs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: { title: string; company: string; source_platform: string; source_url: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data: result, error } = await supabase
        .from("jobs")
        .insert({ ...data, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job added");
    },
  });

  const matchJobMutation = useMutation({
    mutationFn: async ({ jobId, cvProfileId }: { jobId: string; cvProfileId: string }) => {
      const { data, error } = await supabase.functions.invoke("match-job", {
        body: { jobId, cvProfileId },
      });
      if (error) {
        // Handle rate limit with user-friendly message
        if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
          throw new Error("AI is busy - please wait a moment and try again");
        }
        throw error;
      }
      if (data.error) {
        if (data.error.includes("Rate limit")) {
          throw new Error("AI is busy - please wait a moment and try again");
        }
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job matched");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to match job");
    },
  });

  return {
    jobs: jobsQuery.data || [],
    isLoading: jobsQuery.isLoading,
    createJob: createJobMutation.mutate,
    matchJob: matchJobMutation.mutate,
    isMatching: matchJobMutation.isPending,
    refetch: jobsQuery.refetch,
  };
}
