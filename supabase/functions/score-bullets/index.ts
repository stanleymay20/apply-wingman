import { callAI, callAIJson, AIRateLimitError, AICreditsError } from "../_shared/aiClient.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bullets } = await req.json();

    if (!Array.isArray(bullets) || bullets.length === 0) {
      return new Response(JSON.stringify({ error: "bullets array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert resume coach. For each bullet point provided, return a JSON analysis with:
- impact_score: 1-10 (10 = highly impactful, quantified, strong verb; 1 = vague, weak verb, no metrics)
- weak_verb: the opening verb if it's weak (e.g. "helped", "worked", "was responsible for", "assisted"), or null if strong
- strong_verb: a better replacement verb if weak_verb exists, otherwise null
- has_metric: true if the bullet contains a number/percentage/dollar amount
- improved: a rewritten version of the bullet with stronger verb + quantification placeholder if missing
- reason: one short sentence explaining the score

Return a JSON object: { "results": [ { "original": "...", "impact_score": 7, "weak_verb": null, "strong_verb": null, "has_metric": true, "improved": "...", "reason": "..." }, ... ] }`;

    const userPrompt = `Score these resume bullets:\n${bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join("\n")}`;

    let result: { results?: unknown[] };
    try {
      result = await callAIJson({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      });
    } catch (e) {
      if (e instanceof AIRateLimitError) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e instanceof AICreditsError) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Set GOOGLE_API_KEY in Supabase secrets." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    return new Response(JSON.stringify({ success: true, results: result.results || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in score-bullets function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
