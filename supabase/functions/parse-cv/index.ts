import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { cvText, cvFileUrl, cvProfileId } = await req.json();
    console.log("Received request:", { hasCvText: !!cvText, hasCvFileUrl: !!cvFileUrl, cvProfileId });

    let effectiveText: string | null = typeof cvText === "string" ? cvText : null;
    let pdfBase64: string | null = null;

    // If text wasn't provided but we have a file URL, fetch it
    if (!effectiveText && cvFileUrl) {
      const url = String(cvFileUrl);
      console.log("Fetching CV file from URL...");
      
      const res = await fetch(url);
      if (!res.ok) {
        console.error("Failed to fetch CV file:", res.status, res.statusText);
        throw new Error(`Failed to fetch CV file (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";
      const buf = await res.arrayBuffer();
      console.log("Downloaded file, size:", buf.byteLength, "contentType:", contentType);

      const isPdf = contentType.includes("application/pdf") || url.toLowerCase().includes(".pdf");

      if (isPdf) {
        // Convert PDF to base64 for Gemini's document understanding
        pdfBase64 = base64Encode(buf);
        console.log("Converted PDF to base64, length:", pdfBase64.length);
      } else {
        // Try to read as text
        const decoder = new TextDecoder("utf-8");
        effectiveText = decoder.decode(buf);
      }
    }

    if (!effectiveText && !pdfBase64) {
      return new Response(JSON.stringify({ error: "CV text or PDF file is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert CV/Resume parser. Extract structured information from the provided CV and return a JSON object with the following structure:

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

Be thorough and extract all relevant information. Focus on technical skills, certifications, and quantifiable achievements. Return ONLY the JSON object, no markdown code blocks.`;

    // Build messages based on whether we have text or PDF
    let messages: any[];
    if (pdfBase64) {
      // Use Gemini's document understanding with inline PDF
      console.log("Using PDF document understanding...");
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Parse this CV/Resume document and extract the structured information:",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ];
    } else {
      console.log("Using text-based parsing...");
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this CV:\n\n${effectiveText}` },
      ];
    }

    console.log("Sending to AI Gateway...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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
    console.log("AI response received");
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

    console.log("Parsed CV successfully:", { skills: parsedCV.skills?.length, experience_years: parsedCV.experience_years });

    // Update the CV profile in the database if cvProfileId is provided
    if (cvProfileId) {
      console.log("Updating CV profile:", cvProfileId);
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
      } else {
        console.log("CV profile updated successfully");
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