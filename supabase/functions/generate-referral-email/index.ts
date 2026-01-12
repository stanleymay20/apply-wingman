import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientName, 
      recipientTitle, 
      company, 
      jobTitle, 
      userName, 
      userSkills,
      userExperience,
      userSummary
    } = await req.json();

    if (!recipientName || !company || !jobTitle || !userName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: recipientName, company, jobTitle, userName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Generate a professional referral request email for a job application.

Context:
- Sender Name: ${userName}
- Recipient Name: ${recipientName}
- Recipient Title: ${recipientTitle || "Employee"}
- Company: ${company}
- Job Title: ${jobTitle}
- Sender Skills: ${userSkills?.join(", ") || "Not specified"}
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
