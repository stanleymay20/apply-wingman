import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface AutoApplySchedule {
  id: string;
  user_id: string;
  frequency: "daily" | "weekly";
  time_of_day: string; // HH:MM:SS format
  timezone: string;
  days_of_week: number[] | null; // 0 (Sun) - 6 (Sat) for weekly
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleParams {
  frequency: "daily" | "weekly";
  time_of_day: string; // HH:MM format
  timezone: string;
  days_of_week?: number[];
}

export interface UpdateScheduleParams {
  id: string;
  frequency?: "daily" | "weekly";
  time_of_day?: string;
  timezone?: string;
  days_of_week?: number[] | null;
  enabled?: boolean;
}

export function useAutoApplySchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all schedules for the user
  const schedulesQuery = useQuery({
    queryKey: ["auto-apply-schedules", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("auto_apply_schedules")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AutoApplySchedule[];
    },
    enabled: !!user,
  });

  // Create a new schedule
  const createScheduleMutation = useMutation({
    mutationFn: async (params: CreateScheduleParams) => {
      if (!user) throw new Error("Not authenticated");

      // Format time to include seconds
      const timeWithSeconds = params.time_of_day.includes(":")
        ? params.time_of_day.length === 5
          ? `${params.time_of_day}:00`
          : params.time_of_day
        : `${params.time_of_day}:00:00`;

      const { data, error } = await supabase
        .from("auto_apply_schedules")
        .insert({
          user_id: user.id,
          frequency: params.frequency,
          time_of_day: timeWithSeconds,
          timezone: params.timezone,
          days_of_week: params.frequency === "weekly" ? params.days_of_week || [] : null,
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AutoApplySchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-apply-schedules"] });
      toast.success("Auto-apply schedule created");
    },
    onError: (error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });

  // Update an existing schedule
  const updateScheduleMutation = useMutation({
    mutationFn: async (params: UpdateScheduleParams) => {
      if (!user) throw new Error("Not authenticated");

      const updates: Record<string, any> = {};
      
      if (params.frequency !== undefined) updates.frequency = params.frequency;
      if (params.time_of_day !== undefined) {
        const timeWithSeconds = params.time_of_day.includes(":")
          ? params.time_of_day.length === 5
            ? `${params.time_of_day}:00`
            : params.time_of_day
          : `${params.time_of_day}:00:00`;
        updates.time_of_day = timeWithSeconds;
      }
      if (params.timezone !== undefined) updates.timezone = params.timezone;
      if (params.days_of_week !== undefined) updates.days_of_week = params.days_of_week;
      if (params.enabled !== undefined) updates.enabled = params.enabled;

      const { data, error } = await supabase
        .from("auto_apply_schedules")
        .update(updates)
        .eq("id", params.id)
        .eq("user_id", user.id) // Security: ensure user owns this schedule
        .select()
        .single();

      if (error) throw error;
      return data as AutoApplySchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-apply-schedules"] });
      toast.success("Schedule updated");
    },
    onError: (error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });

  // Delete a schedule
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("auto_apply_schedules")
        .delete()
        .eq("id", scheduleId)
        .eq("user_id", user.id); // Security: ensure user owns this schedule

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-apply-schedules"] });
      toast.success("Schedule deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete schedule: ${error.message}`);
    },
  });

  // Toggle schedule enabled/disabled
  const toggleSchedule = (scheduleId: string, enabled: boolean) => {
    updateScheduleMutation.mutate({ id: scheduleId, enabled });
  };

  return {
    schedules: schedulesQuery.data || [],
    isLoading: schedulesQuery.isLoading,
    createSchedule: createScheduleMutation.mutate,
    createScheduleAsync: createScheduleMutation.mutateAsync,
    updateSchedule: updateScheduleMutation.mutate,
    deleteSchedule: deleteScheduleMutation.mutate,
    toggleSchedule,
    isCreating: createScheduleMutation.isPending,
    isUpdating: updateScheduleMutation.isPending,
    isDeleting: deleteScheduleMutation.isPending,
  };
}
