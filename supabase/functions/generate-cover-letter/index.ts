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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job, cvProfile, style = "professional" } = await req.json();

    if (!job || !cvProfile) {
      return new Response(JSON.stringify({ error: "Job and CV profile required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const styleGuide = {
      professional: "Write in a formal, professional tone suitable for corporate environments.",
      modern: "Write in a contemporary, dynamic tone that shows personality while remaining professional.",
      technical: "Emphasize technical skills and achievements with specific metrics and technologies.",
      creative: "Use a more creative and engaging tone while highlighting relevant experience.",
    };

    const systemPrompt = `You are an expert cover letter writer. Create a compelling, personalized cover letter for the candidate applying to the specified job.

${styleGuide[style as keyof typeof styleGuide] || styleGuide.professional}

Guidelines:
- Keep it concise (250-350 words)
- Highlight relevant skills and experience that match the job requirements
- Show enthusiasm for the role and company
- Include a strong opening hook
- End with a clear call to action
- Do not use clichés or generic phrases
- Make it specific to both the job and candidate

Return ONLY the cover letter text, no additional formatting or explanation.`;

    const userPrompt = `Create a cover letter for this application:

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || "Not specified"}
Description: ${job.description || "Not provided"}
Requirements: ${job.requirements?.join(", ") || "Not specified"}

CANDIDATE PROFILE:
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years
Seniority: ${cvProfile.seniority_level || "Not specified"}
Summary: ${cvProfile.summary || "Not provided"}
Recent Role: ${cvProfile.work_history?.[0]?.title || "Not specified"} at ${cvProfile.work_history?.[0]?.company || "Unknown"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const coverLetter = aiData.choices?.[0]?.message?.content;

    if (!coverLetter) {
      throw new Error("No response from AI");
    }

    return new Response(JSON.stringify({ success: true, coverLetter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-cover-letter function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
