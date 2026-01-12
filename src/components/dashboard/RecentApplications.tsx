import { ExternalLink, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { useApplications } from "@/hooks/useApplications";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDistanceToNow } from "date-fns";

export function RecentApplications() {
  const { applications, isLoading } = useApplications();
  
  // Get the 5 most recent applications
  const recentApplications = applications.slice(0, 5);

  if (isLoading) {
    return (
      <div className="glass-card p-6 animate-scale-in">
        <LoadingSpinner size="md" text="Loading applications..." />
      </div>
    );
  }

  return (
    <div className="glass-card animate-scale-in">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Recent Applications</h3>
          <Link to="/applications">
            <Button variant="ghost" size="sm">
              View All
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {recentApplications.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          description="Start adding jobs or enable automation to begin applying"
          action={{
            label: "Add Job",
            onClick: () => window.location.href = "/applications",
          }}
        />
      ) : (
        <div className="divide-y divide-border/50">
          {recentApplications.map((app, index) => (
            <div 
              key={app.id} 
              className="p-4 hover:bg-secondary/30 transition-colors animate-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-foreground truncate">
                      {app.job?.title || "Unknown Role"}
                    </h4>
                    <StatusBadge status={app.status || "pending"} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {app.job?.company || "Unknown Company"} • {app.job?.source_platform?.replace("_", " ") || "Unknown"}
                  </p>
                </div>
                
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-primary">{app.match_score}%</span>
                    <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${app.match_score}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {app.applied_at 
                      ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })
                      : app.created_at 
                        ? formatDistanceToNow(new Date(app.created_at), { addSuffix: true })
                        : "Recently"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
