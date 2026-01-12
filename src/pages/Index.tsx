import { 
  Send, 
  CheckCircle, 
  UserCheck, 
  TrendingUp,
  Calendar,
  Clock
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuotaProgress } from "@/components/dashboard/QuotaProgress";
import { AutomationToggle } from "@/components/dashboard/AutomationToggle";
import { RecentApplications } from "@/components/dashboard/RecentApplications";
import { ApplicationFunnel } from "@/components/dashboard/ApplicationFunnel";

export default function Dashboard() {
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">{today}</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your job application automation in real-time
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Applied Today"
          value={37}
          subtitle="13 remaining quota"
          icon={Send}
          variant="primary"
          trend={{ value: 12, isPositive: true }}
        />
        <StatsCard
          title="Total Applications"
          value={312}
          subtitle="This month"
          icon={CheckCircle}
          variant="success"
          trend={{ value: 8, isPositive: true }}
        />
        <StatsCard
          title="Interview Requests"
          value={28}
          subtitle="9% response rate"
          icon={UserCheck}
          variant="info"
          trend={{ value: 15, isPositive: true }}
        />
        <StatsCard
          title="Avg. Match Score"
          value="84%"
          subtitle="Above threshold"
          icon={TrendingUp}
          variant="warning"
          trend={{ value: 3, isPositive: true }}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left Column - Quota & Control */}
        <div className="space-y-6">
          <QuotaProgress current={37} max={50} />
          <AutomationToggle />
          
          {/* Next Scheduled Run */}
          <div className="glass-card p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/20">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Next Scan</h3>
                <p className="text-lg font-semibold text-foreground">In 12 minutes</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Scanning LinkedIn, Indeed, and 3 company boards
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
