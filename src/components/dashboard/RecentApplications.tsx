import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";

interface Application {
  id: string;
  company: string;
  role: string;
  platform: string;
  matchScore: number;
  status: "applied" | "interview" | "rejected" | "pending";
  appliedAt: string;
}

const recentApplications: Application[] = [
  {
    id: "1",
    company: "TechCorp GmbH",
    role: "Senior Data Engineer",
    platform: "LinkedIn",
    matchScore: 94,
    status: "interview",
    appliedAt: "2 hours ago",
  },
  {
    id: "2",
    company: "AI Solutions AG",
    role: "Machine Learning Engineer",
    platform: "Greenhouse",
    matchScore: 89,
    status: "applied",
    appliedAt: "4 hours ago",
  },
  {
    id: "3",
    company: "DataFlow Inc",
    role: "Analytics Lead",
    platform: "Indeed",
    matchScore: 86,
    status: "applied",
    appliedAt: "5 hours ago",
  },
  {
    id: "4",
    company: "Growth Dynamics",
    role: "Growth Data Analyst",
    platform: "Company Site",
    matchScore: 82,
    status: "pending",
    appliedAt: "6 hours ago",
  },
  {
    id: "5",
    company: "StartupXYZ",
    role: "Data Scientist",
    platform: "Lever",
    matchScore: 78,
    status: "rejected",
    appliedAt: "1 day ago",
  },
];

export function RecentApplications() {
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
                  <h4 className="font-medium text-foreground truncate">{app.role}</h4>
                  <StatusBadge status={app.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {app.company} • {app.platform}
                </p>
              </div>
              
              <div className="text-right shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-primary">{app.matchScore}%</span>
                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${app.matchScore}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{app.appliedAt}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
