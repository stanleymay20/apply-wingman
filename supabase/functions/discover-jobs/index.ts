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

    const { keywords, locations, platforms } = await req.json();

    if (!keywords || keywords.length === 0) {
      return new Response(JSON.stringify({ error: "Keywords are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Discovering jobs with:", { keywords, locations, platforms });

    const systemPrompt = `You are a job search assistant. Generate realistic job listings based on the search criteria.
    
Return a JSON array of job objects with this structure:
[
  {
    "title": "Job Title",
    "company": "Company Name",
    "location": "City, Country or Remote",
    "source_platform": "linkedin|indeed|greenhouse|lever|workday|smartrecruiters",
    "source_url": "https://example.com/job/123",
    "description": "Full job description...",
    "requirements": ["requirement 1", "requirement 2"],
    "is_remote": true|false,
    "job_type": "full-time|part-time|contract"
  }
]

Generate 5-10 realistic job postings that match the keywords and locations provided.
Use realistic company names from the tech industry.
Vary the seniority levels and requirements.
Make descriptions detailed and realistic.`;

    const userPrompt = `Search for jobs with these criteria:
Keywords/Roles: ${keywords.join(", ")}
Preferred Locations: ${locations.length > 0 ? locations.join(", ") : "Worldwide"}
Platforms to search: ${platforms.join(", ")}

Generate realistic job listings that would appear on these platforms.`;

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
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    let jobs;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      jobs = JSON.parse(jsonMatch[1].trim());
    } catch {
      console.error("Failed to parse jobs:", content);
      throw new Error("Failed to parse discovered jobs");
    }

    // Validate and normalize jobs
    const validJobs = Array.isArray(jobs)
      ? jobs.filter(
          (job) =>
            job.title &&
            job.company &&
            job.source_platform &&
            job.source_url
        )
      : [];

    console.log(`Discovered ${validJobs.length} valid jobs`);

    return new Response(JSON.stringify({ success: true, jobs: validJobs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in discover-jobs function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
