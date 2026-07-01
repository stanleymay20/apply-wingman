import { callAI, callAIJson, AIRateLimitError, AICreditsError } from "../_shared/aiClient.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation
function validateInput(data: unknown): { valid: boolean; error?: string; data?: Record<string, unknown> } {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const input = data as Record<string, unknown>;

  // Required fields
  const requiredFields = ["recipientName", "company", "jobTitle", "userName"];
  for (const field of requiredFields) {
    if (!input[field] || typeof input[field] !== "string") {
      return { valid: false, error: `Missing required field: ${field}` };
    }
    if ((input[field] as string).length > 200) {
      return { valid: false, error: `${field} too long (max 200 chars)` };
    }
  }

  // Optional fields validation
  if (input.userSummary && typeof input.userSummary === "string" && input.userSummary.length > 2000) {
    return { valid: false, error: "User summary too long (max 2000 chars)" };
  }

  return { valid: true, data: input };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== AUTHENTICATION =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log(`Authenticated user for referral email: ${userId}`);
    // ===== END AUTHENTICATION =====

    // Parse and validate input
    const rawInput = await req.json();
    const validation = validateInput(rawInput);

    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      recipientName, 
      recipientTitle, 
      company, 
      jobTitle, 
      userName, 
      userSkills,
      userExperience,
      userSummary
    } = validation.data;

    const skillsStr = Array.isArray(userSkills) 
      ? userSkills.filter((s): s is string => typeof s === "string").slice(0, 20).join(", ")
      : "Not specified";

    const systemPrompt = `You are an expert at writing professional networking and referral request emails. Return ONLY valid JSON with this structure:
{
  "subject": "Email subject line",
  "body": "Full email body",
  "tips": ["tip1", "tip2"]
}`;

    const userPrompt = `Generate a professional referral request email:

Context:
- Sender Name: ${userName}
- Recipient Name: ${recipientName}
- Recipient Title: ${recipientTitle || "Employee"}
- Company: ${company}
- Job Title: ${jobTitle}
- Sender Skills: ${skillsStr}
- Sender Experience: ${userExperience || "Not specified"} years
- Sender Summary: ${userSummary || "Experienced professional"}

Requirements:
1. Compelling subject line
2. Brief sender introduction
3. Explain interest in company and role
4. Politely request a referral or informational chat
5. Under 200 words, natural and authentic`;

    let result: unknown;
    try {
      result = await callAIJson({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      });
    } catch (e) {
      if (e instanceof AIRateLimitError) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (e instanceof AICreditsError) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Set GOOGLE_API_KEY in Supabase secrets." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate referral email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
