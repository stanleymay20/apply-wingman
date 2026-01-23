import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Json } from "@/integrations/supabase/types";

export interface CVAuditEntry {
  id: string;
  action: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  level: string;
}

export function useCVAuditLog(cvProfileId?: string) {
  const { user } = useAuth();

  const auditQuery = useQuery({
    queryKey: ["cv-audit-log", cvProfileId],
    queryFn: async (): Promise<CVAuditEntry[]> => {
      if (!user || !cvProfileId) return [];

      // Get logs related to CV operations
      const { data, error } = await supabase
        .from("application_logs")
        .select("id, action, message, details, created_at, level")
        .eq("user_id", user.id)
        .or(`action.ilike.%cv%,action.ilike.%resume%,action.ilike.%parse%,action.ilike.%optim%,action.ilike.%score%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching CV audit log:", error);
        return [];
      }

      return (data || []) as CVAuditEntry[];
    },
    enabled: !!user && !!cvProfileId,
    staleTime: 30000,
  });

  // Log a CV action
  const logCVAction = async (
    action: string,
    message: string,
    details?: Record<string, unknown>,
    level: string = "info"
  ) => {
    if (!user) return;

    try {
      await supabase.from("application_logs").insert([{
        user_id: user.id,
        action,
        message,
        details: (details || {}) as Json,
        level,
      }]);
    } catch (err) {
      console.error("Failed to log CV action:", err);
    }
  };

  return {
    auditLog: auditQuery.data || [],
    isLoading: auditQuery.isLoading,
    refetch: auditQuery.refetch,
    logCVAction,
  };
}
