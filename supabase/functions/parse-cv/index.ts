import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    // avoid workers in the edge runtime (types don't include this flag)
    disableWorker: true,
  } as any);

  const pdf = await loadingTask.promise;
  const textParts: string[] = [];

  // cap pages for performance
  const maxPages = Math.min(pdf.numPages, 20);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as any[])
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n\n");
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { cvText, cvFileUrl, cvProfileId } = await req.json();

    let effectiveText: string | null = typeof cvText === "string" ? cvText : null;

    // If text wasn't provided, try to extract it from an uploaded file (PDF)
    if (!effectiveText && cvFileUrl) {
      const url = String(cvFileUrl);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch CV file (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";
      const buf = await res.arrayBuffer();

      const looksLikePdf =
        contentType.includes("application/pdf") || url.toLowerCase().includes(".pdf");

      if (!looksLikePdf) {
        return new Response(
          JSON.stringify({ error: "Unsupported file type. Please paste CV text." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      effectiveText = await extractTextFromPdf(buf);
    }

    if (!effectiveText || !effectiveText.trim()) {
      return new Response(JSON.stringify({ error: "CV text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep within reasonable limits for the model
    if (effectiveText.length > 60000) {
      effectiveText = effectiveText.slice(0, 60000);
    }


    const systemPrompt = `You are an expert CV/Resume parser. Extract structured information from the provided CV text and return a JSON object with the following structure:

{
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "summary": "A 2-3 sentence professional summary",
  "skills": ["array", "of", "skills"],
  "experience_years": number,
  "seniority_level": "junior|mid|senior|lead|principal|executive",
  "languages": ["German", "English", etc.],
  "keywords": ["relevant", "job", "keywords"],
  "education": [
    {
      "degree": "string",
      "field": "string",
      "institution": "string",
      "year": number or null
    }
  ],
  "work_history": [
    {
      "title": "string",
      "company": "string",
      "duration": "string",
      "start_year": number or null,
      "end_year": number or null,
      "highlights": ["array", "of", "achievements"]
    }
  ]
}

Be thorough and extract all relevant information. Focus on technical skills, certifications, and quantifiable achievements.`;

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
          { role: "user", content: `Parse this CV:\n\n${effectiveText}` },
        ],
        temperature: 0.1,
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

    // Parse the JSON from the AI response
    let parsedCV;
    try {
      // Handle markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsedCV = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse CV data");
    }

    // Update the CV profile in the database if cvProfileId is provided
    if (cvProfileId) {
      const { error: updateError } = await supabase
        .from("cv_profiles")
        .update({
          parsed_data: parsedCV,
          skills: parsedCV.skills || [],
          experience_years: parsedCV.experience_years || 0,
          seniority_level: parsedCV.seniority_level || null,
          languages: parsedCV.languages || [],
          education: parsedCV.education || [],
          work_history: parsedCV.work_history || [],
          summary: parsedCV.summary || null,
          keywords: parsedCV.keywords || [],
          last_parsed_at: new Date().toISOString(),
        })
        .eq("id", cvProfileId);

      if (updateError) {
        console.error("Failed to update CV profile:", updateError);
      }
    }

    return new Response(JSON.stringify({ success: true, data: parsedCV }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in parse-cv function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
