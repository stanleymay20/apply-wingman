import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";

interface Failure {
  id: string;
  occurred_at: string;
  step_name: string | null;
  error_code: string;
  error_message: string;
  retryable: boolean;
  retry_count: number;
  dead_lettered: boolean;
  user_id: string;
  application_id: string | null;
  run_id: string | null;
}

export default function AdminFailures() {
  const [rows, setRows] = useState<Failure[]>([]);
  const [grouped, setGrouped] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("automation_failures")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(200);
      const list = (data as Failure[]) ?? [];
      setRows(list);
      const g: Record<string, number> = {};
      list.forEach((f) => { g[f.error_code] = (g[f.error_code] ?? 0) + 1; });
      setGrouped(g);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <>
          <Card className="p-4 mb-4">
            <div className="text-sm font-semibold mb-3">Failure counts by error code (last 200)</div>
            {Object.keys(grouped).length === 0 ? (
              <div className="text-sm text-muted-foreground">No failures recorded.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
                  <Badge key={code} variant="outline" className="text-xs">
                    {code} · <span className="ml-1 font-bold">{count}</span>
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-2">
            {rows.map((f) => (
              <Card key={f.id} className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={f.dead_lettered ? "destructive" : f.retryable ? "secondary" : "outline"}>
                        {f.dead_lettered ? "dead-letter" : f.retryable ? "retryable" : "terminal"}
                      </Badge>
                      <span className="text-sm font-mono">{f.error_code}</span>
                      {f.step_name && <span className="text-xs text-muted-foreground">@ {f.step_name}</span>}
                      {f.retry_count > 0 && <span className="text-xs text-muted-foreground">· retry #{f.retry_count}</span>}
                    </div>
                    <div className="text-sm text-foreground/90 break-words">{f.error_message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(f.occurred_at), { addSuffix: true })}
                  </div>
                </div>
              </Card>
            ))}
            {rows.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">No failures recorded.</Card>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
