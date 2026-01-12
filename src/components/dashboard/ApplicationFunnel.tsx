import { cn } from "@/lib/utils";
import { useApplications } from "@/hooks/useApplications";
import { useJobs } from "@/hooks/useJobs";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useMemo } from "react";

interface FunnelStage {
  label: string;
  count: number;
  color: string;
}

export function ApplicationFunnel() {
  const { applications, isLoading: appsLoading } = useApplications();
  const { jobs, isLoading: jobsLoading } = useJobs();

  const funnelData: FunnelStage[] = useMemo(() => {
    const jobsCount = jobs.length;
    const matchedJobs = jobs.filter(j => (j.match_score || 0) >= 70).length;
    const appliedCount = applications.filter(a => 
      ["submitted", "applied", "interview", "offer"].includes(a.status || "")
    ).length;
    const interviewCount = applications.filter(a => a.status === "interview").length;
    const offerCount = applications.filter(a => a.status === "offer").length;

    return [
      { label: "Jobs Discovered", count: jobsCount, color: "bg-info" },
      { label: "Matched (70%+)", count: matchedJobs, color: "bg-primary" },
      { label: "Applied", count: appliedCount, color: "bg-success" },
      { label: "Interview", count: interviewCount, color: "bg-warning" },
      { label: "Offer", count: offerCount, color: "bg-gradient-to-r from-primary to-info" },
    ];
  }, [applications, jobs]);

  const isLoading = appsLoading || jobsLoading;
  const maxCount = Math.max(funnelData[0].count, 1);

  if (isLoading) {
    return (
      <div className="glass-card p-6 animate-scale-in">
        <LoadingSpinner size="md" text="Loading funnel data..." />
      </div>
    );
  }

  return (
    <div className="glass-card p-6 animate-scale-in">
      <h3 className="text-lg font-semibold text-foreground mb-6">Application Funnel</h3>
      
      <div className="space-y-4">
        {funnelData.map((stage, index) => {
          const percentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const conversionRate = index > 0 && funnelData[index - 1].count > 0
            ? ((stage.count / funnelData[index - 1].count) * 100).toFixed(1)
            : null;

          return (
            <div key={stage.label} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{stage.label}</span>
                <div className="flex items-center gap-2">
                  {conversionRate && Number(conversionRate) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {conversionRate}% conv.
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">{stage.count.toLocaleString()}</span>
                </div>
              </div>
              <div className="relative h-8 bg-secondary rounded-lg overflow-hidden">
                <div 
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-3",
                    stage.color
                  )}
                  style={{ width: `${Math.max(percentage, stage.count > 0 ? 5 : 0)}%` }}
                >
                  {percentage > 15 && (
                    <span className="text-xs font-medium text-white/90">
                      {percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall Conversion</span>
          <span className="font-bold text-gradient">
            {funnelData[0].count > 0 
              ? ((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100).toFixed(2)
              : "0.00"}%
          </span>
        </div>
      </div>
    </div>
  );
}
