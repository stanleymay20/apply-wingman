import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Target,
  Clock,
  Percent
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

const applicationTrend = [
  { date: "Jan 1", applications: 42, interviews: 3 },
  { date: "Jan 2", applications: 38, interviews: 4 },
  { date: "Jan 3", applications: 45, interviews: 2 },
  { date: "Jan 4", applications: 50, interviews: 5 },
  { date: "Jan 5", applications: 48, interviews: 4 },
  { date: "Jan 6", applications: 44, interviews: 6 },
  { date: "Jan 7", applications: 47, interviews: 4 },
  { date: "Jan 8", applications: 50, interviews: 5 },
  { date: "Jan 9", applications: 46, interviews: 3 },
  { date: "Jan 10", applications: 49, interviews: 4 },
  { date: "Jan 11", applications: 43, interviews: 5 },
  { date: "Jan 12", applications: 37, interviews: 2 },
];

const platformData = [
  { name: "LinkedIn", applications: 145, successRate: 12 },
  { name: "Indeed", applications: 78, successRate: 8 },
  { name: "Greenhouse", applications: 52, successRate: 15 },
  { name: "Lever", applications: 24, successRate: 17 },
  { name: "Direct", applications: 13, successRate: 23 },
];

const statusDistribution = [
  { name: "Applied", value: 256, color: "hsl(199, 89%, 48%)" },
  { name: "Interview", value: 28, color: "hsl(142, 76%, 36%)" },
  { name: "Rejected", value: 24, color: "hsl(0, 72%, 51%)" },
  { name: "Pending", value: 4, color: "hsl(38, 92%, 50%)" },
];

const matchScoreDistribution = [
  { range: "90-100%", count: 45 },
  { range: "80-89%", count: 89 },
  { range: "70-79%", count: 156 },
  { range: "60-69%", count: 22 },
];

export default function Analytics() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Calendar className="w-4 h-4" />
          <span className="text-sm">Last 30 days</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Track your application performance and identify opportunities
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Response Rate"
          value="9.0%"
          subtitle="28 responses from 312 apps"
          icon={Target}
          variant="success"
          trend={{ value: 15, isPositive: true }}
        />
        <StatsCard
          title="Avg. Match Score"
          value="84%"
          subtitle="Across all applications"
          icon={Percent}
          variant="primary"
          trend={{ value: 3, isPositive: true }}
        />
        <StatsCard
          title="Best Day"
          value="Thursday"
          subtitle="Most interviews received"
          icon={TrendingUp}
          variant="info"
        />
        <StatsCard
          title="Avg. Response Time"
          value="4.2 days"
          subtitle="From application to response"
          icon={Clock}
          variant="warning"
          trend={{ value: 8, isPositive: false }}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Application Trend */}
        <div className="glass-card p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-foreground mb-6">Application Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={applicationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(222, 47%, 11%)",
                    border: "1px solid hsl(222, 30%, 18%)",
                    borderRadius: "8px"
                  }}
                  labelStyle={{ color: "hsl(210, 40%, 98%)" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="applications" 
                  stroke="hsl(173, 80%, 40%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(173, 80%, 40%)", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "hsl(173, 80%, 40%)" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="interviews" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: "hsl(142, 76%, 36%)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-4 justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Applications</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Interviews</span>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "100ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-6">Status Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(222, 47%, 11%)",
                    border: "1px solid hsl(222, 30%, 18%)",
                    borderRadius: "8px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {statusDistribution.map((status) => (
              <div key={status.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm text-muted-foreground">{status.name}</span>
                <span className="text-sm font-medium text-foreground ml-auto">{status.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Performance */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "150ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-6">Platform Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(222, 47%, 11%)",
                    border: "1px solid hsl(222, 30%, 18%)",
                    borderRadius: "8px"
                  }}
                />
                <Bar 
                  dataKey="applications" 
                  fill="hsl(173, 80%, 40%)" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Match Score Distribution */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-6">Match Score Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matchScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" vertical={false} />
                <XAxis 
                  dataKey="range" 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(222, 47%, 11%)",
                    border: "1px solid hsl(222, 30%, 18%)",
                    borderRadius: "8px"
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(199, 89%, 48%)" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
