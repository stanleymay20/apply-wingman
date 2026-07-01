import { callAI, callAIJson, AIRateLimitError, AICreditsError } from "../_shared/aiClient.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiscoveryParams {
  keywords: string[];
  locations: string[];
  platforms: string[];
}

interface DiscoveredJob {
  title: string;
  company: string;
  location: string;
  source_platform: string;
  source_url: string;
  description: string;
  requirements: string[];
  is_remote: boolean;
  job_type: string;
}

// Input validation
function validateDiscoveryParams(params: unknown): { valid: boolean; error?: string; data?: DiscoveryParams } {
  if (!params || typeof params !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const { keywords, locations, platforms } = params as Record<string, unknown>;

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { valid: false, error: "At least one keyword is required" };
  }

  if (keywords.length > 10) {
    return { valid: false, error: "Maximum 10 keywords allowed" };
  }

  for (const kw of keywords) {
    if (typeof kw !== "string" || kw.length > 100) {
      return { valid: false, error: "Keywords must be strings under 100 characters" };
    }
  }

  const validLocations = Array.isArray(locations) 
    ? locations.filter((l): l is string => typeof l === "string" && l.length <= 100).slice(0, 10)
    : [];

  const validPlatforms = Array.isArray(platforms)
    ? platforms.filter((p): p is string => typeof p === "string" && p.length <= 50).slice(0, 10)
    : [];

  return {
    valid: true,
    data: {
      keywords: keywords.map(k => String(k).slice(0, 100)),
      locations: validLocations,
      platforms: validPlatforms,
    },
  };
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
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const token = authHeader.replace("Bearer ", "");
    let userId: string;

    // Check if this is a service role key (internal server-to-server call)
    if (token === supabaseServiceKey) {
      // Internal call from scheduled-automation - get userId from body
      const rawBody = await req.clone().json();
      userId = rawBody.userId;
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "userId required for internal calls" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`Internal call for user: ${userId}`);
    } else {
      // Regular user call - validate JWT
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

      if (claimsError || !claimsData?.claims) {
        console.error("JWT validation failed:", claimsError);
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = claimsData.claims.sub;
    }
    
    console.log(`Authenticated user: ${userId}`);
    // ===== END AUTHENTICATION =====

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured. Please connect Firecrawl in Settings → Connectors." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    const rawParams = await req.json();
    const validation = validateDiscoveryParams(rawParams);
    
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { keywords, locations, platforms } = validation.data;

    console.info("Discovering real jobs with:", { keywords, locations, platforms, userId });

    const allJobs: DiscoveredJob[] = [];
    const seenUrls = new Set<string>();
    const searchErrors: { keyword: string; status?: number; message: string }[] = [];
    let searchAttempts = 0;

    // Build search queries for each platform
    const platformSites: Record<string, string> = {
      linkedin: "site:linkedin.com/jobs",
      indeed: "site:indeed.com OR site:de.indeed.com OR site:uk.indeed.com",
      greenhouse: "site:greenhouse.io",
      lever: "site:jobs.lever.co",
      workday: "site:myworkdayjobs.com",
      smartrecruiters: "site:jobs.smartrecruiters.com",
    };

    // Build location string - only if provided, otherwise don't constrain
    const locationStr = locations.length > 0 && !locations.every(l => l.toLowerCase() === "remote")
      ? locations.map(l => `"${l}"`).join(" OR ")
      : "";

    // Search for each keyword - use exact phrase matching for precision
    for (const keyword of keywords.slice(0, 5)) {
      // Build platform filter - prioritize user-selected platforms
      const selectedPlatformFilters = platforms
        .map((p) => platformSites[p])
        .filter(Boolean);
      
      const platformFilter = selectedPlatformFilters.length > 0
        ? `(${selectedPlatformFilters.join(" OR ")})`
        : "";

      // Build a more precise search query:
      // - Use quotes around the main keyword for exact matching
      // - Include "hiring" or "apply" to target actual job listings
      // - Add location only if specified
      const searchParts = [
        `"${keyword}"`, // Exact match for the job role
        "hiring OR apply OR careers", // Signal this is a job listing
      ];
      
      if (locationStr) {
        searchParts.push(`(${locationStr})`);
      }
      
      if (platformFilter) {
        searchParts.push(platformFilter);
      }

      const searchQuery = searchParts.join(" ");
      
      console.info("Searching:", searchQuery);

      searchAttempts++;
      try {
        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 15, // Get more results per keyword
            lang: "en",
            tbs: "qdr:m", // Last month for more results
            scrapeOptions: {
              formats: ["markdown"],
            },
          }),
        });

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json().catch(() => ({}));
          const errMsg = (errorData as any)?.message ?? (errorData as any)?.error ?? `HTTP ${searchResponse.status}`;
          console.error(`Firecrawl search error for "${keyword}":`, errMsg);
          searchErrors.push({ keyword, status: searchResponse.status, message: errMsg });
          continue;
        }

        const searchData = await searchResponse.json();
        const results = searchData.data || [];

        console.info(`Found ${results.length} search results for "${keyword}"`);

        // Process each result
        for (const result of results) {
          if (seenUrls.has(result.url)) continue;
          seenUrls.add(result.url);

          // Detect platform from URL
          let detectedPlatform = "linkedin"; // Default fallback
          const url = result.url.toLowerCase();
          if (url.includes("linkedin.com")) detectedPlatform = "linkedin";
          else if (url.includes("indeed.com")) detectedPlatform = "indeed";
          else if (url.includes("greenhouse.io")) detectedPlatform = "greenhouse";
          else if (url.includes("lever.co")) detectedPlatform = "lever";
          else if (url.includes("workday") || url.includes("myworkdayjobs")) detectedPlatform = "workday";
          else if (url.includes("smartrecruiters")) detectedPlatform = "smartrecruiters";

          // Extract job info from result
          const title = result.title || "Job Opening";
          const description = result.markdown || result.description || "";
          
          // Try to extract company from title or content
          let company = "Unknown Company";
          const titleParts = title.split(" at ");
          if (titleParts.length > 1) {
            company = titleParts[1].split(" - ")[0].split(" | ")[0].trim();
          } else if (title.includes(" | ")) {
            const parts = title.split(" | ");
            if (parts.length >= 2) {
              company = parts[parts.length - 1].trim();
            }
          } else if (title.includes(" - ")) {
            const parts = title.split(" - ");
            if (parts.length >= 2) {
              company = parts[1].trim();
            }
          }

          // Clean company name
          company = company.replace(/\s*(LinkedIn|Indeed|Greenhouse|Lever|Workday|SmartRecruiters).*$/i, "").trim();
          if (!company || company.length < 2) company = "Unknown Company";

          // Extract job title (remove company and platform suffixes)
          let jobTitle = title
            .split(" at ")[0]
            .split(" | ")[0]
            .split(" - ")[0]
            .replace(/\s*\(.*?\)\s*/g, "")
            .trim();

          if (!jobTitle || jobTitle.length < 5) {
            jobTitle = keyword; // Fallback to search keyword
          }

          // RELEVANCE CHECK: Skip jobs that don't contain the search keyword in title or description
          const keywordLower = keyword.toLowerCase();
          const titleLower = jobTitle.toLowerCase();
          const descLower = description.toLowerCase();
          
          // Check if the keyword (or individual words from it) appear in title or description
          const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);
          const matchesKeyword = 
            titleLower.includes(keywordLower) || 
            descLower.includes(keywordLower) ||
            keywordWords.some(word => titleLower.includes(word) || descLower.slice(0, 1000).includes(word));
          
          if (!matchesKeyword) {
            console.info(`Skipping irrelevant result: "${jobTitle}" doesn't match keyword "${keyword}"`);
            continue;
          }

          // Detect if remote
          const isRemote = 
            title.toLowerCase().includes("remote") ||
            description.toLowerCase().includes("remote") ||
            locations.some((l) => l.toLowerCase() === "remote");

          // Detect location from content
          let jobLocation = "";
          for (const loc of locations) {
            if (
              title.toLowerCase().includes(loc.toLowerCase()) ||
              description.toLowerCase().includes(loc.toLowerCase())
            ) {
              jobLocation = loc;
              break;
            }
          }
          if (!jobLocation) {
            jobLocation = isRemote ? "Remote" : (locations[0] || "");
          }

          // Detect job type
          let jobType = "full-time";
          if (description.toLowerCase().includes("part-time") || title.toLowerCase().includes("part-time")) {
            jobType = "part-time";
          } else if (description.toLowerCase().includes("contract")) {
            jobType = "contract";
          }

          allJobs.push({
            title: jobTitle,
            company,
            location: jobLocation,
            source_platform: detectedPlatform,
            source_url: result.url,
            description: description.slice(0, 2000),
            requirements: [],
            is_remote: isRemote,
            job_type: jobType,
          });
        }
      } catch (searchError) {
        const errMsg = searchError instanceof Error ? searchError.message : String(searchError);
        console.error(`Search error for keyword "${keyword}":`, errMsg);
        searchErrors.push({ keyword, message: errMsg });
        continue;
      }
    }

    // If every keyword search failed, report as failure rather than silently returning empty
    if (searchAttempts > 0 && searchErrors.length === searchAttempts && allJobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "All Firecrawl searches failed",
          searchErrors,
          jobs: [],
          userId,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(`Discovered ${allJobs.length} real jobs total`);

    // If we found jobs, optionally enhance with AI for better requirement extraction
    if (allJobs.length > 0) {
      try {
        const topJobs = allJobs.slice(0, 5);
        const enhanced = await callAIJson<Array<{ title?: string; company?: string; requirements?: string[] }>>({
          messages: [
            {
              role: "system",
              content: "You extract structured job information from job listing descriptions. Return a JSON array only, no markdown.",
            },
            {
              role: "user",
              content: `Extract requirements from these job descriptions. Return JSON array with objects having: title, company, requirements (array of 3-5 key requirements as strings).

${JSON.stringify(topJobs.map((j) => ({ title: j.title, company: j.company, description: j.description.slice(0, 500) })), null, 2)}`,
            },
          ],
          temperature: 0.1,
        });
        for (let i = 0; i < Math.min(enhanced.length, topJobs.length); i++) {
          if (enhanced[i]?.requirements && Array.isArray(enhanced[i].requirements)) {
            allJobs[i].requirements = enhanced[i].requirements;
          }
        }
      } catch (aiError) {
        console.warn("AI enhancement failed, continuing with raw data:", aiError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobs: allJobs,
        userId,
        ...(searchErrors.length > 0 && { searchErrors }),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Discovery error:", error);
    const errorMessage = error instanceof Error ? error.message : "Discovery failed";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
