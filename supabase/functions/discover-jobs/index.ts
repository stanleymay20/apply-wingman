import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!firecrawlKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured. Please connect Firecrawl in Settings → Connectors." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { keywords, locations, platforms }: DiscoveryParams = await req.json();

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "At least one keyword is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info("Discovering real jobs with:", { keywords, locations, platforms });

    const allJobs: DiscoveredJob[] = [];
    const seenUrls = new Set<string>();

    // Build search queries for each platform
    const platformSites: Record<string, string> = {
      linkedin: "site:linkedin.com/jobs",
      indeed: "site:indeed.com OR site:de.indeed.com",
      greenhouse: "site:greenhouse.io",
      lever: "site:jobs.lever.co",
      workday: "site:myworkdayjobs.com",
      smartrecruiters: "site:jobs.smartrecruiters.com",
    };

    // Build location string
    const locationStr = locations.length > 0 ? locations.join(" OR ") : "Germany OR Remote";

    // Search for each keyword
    for (const keyword of keywords.slice(0, 3)) {
      // Build platform filter
      const platformFilter = platforms
        .map((p) => platformSites[p])
        .filter(Boolean)
        .join(" OR ");

      const searchQuery = `${keyword} jobs ${locationStr} ${platformFilter ? `(${platformFilter})` : ""}`;
      
      console.info("Searching:", searchQuery);

      try {
        const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 10,
            lang: "en",
            tbs: "qdr:w", // Last week
            scrapeOptions: {
              formats: ["markdown"],
            },
          }),
        });

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json();
          console.error("Firecrawl search error:", errorData);
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
            jobLocation = isRemote ? "Remote" : locations[0] || "Germany";
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
        console.error(`Search error for keyword "${keyword}":`, searchError);
        continue;
      }
    }

    console.info(`Discovered ${allJobs.length} real jobs total`);

    // If we found jobs, optionally enhance with AI for better extraction
    if (allJobs.length > 0 && lovableKey) {
      try {
        const topJobs = allJobs.slice(0, 5);
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You extract structured job information from job listing descriptions. Return JSON array only, no markdown.`,
              },
              {
                role: "user",
                content: `Extract requirements from these job descriptions. Return JSON array with same structure but add "requirements" array for each:
${JSON.stringify(topJobs.map((j) => ({ title: j.title, company: j.company, description: j.description.slice(0, 500) })), null, 2)}

Return only valid JSON array with objects having: title, company, requirements (array of 3-5 key requirements as strings).`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          
          try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const enhanced = JSON.parse(jsonMatch[0]);
              for (let i = 0; i < Math.min(enhanced.length, topJobs.length); i++) {
                if (enhanced[i]?.requirements && Array.isArray(enhanced[i].requirements)) {
                  allJobs[i].requirements = enhanced[i].requirements;
                }
              }
            }
          } catch (parseError) {
            console.warn("Could not parse AI requirements:", parseError);
          }
        }
      } catch (aiError) {
        console.warn("AI enhancement failed, continuing with raw data:", aiError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, jobs: allJobs }),
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
