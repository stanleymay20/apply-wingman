import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { DashboardStats } from "@/types/database";

export function useDashboardStats() {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) {
        return {
          todayApplications: 0,
          dailyCap: 50,
          totalApplications: 0,
          interviews: 0,
          responseRate: 0,
          averageMatchScore: 0,
        };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's applications count
      const { count: todayCount } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("applied_at", today.toISOString())
        .in("status", ["submitted", "interview", "offer"]);

      // Get total applications
      const { count: totalCount } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["submitted", "interview", "offer", "rejected"]);

      // Get interviews count
      const { count: interviewCount } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "interview");

      // Get responses count (interviews + rejections + offers)
      const { count: responseCount } = await supabase
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["interview", "rejected", "offer"]);

      // Get average match score
      const { data: scoreData } = await supabase
        .from("applications")
        .select("match_score")
        .eq("user_id", user.id)
        .not("match_score", "is", null);

      const avgScore = scoreData?.length 
        ? scoreData.reduce((sum, app) => sum + (app.match_score || 0), 0) / scoreData.length
        : 0;

      const total = totalCount || 0;
      const responses = responseCount || 0;

      return {
        todayApplications: todayCount || 0,
        dailyCap: profile?.daily_application_cap || 50,
        totalApplications: total,
        interviews: interviewCount || 0,
        responseRate: total > 0 ? Math.round((responses / total) * 100) : 0,
        averageMatchScore: Math.round(avgScore),
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
