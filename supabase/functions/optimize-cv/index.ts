import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OptimizationSection {
  section: string;
  original: string;
  optimized: string;
  improvement: string;
  impact: "high" | "medium" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cvProfileId, currentScore, atsSuggestions, targetScore = 90 } = await req.json();

    if (!cvProfileId) {
      return new Response(JSON.stringify({ error: "cvProfileId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership and get CV data
    const { data: cvProfile, error: profileError } = await supabase
      .from("cv_profiles")
      .select("*")
      .eq("id", cvProfileId)
      .single();

    if (profileError || !cvProfile) {
      return new Response(JSON.stringify({ error: "CV profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cvProfile.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for optimization
    const cvData = {
      summary: cvProfile.summary || "",
      skills: cvProfile.skills || [],
      work_history: cvProfile.work_history || [],
      education: cvProfile.education || [],
      keywords: cvProfile.keywords || [],
      experience_years: cvProfile.experience_years || 0,
      seniority_level: cvProfile.seniority_level || "",
    };

    const systemPrompt = `You are an expert ATS optimization specialist and professional resume writer. Your task is to rewrite and optimize CV content to achieve a 90%+ ATS compatibility score.

CURRENT STATE:
- Current ATS Score: ${currentScore || "Unknown"}
- Target Score: ${targetScore}%
- Suggestions from ATS analyzer: ${JSON.stringify(atsSuggestions?.suggestions || [])}

OPTIMIZATION RULES:
1. **Keywords**: Add relevant industry keywords naturally throughout
2. **Action Verbs**: Start bullet points with strong action verbs (Led, Developed, Implemented, etc.)
3. **Metrics**: Add quantifiable achievements where possible (%, $, numbers)
4. **Formatting**: Use consistent, ATS-friendly formatting
5. **Clarity**: Remove jargon, use standard job titles and skill names
6. **Completeness**: Ensure all sections are well-developed
7. **Length**: Optimize content density - not too sparse, not too verbose

RESPONSE FORMAT - Return a JSON object:
{
  "optimized_summary": "Improved professional summary with keywords and achievements",
  "optimized_skills": ["skill1", "skill2", ...],
  "optimized_work_history": [
    {
      "title": "string",
      "company": "string",
      "location": "string or null",
      "duration": "string",
      "start_date": "string",
      "end_date": "string",
      "is_current": boolean,
      "highlights": ["optimized bullet 1 with metrics", "optimized bullet 2", ...]
    }
  ],
  "optimized_keywords": ["keyword1", "keyword2", ...],
  "changes_made": [
    {
      "section": "summary|skills|work_history|keywords",
      "original": "brief original text",
      "optimized": "brief optimized text", 
      "improvement": "What was improved and why",
      "impact": "high|medium|low"
    }
  ],
  "estimated_new_score": number (0-100),
  "optimization_notes": "Brief summary of all optimizations made"
}

IMPORTANT:
- Preserve factual accuracy - never fabricate experience or skills
- Maintain the candidate's voice while improving clarity
- Focus on high-impact changes first
- Make specific, actionable improvements`;

    const userPrompt = `Optimize this CV to achieve ${targetScore}%+ ATS score:

SUMMARY:
${cvData.summary}

SKILLS:
${cvData.skills.join(", ")}

WORK HISTORY:
${JSON.stringify(cvData.work_history, null, 2)}

EDUCATION:
${JSON.stringify(cvData.education, null, 2)}

KEYWORDS:
${cvData.keywords.join(", ")}

Experience: ${cvData.experience_years} years | Level: ${cvData.seniority_level}

Return ONLY valid JSON, no markdown code blocks.`;

    console.log("Sending optimization request to AI Gateway...");
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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let optimizationResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      optimizationResult = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error("Failed to parse optimization response:", content);
      throw new Error("Failed to parse optimization data");
    }

    console.log("Optimization complete, estimated new score:", optimizationResult.estimated_new_score);

    return new Response(JSON.stringify({
      success: true,
      original: {
        summary: cvData.summary,
        skills: cvData.skills,
        work_history: cvData.work_history,
        keywords: cvData.keywords,
      },
      optimized: {
        summary: optimizationResult.optimized_summary,
        skills: optimizationResult.optimized_skills,
        work_history: optimizationResult.optimized_work_history,
        keywords: optimizationResult.optimized_keywords,
      },
      changes: optimizationResult.changes_made || [],
      estimated_score: optimizationResult.estimated_new_score,
      notes: optimizationResult.optimization_notes,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in optimize-cv function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
