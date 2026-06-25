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
    const { cvText, skills, experience_years, seniority_level } = await req.json();
    
    if (!cvText || cvText.length < 100) {
      return new Response(
        JSON.stringify({ error: "CV text is required (minimum 100 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `You are an expert ATS (Applicant Tracking System) analyzer and resume reviewer. Analyze this resume/CV and provide:

1. An ATS compatibility score from 0-100
2. Specific suggestions to improve ATS compatibility
3. Key strengths identified
4. Missing elements that would improve the resume

Resume/CV Content:
${cvText}

${skills?.length ? `Extracted Skills: ${skills.join(", ")}` : ""}
${experience_years ? `Years of Experience: ${experience_years}` : ""}
${seniority_level ? `Seniority Level: ${seniority_level}` : ""}

Respond using the score_resume function.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are an expert ATS analyzer. Analyze resumes for ATS compatibility." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "score_resume",
              description: "Return ATS analysis results",
              parameters: {
                type: "object",
                properties: {
                  score: { 
                    type: "number", 
                    description: "ATS compatibility score 0-100" 
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { 
                          type: "string", 
                          enum: ["formatting", "keywords", "structure", "content", "length"] 
                        },
                        priority: { 
                          type: "string", 
                          enum: ["high", "medium", "low"] 
                        },
                        suggestion: { type: "string" }
                      },
                      required: ["category", "priority", "suggestion"]
                    }
                  },
                  strengths: {
                    type: "array",
                    items: { type: "string" }
                  },
                  missing_elements: {
                    type: "array",
                    items: { type: "string" }
                  },
                  keyword_density: {
                    type: "string",
                    description: "Assessment of keyword usage: poor, fair, good, excellent"
                  }
                },
                required: ["score", "suggestions", "strengths", "missing_elements", "keyword_density"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "score_resume" } }
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
      throw new Error("Failed to analyze resume");
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
    console.error("Score resume error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
