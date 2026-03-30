import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default function ActivityLog() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activity-logs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("application_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const levelIcon = (level: string | null) => {
    switch (level) {
      case "error":
        return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
      case "warn":
        return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
      case "info":
        return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  const levelBadgeVariant = (level: string | null) => {
    switch (level) {
      case "error":
        return "destructive" as const;
      case "warn":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullPage text="Loading activity log..." />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Activity Log</h1>
        <p className="text-muted-foreground">
          Chronological record of all auto-apply events, errors, and delivery statuses
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 animate-scale-in">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-border"
              maxLength={100}
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full sm:w-36 bg-secondary border-border">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-in">
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-success">
            {logs.filter((l) => l.level === "info").length}
          </p>
          <p className="text-xs text-muted-foreground">Success</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-warning">
            {logs.filter((l) => l.level === "warn").length}
          </p>
          <p className="text-xs text-muted-foreground">Warnings</p>
        </div>
        <div className="glass-card p-3 text-center">
          <p className="text-2xl font-bold text-destructive">
            {logs.filter((l) => l.level === "error").length}
          </p>
          <p className="text-xs text-muted-foreground">Errors</p>
        </div>
      </div>

      {/* Log entries */}
      <div className="space-y-2 animate-scale-in">
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Events will appear here as your automation runs"
          />
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={log.id}
              className="glass-card p-4 animate-slide-in"
              style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
            >
              <div className="flex items-start gap-3">
                {levelIcon(log.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={levelBadgeVariant(log.level)} className="text-xs">
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {log.created_at
                        ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                        : "Unknown"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground break-words">{log.message}</p>
                  {log.details && Object.keys(log.details as object).length > 0 && (
                    <pre className="mt-2 text-xs text-muted-foreground bg-secondary/50 rounded p-2 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                  {log.created_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.created_at), "PPpp")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredLogs.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4 text-center animate-fade-in">
          Showing {filteredLogs.length} of {logs.length} events
        </p>
      )}
    </div>
  );
}
