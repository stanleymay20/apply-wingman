import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "re_EVvTskuc_Edyr8VHpm2xaQV7GnUiWpmbJ";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_JWKS = Deno.env.get("SUPABASE_JWKS")!;

interface DomainRecord {
  record: string;
  name: string;
  type: string;
  ttl?: string;
  status: string;
  value: string;
}

interface ResendDomain {
  id: string;
  name: string;
  status: string; // 'verified' | 'pending' | 'not_started' | 'failed' | 'temporary_failure'
  created_at: string;
  region?: string;
  records?: DomainRecord[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_JWKS);
    const token = auth.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          configured: false,
          error: "RESEND_API_KEY not configured",
          domains: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List domains
    const listRes = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      return new Response(
        JSON.stringify({
          configured: true,
          error: `Resend API error: ${listRes.status} ${text}`,
          domains: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listJson = await listRes.json();
    const domains: ResendDomain[] = listJson.data || [];

    // Fetch detail (records) for each domain
    const detailed = await Promise.all(
      domains.map(async (d) => {
        try {
          const r = await fetch(`https://api.resend.com/domains/${d.id}`, {
            headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          });
          if (!r.ok) return d;
          const json = await r.json();
          return { ...d, ...json } as ResendDomain;
        } catch {
          return d;
        }
      })
    );

    const summary = detailed.map((d) => {
      const records = d.records || [];
      const spf = records.find((r) => r.type === "TXT" && /spf/i.test(r.value));
      const dkim = records.find((r) => r.record?.toLowerCase().includes("dkim") || r.name?.includes("_domainkey"));
      const dmarc = records.find((r) => r.name?.includes("_dmarc"));
      return {
        id: d.id,
        name: d.name,
        status: d.status,
        verified: d.status === "verified",
        spf_status: spf?.status || "missing",
        dkim_status: dkim?.status || "missing",
        dmarc_status: dmarc?.status || "missing",
        records,
      };
    });

    return new Response(
      JSON.stringify({
        configured: true,
        domains: summary,
        sender_test_domain: "onboarding@resend.dev",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-email-domain error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
