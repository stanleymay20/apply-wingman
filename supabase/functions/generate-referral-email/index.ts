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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const skillsStr = Array.isArray(userSkills) 
      ? userSkills.filter((s): s is string => typeof s === "string").slice(0, 20).join(", ")
      : "Not specified";

    const prompt = `Generate a professional referral request email for a job application.

Context:
- Sender Name: ${userName}
- Recipient Name: ${recipientName}
- Recipient Title: ${recipientTitle || "Employee"}
- Company: ${company}
- Job Title: ${jobTitle}
- Sender Skills: ${skillsStr}
- Sender Experience: ${userExperience || "Not specified"} years
- Sender Summary: ${userSummary || "Experienced professional"}

Generate a personalized, professional email that:
1. Has a compelling subject line
2. Introduces the sender briefly
3. Explains interest in the company and role
4. Politely requests a referral or informational chat
5. Keeps it concise (under 200 words)
6. Sounds natural and authentic, not generic

Respond using the generate_email function.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert at writing professional networking and referral request emails." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Return the generated referral email",
              parameters: {
                type: "object",
                properties: {
                  subject: { 
                    type: "string", 
                    description: "Email subject line" 
                  },
                  body: { 
                    type: "string", 
                    description: "Email body content" 
                  },
                  tips: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tips for improving the email or follow-up"
                  }
                },
                required: ["subject", "body"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Failed to generate email");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);

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
