import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export function useApplications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const applicationsQuery = useQuery({
    queryKey: ["applications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("applications")
        .select(`*, job:jobs(*)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const todayApplicationsQuery = useQuery({
    queryKey: ["today-applications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("applied_at", today.toISOString())
        .in("status", ["submitted", "interview", "offer"]);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const createApplicationMutation = useMutation({
    mutationFn: async (data: { job_id: string; match_score: number; cv_profile_id?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data: result, error } = await supabase
        .from("applications")
        .insert({ ...data, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["today-applications"] });
      toast.success("Application created");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "submitted") updateData.applied_at = new Date().toISOString();
      
      const { error } = await supabase.from("applications").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["today-applications"] });
    },
  });

  return {
    applications: applicationsQuery.data || [],
    todayCount: todayApplicationsQuery.data || 0,
    isLoading: applicationsQuery.isLoading,
    createApplication: createApplicationMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    refetch: applicationsQuery.refetch,
  };
}
