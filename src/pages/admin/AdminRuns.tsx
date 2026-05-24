import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";

interface Run {
  id: string;
  trigger_type: string;
  execution_source: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  jobs_discovered: number;
  jobs_matched: number;
  applications_attempted: number;
  applications_succeeded: number;
  applications_failed: number;
  error_summary: string | null;
  worker_version: string;
}

const statusColor = (s: string) =>
  s === "completed" ? "default" : s === "running" ? "secondary" : s === "partial" ? "outline" : "destructive";

export default function AdminRuns() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("automation_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(100);
      setRuns((data as Run[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : runs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No automation runs yet.</Card>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(r.status) as any}>{r.status}</Badge>
                    <span className="text-sm font-medium">{r.execution_source}</span>
                    <span className="text-xs text-muted-foreground">· {r.trigger_type}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{r.id.slice(0, 8)} · {r.worker_version}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}</div>
                  {r.duration_ms != null && <div>{(r.duration_ms / 1000).toFixed(2)}s</div>}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-sm">
                <Stat label="Discovered" value={r.jobs_discovered} />
                <Stat label="Matched" value={r.jobs_matched} />
                <Stat label="Attempted" value={r.applications_attempted} />
                <Stat label="Succeeded" value={r.applications_succeeded} positive />
                <Stat label="Failed" value={r.applications_failed} negative={r.applications_failed > 0} />
              </div>
              {r.error_summary && (
                <div className="mt-3 text-xs p-2 rounded bg-destructive/10 text-destructive font-mono break-all">
                  {r.error_summary}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function Stat({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${positive && value > 0 ? "text-green-600" : negative ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}
