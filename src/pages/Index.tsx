import { 
  Send, 
  CheckCircle, 
  UserCheck, 
  TrendingUp,
  Calendar,
  Clock,
  Loader2,
  Command,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuotaProgress } from "@/components/dashboard/QuotaProgress";
import { AutomationToggle } from "@/components/dashboard/AutomationToggle";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { ApplicationFunnel } from "@/components/dashboard/ApplicationFunnel";
import { SetupProgress } from "@/components/onboarding/SetupProgress";
import { EmailInfrastructureCard } from "@/components/dashboard/EmailInfrastructureCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAuth } from "@/hooks/useAuth";
import { Kbd } from "@/components/ui/kbd";

export default function Dashboard() {
  const { profile } = useAuth();
  const { data: stats, isLoading } = useDashboardStats();

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const remaining = (stats?.dailyCap || 50) - (stats?.todayApplications || 0);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{today}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span>Quick actions:</span>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Monitor your job application automation in real-time
        </p>
      </div>

      {/* Setup Progress (shows only when setup incomplete) */}
      <SetupProgress />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Applied Today"
          value={stats?.todayApplications || 0}
          subtitle={`${remaining} remaining quota`}
          icon={Send}
          variant="primary"
        />
        <StatsCard
          title="Total Applications"
          value={stats?.totalApplications || 0}
          subtitle="All time"
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Interview Requests"
          value={stats?.interviews || 0}
          subtitle={`${stats?.responseRate || 0}% response rate`}
          icon={UserCheck}
          variant="info"
        />
        <StatsCard
          title="Avg. Match Score"
          value={`${stats?.averageMatchScore || 0}%`}
          subtitle={stats?.averageMatchScore >= 70 ? "Above threshold" : "Below threshold"}
          icon={TrendingUp}
          variant="warning"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column - Quota & Control */}
        <div className="space-y-6">
          <QuotaProgress 
            current={stats?.todayApplications || 0} 
            max={stats?.dailyCap || 50} 
          />
          <AutomationToggle />
          <EmailInfrastructureCard />
          
          {/* Next Scheduled Run */}
          <div className="glass-card p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/20">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Automation Schedule</h3>
                <p className="text-lg font-semibold text-foreground">
                  {profile?.automation_status === 'running' ? 'Every 15 minutes' : 'Paused'}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {profile?.automation_status === 'running'
                ? 'Job discovery + apply runs every 15 min · Stuck apps drain every 10 min'
                : 'Start automation to begin scanning'}
            </p>
          </div>
        </div>

        {/* Right Column - Recent & Funnel */}
        <div className="lg:col-span-2 space-y-6">
          <RecentApplications />
          <ApplicationFunnel />
        </div>
      </div>
    </div>
  );
}
