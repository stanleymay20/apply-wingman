import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { AutomationStatus } from "@/types/database";
import { toast } from "sonner";

export function useAutomation() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const updateAutomationStatus = useMutation({
    mutationFn: async (status: AutomationStatus) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({ automation_status: status })
        .eq("id", user.id);

      if (error) throw error;
      return status;
    },
    onSuccess: async (status) => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      const messages: Record<AutomationStatus, string> = {
        running: "Automation started - scanning for jobs",
        paused: "Automation paused",
        stopped: "Emergency stop activated",
      };
      
      toast.success(messages[status]);
    },
    onError: (error) => {
      toast.error(`Failed to update automation: ${error.message}`);
    },
  });

  const toggleAutomation = () => {
    if (!profile) return;
    
    const newStatus: AutomationStatus = 
      profile.automation_status === "running" ? "paused" : "running";
    
    updateAutomationStatus.mutate(newStatus);
  };

  const emergencyStop = () => {
    updateAutomationStatus.mutate("stopped");
  };

  const resume = () => {
    updateAutomationStatus.mutate("running");
  };

  return {
    status: profile?.automation_status || "paused",
    isUpdating: updateAutomationStatus.isPending,
    toggleAutomation,
    emergencyStop,
    resume,
    setStatus: updateAutomationStatus.mutate,
  };
}
