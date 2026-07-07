import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  MinusCircle,
  RefreshCw,
  Zap,
  Cloud,
  Server,
  Info,
} from "lucide-react";

type ProviderId = "groq" | "openai" | "local";

interface ProviderHealth {
  provider: string;
  configured: boolean;
  reachable: boolean;
  status: "ok" | "degraded" | "down" | "not_configured";
  detail: string;
  latencyMs?: number;
}

interface HealthResponse {
  success: boolean;
  activeProvider: string;
  activeModel: string;
  configured: string[];
  localConfigured: boolean;
  health: ProviderHealth[];
}

const PROVIDER_META: Record<ProviderId, { label: string; icon: typeof Zap; blurb: string; modelHint: string }> = {
  groq: {
    label: "Groq (recommended)",
    icon: Zap,
    blurb: "Cloud-hosted, OpenAI-compatible, very fast, generous free tier. No infrastructure required.",
    modelHint: "llama-3.3-70b-versatile or qwen/qwen3-32b",
  },
  openai: {
    label: "OpenAI",
    icon: Cloud,
    blurb: "Highest quality, pay-as-you-go. Requires an OpenAI API key.",
    modelHint: "gpt-4o-mini or gpt-4o",
  },
  local: {
    label: "Local / self-hosted (advanced)",
    icon: Server,
    blurb: "Your own Ollama/Qwen model behind a PUBLIC HTTPS endpoint (ngrok, Cloudflare Tunnel, RunPod, Fly.io). Never localhost — Lovable Cloud cannot reach private/LAN URLs.",
    modelHint: "qwen2.5:14b",
  },
};

function StatusIcon({ status }: { status: ProviderHealth["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "degraded") return <AlertCircle className="h-4 w-4 text-amber-600" />;
  if (status === "not_configured") return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export default function AdminAIProvider() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("groq");
  const [model, setModel] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("key,value")
      .in("key", ["ai_provider", "ai_model"]);
    for (const row of data ?? []) {
      const v = typeof row.value === "string" ? row.value : String(row.value ?? "");
      if (row.key === "ai_provider" && (v === "groq" || v === "openai" || v === "local")) {
        setProvider(v);
      }
      if (row.key === "ai_model") setModel(v);
    }
  }, []);

  const runHealthCheck = useCallback(async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-health");
      if (error) throw error;
      setHealth(data as HealthResponse);
    } catch (e) {
      toast.error(`Health check failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadSettings();
      await runHealthCheck();
      setLoading(false);
    })();
  }, [loadSettings, runHealthCheck]);

  const save = async () => {
    setSaving(true);
    try {
      const rows = [
        { key: "ai_provider", value: provider, value_type: "string", scope: "global" },
        { key: "ai_model", value: model || null, value_type: "string", scope: "global" },
      ].filter((r) => r.value !== null);
      const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("AI provider settings saved. Changes apply within ~30 seconds.");
      await runHealthCheck();
    } catch (e) {
      toast.error(`Failed to save: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const healthFor = (id: string) => health?.health.find((h) => h.provider === id);

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner text="Loading AI provider settings..." />
        </div>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {/* Active status */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm text-muted-foreground">Currently active</div>
                <div className="text-lg font-semibold capitalize">
                  {health?.activeProvider ?? provider}
                  <span className="text-muted-foreground font-normal text-sm"> · {health?.activeModel || "provider default"}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={runHealthCheck} disabled={checking}>
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                Re-run health check
              </Button>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {health?.health.map((h) => (
                <div key={h.provider} className="flex items-center gap-2 rounded-md border border-border p-2.5">
                  <StatusIcon status={h.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium capitalize">{h.provider}</div>
                    <div className="text-xs text-muted-foreground truncate">{h.detail}</div>
                  </div>
                  <Badge variant={h.status === "ok" ? "default" : h.status === "not_configured" ? "outline" : "secondary"}>
                    {h.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Provider selection */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-1">Choose AI provider</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Powers job discovery, resume scoring, matching, and per-job CV/cover-letter tailoring.
            </p>

            <RadioGroup value={provider} onValueChange={(v) => setProvider(v as ProviderId)} className="space-y-3">
              {(Object.keys(PROVIDER_META) as ProviderId[]).map((id) => {
                const meta = PROVIDER_META[id];
                const Icon = meta.icon;
                const h = healthFor(id);
                return (
                  <label
                    key={id}
                    htmlFor={`prov-${id}`}
                    className={`flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      provider === id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <RadioGroupItem value={id} id={`prov-${id}`} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="font-medium">{meta.label}</span>
                        {h && <StatusIcon status={h.status} />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{meta.blurb}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>

            <div className="mt-4 space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={PROVIDER_META[provider].modelHint}
              />
              <p className="text-xs text-muted-foreground">
                Suggested for {PROVIDER_META[provider].label}: {PROVIDER_META[provider].modelHint}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save provider settings"}
              </Button>
            </div>
          </Card>

          {/* Secret / env guidance */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Credentials are stored as backend secrets</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>Selecting a provider here only routes traffic. The matching secret must exist in the backend:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><code>GROQ_API_KEY</code> for Groq</li>
                <li><code>OPENAI_API_KEY</code> for OpenAI</li>
                <li>
                  <code>LOCAL_LLM_BASE_URL</code> (public HTTPS, e.g. <code>https://xxxx.ngrok.app/v1</code>) and{" "}
                  <code>LOCAL_LLM_API_KEY</code> for a self-hosted model
                </li>
              </ul>
              <p className="text-muted-foreground">
                Local mode must be a public HTTPS endpoint (ngrok, Cloudflare Tunnel, RunPod, Fly.io). Lovable Cloud
                cannot reach <code>localhost</code> or private LAN addresses.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </AdminLayout>
  );
}
