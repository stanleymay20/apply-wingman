import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatDistanceToNow } from "date-fns";

interface Row {
  id: string;
  status: string;
  delivery_provider: string | null;
  delivery_provider_message_id: string | null;
  delivery_verified_at: string | null;
  delivery_mode: string | null;
  error_code: string | null;
  error_message: string | null;
  applied_at: string | null;
  retry_count: number;
  dead_lettered_at: string | null;
}

interface Counts {
  delivered: number;
  verified: number;
  failed: number;
  dead_lettered: number;
  retrying: number;
  manual: number;
}

export default function AdminDelivery() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts>({ delivered: 0, verified: 0, failed: 0, dead_lettered: 0, retrying: 0, manual: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [recent, statusAgg, verifiedAgg, deadAgg] = await Promise.all([
        supabase.from("applications")
          .select("id,status,delivery_provider,delivery_provider_message_id,delivery_verified_at,delivery_mode,error_code,error_message,applied_at,retry_count,dead_lettered_at")
          .order("updated_at", { ascending: false }).limit(100),
        supabase.from("applications").select("status", { count: "exact", head: false }),
        supabase.from("applications").select("id", { count: "exact", head: true }).not("delivery_verified_at", "is", null),
        supabase.from("applications").select("id", { count: "exact", head: true }).not("dead_lettered_at", "is", null),
      ]);

      const list = (recent.data as Row[]) ?? [];
      setRows(list);

      const all = (statusAgg.data as { status: string }[] | null) ?? [];
      const c: Counts = { delivered: 0, verified: 0, failed: 0, dead_lettered: 0, retrying: 0, manual: 0 };
      all.forEach((r) => {
        if (r.status === "delivered") c.delivered++;
        if (r.status === "failed") c.failed++;
        if (r.status === "retrying") c.retrying++;
        if (r.status === "manual_action_required") c.manual++;
      });
      c.verified = verifiedAgg.count ?? 0;
      c.dead_lettered = deadAgg.count ?? 0;
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <CountCard label="Delivered" value={counts.delivered} tone="success" />
            <CountCard label="Verified" value={counts.verified} tone="success" />
            <CountCard label="Retrying" value={counts.retrying} tone="warn" />
            <CountCard label="Manual" value={counts.manual} tone="warn" />
            <CountCard label="Failed" value={counts.failed} tone="error" />
            <CountCard label="Dead-letter" value={counts.dead_lettered} tone="error" />
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={
                        r.status === "delivered" ? "default" :
                        r.status === "failed" ? "destructive" :
                        r.status === "retrying" ? "secondary" : "outline"
                      }>{r.status}</Badge>
                      {r.delivery_provider && <span className="text-xs text-muted-foreground">{r.delivery_provider}</span>}
                      {r.delivery_mode && <Badge variant="outline" className="text-xs">{r.delivery_mode}</Badge>}
                      {r.retry_count > 0 && <span className="text-xs text-muted-foreground">retries: {r.retry_count}</span>}
                    </div>
                    {r.delivery_provider_message_id && (
                      <div className="text-xs font-mono text-muted-foreground truncate">msg: {r.delivery_provider_message_id}</div>
                    )}
                    {r.error_code && (
                      <div className="text-xs text-destructive break-words">
                        <span className="font-mono">{r.error_code}</span>
                        {r.error_message ? <> · {r.error_message}</> : null}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap text-right">
                    {r.delivery_verified_at
                      ? `verified ${formatDistanceToNow(new Date(r.delivery_verified_at), { addSuffix: true })}`
                      : r.applied_at
                      ? `applied ${formatDistanceToNow(new Date(r.applied_at), { addSuffix: true })}`
                      : "—"}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function CountCard({ label, value, tone }: { label: string; value: number; tone: "success" | "warn" | "error" }) {
  const color = tone === "success" ? "text-green-600" : tone === "warn" ? "text-amber-600" : "text-destructive";
  return (
    <Card className="p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </Card>
  );
}
