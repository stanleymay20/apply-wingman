import { useEffect, useState } from "react";
import { Mail, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type DeliveryMode = "test" | "production" | "disabled";

interface DomainSummary {
  id: string;
  name: string;
  status: string;
  verified: boolean;
  spf_status: string;
  dkim_status: string;
  dmarc_status: string;
}

interface DomainResp {
  configured: boolean;
  error?: string;
  domains?: DomainSummary[];
  sender_test_domain?: string;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
        ok
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
      }`}
    >
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {label}
    </div>
  );
}

export function EmailInfrastructureCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [domainData, setDomainData] = useState<DomainResp | null>(null);

  const [mode, setMode] = useState<DeliveryMode>(
    (profile?.delivery_mode as DeliveryMode) || "test"
  );
  const [overrideEmail, setOverrideEmail] = useState<string>(
    profile?.test_email_override || profile?.email || ""
  );

  useEffect(() => {
    if (profile) {
      setMode((profile.delivery_mode as DeliveryMode) || "test");
      setOverrideEmail(profile.test_email_override || profile.email || "");
    }
  }, [profile]);

  const checkDomains = async (showToast = false) => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-email-domain");
      if (error) throw error;
      setDomainData(data as DomainResp);
      if (showToast) toast.success("Email status refreshed");
    } catch (e) {
      console.error(e);
      if (showToast) toast.error("Failed to check email status");
    } finally {
      setChecking(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) checkDomains(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveSettings = async () => {
    if (!user) return;
    if (mode === "test" && overrideEmail) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(overrideEmail)) {
        toast.error("Enter a valid override email");
        return;
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          delivery_mode: mode,
          test_email_override: overrideEmail || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile?.();
      toast.success("Email settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const verifiedDomains = domainData?.domains?.filter((d) => d.verified) || [];
  const pendingDomains = domainData?.domains?.filter((d) => !d.verified) || [];
  const productionReady = verifiedDomains.length > 0;

  return (
    <div className="glass-card p-6 animate-scale-in">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/20 shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-muted-foreground">Email Infrastructure</h3>
            <p className="text-lg font-semibold text-foreground truncate">
              {loading
                ? "Checking…"
                : mode === "disabled"
                ? "Delivery disabled"
                : mode === "test"
                ? "Test mode active"
                : productionReady
                ? "Production ready"
                : "Production blocked"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => checkDomains(true)}
          disabled={checking}
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Production warning */}
      {!loading && mode === "production" && !productionReady && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No verified sending domain</p>
              <p className="mt-1">
                Recruiter delivery will fail. Switch to Test mode or verify a domain in Resend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test mode banner */}
      {!loading && mode === "test" && (
        <div className="mb-4 p-3 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs">
          <p className="font-semibold mb-1">🧪 Test delivery active</p>
          <p>
            Outgoing application emails are redirected to{" "}
            <span className="font-mono">{overrideEmail || profile?.email}</span>. Real recruiters
            will not receive anything.
          </p>
        </div>
      )}

      {/* Domains */}
      {!loading && domainData && (
        <div className="space-y-2 mb-4">
          {!domainData.configured && (
            <p className="text-xs text-muted-foreground">
              Resend API key not configured.
            </p>
          )}
          {domainData.error && (
            <p className="text-xs text-destructive">{domainData.error}</p>
          )}
          {domainData.domains?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No domains added yet. Using <span className="font-mono">onboarding@resend.dev</span>{" "}
              (test only).
            </p>
          )}
          {domainData.domains?.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/60 bg-muted/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm truncate">{d.name}</span>
                  {d.verified ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/40">
                      verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                      {d.status}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <StatusPill ok={d.spf_status === "verified"} label={`SPF ${d.spf_status}`} />
                  <StatusPill ok={d.dkim_status === "verified"} label={`DKIM ${d.dkim_status}`} />
                  <StatusPill
                    ok={d.dmarc_status === "verified"}
                    label={`DMARC ${d.dmarc_status === "missing" ? "optional" : d.dmarc_status}`}
                  />
                </div>
              </div>
            </div>
          ))}
          {pendingDomains.length > 0 && (
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open Resend to verify <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="space-y-3 pt-3 border-t border-border/60">
        <div>
          <Label className="text-xs">Delivery mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as DeliveryMode)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test — redirect to my inbox</SelectItem>
              <SelectItem value="production" disabled={!productionReady}>
                Production — send to recruiters {productionReady ? "" : "(needs verified domain)"}
              </SelectItem>
              <SelectItem value="disabled">Disabled — block all sends</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "test" && (
          <div>
            <Label className="text-xs">Test override email</Label>
            <Input
              type="email"
              value={overrideEmail}
              onChange={(e) => setOverrideEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1"
            />
          </div>
        )}
        <Button onClick={saveSettings} disabled={saving} size="sm" className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save settings
        </Button>
      </div>
    </div>
  );
}
