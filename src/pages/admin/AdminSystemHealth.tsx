import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface Health {
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export default function AdminSystemHealth() {
  const [items, setItems] = useState<Health[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const since30m = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [lastRun, recentRuns, recentFailures, pendingBacklog, deadLetters, verifiedToday, notifFailed] = await Promise.all([
        supabase.from("automation_runs").select("started_at,execution_source,status").order("started_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("automation_runs").select("id", { count: "exact", head: true }).gte("started_at", since30m),
        supabase.from("automation_failures").select("id", { count: "exact", head: true }).gte("occurred_at", since24h),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("applications").select("id", { count: "exact", head: true }).not("dead_lettered_at", "is", null),
        supabase.from("applications").select("id", { count: "exact", head: true }).gte("delivery_verified_at", since24h),
        supabase.from("notification_events").select("id", { count: "exact", head: true }).not("delivery_error", "is", null).gte("created_at", since24h),
      ]);

      const lastRunAt = lastRun.data?.started_at ? new Date(lastRun.data.started_at) : null;
      const ageMin = lastRunAt ? (now.getTime() - lastRunAt.getTime()) / 60000 : Infinity;

      const health: Health[] = [
        {
          label: "Cron heartbeat",
          status: ageMin < 30 ? "ok" : ageMin < 120 ? "warn" : "fail",
          detail: lastRunAt
            ? `Last run ${formatDistanceToNow(lastRunAt, { addSuffix: true })} (${lastRun.data?.execution_source})`
            : "No runs recorded",
        },
        {
          label: "Runs in last 30m",
          status: (recentRuns.count ?? 0) > 0 ? "ok" : "warn",
          detail: `${recentRuns.count ?? 0} run(s)`,
        },
        {
          label: "Failures in 24h",
          status: (recentFailures.count ?? 0) === 0 ? "ok" : (recentFailures.count ?? 0) < 20 ? "warn" : "fail",
          detail: `${recentFailures.count ?? 0} failure(s)`,
        },
        {
          label: "Pending backlog",
          status: (pendingBacklog.count ?? 0) < 25 ? "ok" : (pendingBacklog.count ?? 0) < 100 ? "warn" : "fail",
          detail: `${pendingBacklog.count ?? 0} application(s) waiting`,
        },
        {
          label: "Dead-letter queue",
          status: (deadLetters.count ?? 0) === 0 ? "ok" : "warn",
          detail: `${deadLetters.count ?? 0} permanently failed`,
        },
        {
          label: "Verified deliveries (24h)",
          status: (verifiedToday.count ?? 0) > 0 ? "ok" : "warn",
          detail: `${verifiedToday.count ?? 0} provider-confirmed`,
        },
        {
          label: "Notification delivery (24h)",
          status: (notifFailed.count ?? 0) === 0 ? "ok" : "warn",
          detail: `${notifFailed.count ?? 0} delivery error(s)`,
        },
      ];

      setItems(health);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((h) => {
            const Icon = h.status === "ok" ? CheckCircle2 : h.status === "warn" ? AlertCircle : XCircle;
            const color = h.status === "ok" ? "text-green-600" : h.status === "warn" ? "text-amber-600" : "text-destructive";
            return (
              <Card key={h.label} className="p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{h.label}</div>
                      <Badge variant={h.status === "ok" ? "default" : h.status === "warn" ? "secondary" : "destructive"}>
                        {h.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{h.detail}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
