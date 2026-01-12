import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobData {
  title: string;
  company: string;
  description: string;
  requirements: string[];
}

interface CVData {
  skills: string[];
  experience_years: number;
  seniority_level: string;
  work_history: Array<{
    title: string;
    company: string;
    duration: string;
    highlights: string[];
  }>;
  education: Array<{
    degree: string;
    field: string;
    institution: string;
  }>;
  summary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { job, cvProfile }: { job: JobData; cvProfile: CVData } = await req.json();

    if (!job || !cvProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Job and CV profile required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert career advisor creating HONEST job application materials. 

CRITICAL RULES:
1. ONLY claim skills the candidate actually has (listed in their CV)
2. NEVER exaggerate experience or capabilities
3. NEVER invent achievements or projects not in the CV
4. If candidate lacks a required skill, acknowledge the gap but show willingness to learn
5. Use specific examples from their actual work history
6. Be professional but authentic - no generic fluff
7. Highlight genuine matches between candidate skills and job requirements

Your output should be grounded ONLY in the provided CV data.`;

    const userPrompt = `Create an honest, tailored job application contract for this position.

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Requirements: ${job.requirements?.join(", ") || "Not specified"}

CANDIDATE CV DATA:
Skills: ${cvProfile.skills?.join(", ") || "Not specified"}
Experience: ${cvProfile.experience_years || 0} years
Level: ${cvProfile.seniority_level || "Not specified"}
Summary: ${cvProfile.summary || "Not provided"}

Work History:
${cvProfile.work_history?.map(w => `- ${w.title} at ${w.company} (${w.duration}): ${w.highlights?.join("; ") || "No highlights"}`).join("\n") || "Not provided"}

Education:
${cvProfile.education?.map(e => `- ${e.degree} in ${e.field} from ${e.institution}`).join("\n") || "Not provided"}

Generate a structured application contract with:
1. SKILL MATCH ANALYSIS - Which required skills the candidate has vs lacks (be honest)
2. TAILORED COVER LETTER - Based only on actual experience, no exaggeration
3. KEY TALKING POINTS - Specific examples from their real work history
4. HONEST GAP ACKNOWLEDGMENT - Skills they'd need to develop
5. INTERVIEW PREPARATION - Questions to prepare for based on gaps

Return as JSON with this structure:
{
  "skillMatch": {
    "matched": ["skill1", "skill2"],
    "missing": ["skill3"],
    "partialMatch": ["skill4 - have basic knowledge"]
  },
  "coverLetter": "...",
  "talkingPoints": ["point1", "point2"],
  "gapsToAddress": ["gap1 - how to address it"],
  "interviewPrep": ["question1", "question2"],
  "overallFitScore": 75,
  "honestAssessment": "..."
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_application_contract",
              description: "Generate an honest, tailored job application contract",
              parameters: {
                type: "object",
                properties: {
                  skillMatch: {
                    type: "object",
                    properties: {
                      matched: { type: "array", items: { type: "string" } },
                      missing: { type: "array", items: { type: "string" } },
                      partialMatch: { type: "array", items: { type: "string" } },
                    },
                    required: ["matched", "missing", "partialMatch"],
                  },
                  coverLetter: { type: "string" },
                  talkingPoints: { type: "array", items: { type: "string" } },
                  gapsToAddress: { type: "array", items: { type: "string" } },
                  interviewPrep: { type: "array", items: { type: "string" } },
                  overallFitScore: { type: "number" },
                  honestAssessment: { type: "string" },
                },
                required: ["skillMatch", "coverLetter", "talkingPoints", "gapsToAddress", "interviewPrep", "overallFitScore", "honestAssessment"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_application_contract" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const contract = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: true, contract }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback to parsing content
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const contract = JSON.parse(jsonMatch[0]);
      return new Response(
        JSON.stringify({ success: true, contract }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Failed to generate contract" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Contract generation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});