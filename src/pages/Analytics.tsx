import { 
  TrendingUp, 
  Calendar,
  Target,
  Clock,
  Percent,
  BarChart3,
  Loader2
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
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { EmptyState } from "@/components/common/EmptyState";

export default function Analytics() {
  const { data, isLoading } = useAnalyticsData(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.totalApplications === 0) {
    return (
      <div className="max-w-7xl mx-auto">
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
        <EmptyState
          icon={BarChart3}
          title="No analytics data yet"
          description="Start applying to jobs to see your performance analytics here."
        />
      </div>
    );
  }

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
          value={`${data.responseRate}%`}
          subtitle={`${data.totalInterviews} responses from ${data.totalApplications} apps`}
          icon={Target}
          variant="success"
          trend={data.responseRate > 5 ? { value: data.responseRate, isPositive: true } : undefined}
        />
        <StatsCard
          title="Avg. Match Score"
          value={`${data.avgMatchScore}%`}
          subtitle="Across all applications"
          icon={Percent}
          variant="primary"
          trend={data.avgMatchScore > 70 ? { value: 3, isPositive: true } : undefined}
        />
        <StatsCard
          title="Best Day"
          value={data.bestDay}
          subtitle="Most interviews received"
          icon={TrendingUp}
          variant="info"
        />
        <StatsCard
          title="Avg. Response Time"
          value={data.avgResponseTime > 0 ? `${data.avgResponseTime} days` : "N/A"}
          subtitle="From application to response"
          icon={Clock}
          variant="warning"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Application Trend */}
        <div className="glass-card p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-foreground mb-6">Application Trend</h3>
          <div className="h-64">
            {data.applicationTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.applicationTrend}>
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
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
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
            {data.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.statusDistribution.map((entry, index) => (
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
            ) : (
              <div className="text-muted-foreground">No status data available</div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {data.statusDistribution.map((status) => (
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
            {data.platformData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.platformData} layout="vertical">
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
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No platform data available
              </div>
            )}
          </div>
        </div>

        {/* Match Score Distribution */}
        <div className="glass-card p-6 animate-scale-in" style={{ animationDelay: "200ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-6">Match Score Distribution</h3>
          <div className="h-64">
            {data.matchScoreDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.matchScoreDistribution}>
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
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No match score data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}