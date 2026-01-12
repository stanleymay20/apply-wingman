import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

interface TrendData {
  date: string;
  applications: number;
  interviews: number;
}

interface PlatformData {
  name: string;
  applications: number;
  successRate: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface MatchScoreData {
  range: string;
  count: number;
}

interface AnalyticsData {
  applicationTrend: TrendData[];
  platformData: PlatformData[];
  statusDistribution: StatusData[];
  matchScoreDistribution: MatchScoreData[];
  responseRate: number;
  avgMatchScore: number;
  bestDay: string;
  avgResponseTime: number;
  totalApplications: number;
  totalInterviews: number;
}

export function useAnalyticsData(days: number = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["analytics", user?.id, days],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!user) {
        return {
          applicationTrend: [],
          platformData: [],
          statusDistribution: [],
          matchScoreDistribution: [],
          responseRate: 0,
          avgMatchScore: 0,
          bestDay: "N/A",
          avgResponseTime: 0,
          totalApplications: 0,
          totalInterviews: 0,
        };
      }

      const startDate = startOfDay(subDays(new Date(), days));

      // Fetch all applications with jobs
      const { data: applications } = await supabase
        .from("applications")
        .select(`*, job:jobs(source_platform)`)
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      const apps = applications || [];

      // Generate trend data for each day
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: new Date(),
      });

      const trendMap: Record<string, { applications: number; interviews: number }> = {};
      dateRange.forEach((date) => {
        const key = format(date, "MMM d");
        trendMap[key] = { applications: 0, interviews: 0 };
      });

      apps.forEach((app) => {
        const dateKey = format(new Date(app.created_at || ""), "MMM d");
        if (trendMap[dateKey]) {
          trendMap[dateKey].applications++;
          if (app.status === "interview") {
            trendMap[dateKey].interviews++;
          }
        }
      });

      const applicationTrend = Object.entries(trendMap).map(([date, data]) => ({
        date,
        ...data,
      }));

      // Platform performance
      const platformCounts: Record<string, { total: number; interviews: number }> = {};
      apps.forEach((app) => {
        const platform = (app.job as any)?.source_platform || "other";
        if (!platformCounts[platform]) {
          platformCounts[platform] = { total: 0, interviews: 0 };
        }
        platformCounts[platform].total++;
        if (app.status === "interview" || app.status === "offer") {
          platformCounts[platform].interviews++;
        }
      });

      const platformData: PlatformData[] = Object.entries(platformCounts)
        .map(([name, data]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          applications: data.total,
          successRate: data.total > 0 ? Math.round((data.interviews / data.total) * 100) : 0,
        }))
        .sort((a, b) => b.applications - a.applications)
        .slice(0, 5);

      // Status distribution
      const statusCounts: Record<string, number> = {
        submitted: 0,
        interview: 0,
        rejected: 0,
        pending: 0,
        offer: 0,
      };
      apps.forEach((app) => {
        const status = app.status || "pending";
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      });

      const statusColors: Record<string, string> = {
        submitted: "hsl(199, 89%, 48%)",
        interview: "hsl(142, 76%, 36%)",
        rejected: "hsl(0, 72%, 51%)",
        pending: "hsl(38, 92%, 50%)",
        offer: "hsl(280, 65%, 60%)",
      };

      const statusDistribution: StatusData[] = Object.entries(statusCounts)
        .filter(([, count]) => count > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          color: statusColors[name] || "hsl(215, 20%, 55%)",
        }));

      // Match score distribution
      const scoreRanges: Record<string, number> = {
        "90-100%": 0,
        "80-89%": 0,
        "70-79%": 0,
        "60-69%": 0,
        "<60%": 0,
      };

      apps.forEach((app) => {
        const score = app.match_score || 0;
        if (score >= 90) scoreRanges["90-100%"]++;
        else if (score >= 80) scoreRanges["80-89%"]++;
        else if (score >= 70) scoreRanges["70-79%"]++;
        else if (score >= 60) scoreRanges["60-69%"]++;
        else scoreRanges["<60%"]++;
      });

      const matchScoreDistribution: MatchScoreData[] = Object.entries(scoreRanges)
        .filter(([, count]) => count > 0)
        .map(([range, count]) => ({ range, count }));

      // Calculate metrics
      const totalApps = apps.length;
      const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
      const responseRate = totalApps > 0 ? Math.round((interviews / totalApps) * 100) : 0;

      const avgMatchScore = apps.length > 0
        ? Math.round(apps.reduce((sum, a) => sum + (a.match_score || 0), 0) / apps.length)
        : 0;

      // Best day of week for interviews
      const dayInterviews: Record<string, number> = {};
      apps
        .filter((a) => a.status === "interview" || a.status === "offer")
        .forEach((app) => {
          const day = format(new Date(app.created_at || ""), "EEEE");
          dayInterviews[day] = (dayInterviews[day] || 0) + 1;
        });

      const bestDay = Object.entries(dayInterviews)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      // Average response time (days between application and response)
      const responseTimes: number[] = [];
      apps.forEach((app) => {
        if (app.applied_at && app.response_received_at) {
          const applied = new Date(app.applied_at).getTime();
          const responded = new Date(app.response_received_at).getTime();
          const days = (responded - applied) / (1000 * 60 * 60 * 24);
          if (days > 0 && days < 90) responseTimes.push(days);
        }
      });

      const avgResponseTime = responseTimes.length > 0
        ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
        : 0;

      return {
        applicationTrend,
        platformData,
        statusDistribution,
        matchScoreDistribution,
        responseRate,
        avgMatchScore,
        bestDay,
        avgResponseTime,
        totalApplications: totalApps,
        totalInterviews: interviews,
      };
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });
}
