import { callAI, callAIJson, AIRateLimitError, AICreditsError } from "../_shared/aiClient.ts";
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
    // JWT validation using getClaims
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized - Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth header for validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate JWT and get user claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized - Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    console.log("Authenticated user:", userId);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { cvText, cvFileUrl, cvProfileId } = await req.json();
    console.log("Received request:", { hasCvText: !!cvText, hasCvFileUrl: !!cvFileUrl, cvProfileId });

    // If cvProfileId is provided, verify ownership
    if (cvProfileId) {
      const { data: profile, error: profileError } = await supabase
        .from("cv_profiles")
        .select("user_id")
        .eq("id", cvProfileId)
        .single();
      
      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: "CV profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (profile.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Unauthorized - You don't own this CV profile" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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

    const systemPrompt = `You are an expert CV/Resume parser. Your job is to thoroughly extract ALL structured information from the ENTIRE CV document, not just the beginning or summary.

CRITICAL INSTRUCTIONS:
1. Parse the COMPLETE document from start to finish
2. Extract EVERY job position listed, not just the first few
3. Extract ALL skills mentioned anywhere in the document
4. Extract ALL education entries
5. Extract ALL certifications mentioned
6. Include bullet points and achievements for each work experience
7. After parsing, calculate a confidence score (0-100) reflecting parsing quality

Return a JSON object with the following structure:

{
  "confidence_score": number (0-100, reflecting parsing quality and completeness),
  "confidence_details": {
    "sections_found": ["summary", "work_history", "skills", "education", etc.],
    "sections_missing": ["certifications", "projects", etc.],
    "data_quality": "high|medium|low",
    "notes": "Brief explanation of confidence score"
  },
  "full_name": "string",
  "email": "string or null",
  "phone": "string or null", 
  "location": "string or null",
  "linkedin_url": "string or null",
  "portfolio_url": "string or null",
  "summary": "A 2-4 sentence professional summary synthesizing key strengths",
  "skills": {
    "technical": ["programming languages", "frameworks", "tools"],
    "soft": ["leadership", "communication", etc.],
    "tools": ["specific software", "platforms"],
    "all": ["flat array of all skills for matching"]
  },
  "experience_years": number (calculate from work history),
  "seniority_level": "junior|mid|senior|lead|principal|executive",
  "languages": [{"language": "English", "level": "native|fluent|intermediate|basic"}],
  "certifications": [
    {
      "name": "string",
      "issuer": "string or null",
      "year": number or null
    }
  ],
  "keywords": ["ATS-relevant", "keywords", "extracted", "from", "entire", "document"],
  "education": [
    {
      "degree": "string (e.g., Bachelor of Science)",
      "field": "string (e.g., Computer Science)",
      "institution": "string",
      "year": number or null,
      "gpa": "string or null",
      "honors": "string or null"
    }
  ],
  "work_history": [
    {
      "title": "string - exact job title",
      "company": "string - company name",
      "location": "string or null",
      "duration": "string (e.g., Jan 2020 - Present)",
      "start_date": "string (YYYY-MM or YYYY)",
      "end_date": "string (YYYY-MM or YYYY or 'Present')",
      "start_year": number or null,
      "end_year": number or null (null if current),
      "is_current": boolean,
      "employment_type": "full-time|part-time|contract|freelance|internship",
      "responsibilities": ["achievement 1 with metrics if available", "achievement 2", "responsibility 3"],
      "technologies": ["tech used in this role"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["array"],
      "url": "string or null"
    }
  ],
  "publications": ["string or null"],
  "awards": ["string or null"],
  "volunteer": ["string or null"]
}

CONFIDENCE SCORING GUIDELINES:
- 90-100: All major sections present with detailed data, clear dates, metrics in achievements
- 70-89: Most sections present, some minor gaps or ambiguous data
- 50-69: Key sections present but missing details or some sections empty
- 30-49: Incomplete parsing, major sections missing or unclear
- 0-29: Failed to extract meaningful data

IMPORTANT:
- Extract ALL work history entries, even if there are 10+ jobs
- Include quantifiable achievements (%, $, numbers) in responsibilities
- Identify technologies/tools mentioned in each job's context
- Calculate experience_years by summing work history durations
- Be thorough - this data is used for job matching
- This should work for ALL professions, not just tech roles

Return ONLY valid JSON, no markdown code blocks.`;

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

    console.log("Sending to AI...");
    let parsedCV: any;
    try {
      parsedCV = await callAIJson({ messages, temperature: 0.1 });
      console.log("AI response received");
    } catch (e) {
      if (e instanceof AIRateLimitError) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (e instanceof AICreditsError) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Set GOOGLE_API_KEY for free usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    console.log("Parsed CV successfully:", { skills: parsedCV.skills?.length, experience_years: parsedCV.experience_years });

    // Update the CV profile in the database if cvProfileId is provided
    if (cvProfileId) {
      console.log("Updating CV profile:", cvProfileId);
      
      // Flatten skills if they're in the new structured format
      let flatSkills: string[] = [];
      if (parsedCV.skills) {
        if (Array.isArray(parsedCV.skills)) {
          flatSkills = parsedCV.skills;
        } else if (parsedCV.skills.all) {
          flatSkills = parsedCV.skills.all;
        } else {
          // Combine all skill categories
          flatSkills = [
            ...(parsedCV.skills.technical || []),
            ...(parsedCV.skills.soft || []),
            ...(parsedCV.skills.tools || []),
          ];
        }
      }
      
      // Flatten languages if they're in the new structured format
      let flatLanguages: string[] = [];
      if (parsedCV.languages) {
        if (Array.isArray(parsedCV.languages)) {
          flatLanguages = parsedCV.languages.map((lang: any) => 
            typeof lang === 'string' ? lang : `${lang.language} (${lang.level})`
          );
        }
      }
      
      const { error: updateError } = await supabase
        .from("cv_profiles")
        .update({
          parsed_data: parsedCV,
          skills: flatSkills,
          experience_years: parsedCV.experience_years || 0,
          seniority_level: parsedCV.seniority_level || null,
          languages: flatLanguages,
          education: parsedCV.education || [],
          work_history: (parsedCV.work_history || []).map((w: any) => ({
            ...w,
            // Normalize: AI sometimes outputs 'highlights', everything else expects 'responsibilities'
            responsibilities: w.responsibilities || w.highlights || [],
          })),
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
