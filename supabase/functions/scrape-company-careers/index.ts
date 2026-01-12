import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CareerPageJob {
  title: string;
  url: string;
  location?: string;
  department?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { companyUrl, companyName } = await req.json();

    if (!companyUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Company URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Scraping company careers:", companyUrl);

    // Format URL
    let formattedUrl = companyUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // First, map the site to find career pages
    const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        search: "careers jobs openings positions hiring",
        limit: 50,
        includeSubdomains: true,
      }),
    });

    if (!mapResponse.ok) {
      const errorData = await mapResponse.json();
      console.error("Map error:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to map company site" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mapData = await mapResponse.json();
    const links = mapData.links || mapData.data?.links || [];

    console.log(`Found ${links.length} potential career pages`);

    // Filter for career-related URLs
    const careerKeywords = ["career", "jobs", "openings", "positions", "join", "hiring", "work-with-us", "opportunities"];
    const careerPages = links.filter((url: string) => 
      careerKeywords.some(kw => url.toLowerCase().includes(kw))
    ).slice(0, 5); // Limit to 5 pages

    if (careerPages.length === 0) {
      // Try common career page patterns
      const commonPatterns = ["/careers", "/jobs", "/join-us", "/careers/jobs", "/about/careers"];
      for (const pattern of commonPatterns) {
        try {
          const testUrl = new URL(pattern, formattedUrl).toString();
          careerPages.push(testUrl);
        } catch {}
      }
    }

    console.log("Career pages to scrape:", careerPages);

    const allJobs: CareerPageJob[] = [];

    // Scrape each career page
    for (const pageUrl of careerPages.slice(0, 3)) {
      try {
        const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: pageUrl,
            formats: ["markdown", "links"],
            onlyMainContent: true,
          }),
        });

        if (!scrapeResponse.ok) continue;

        const scrapeData = await scrapeResponse.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        const pageLinks = scrapeData.data?.links || scrapeData.links || [];

        // Filter job-related links
        const jobLinks = pageLinks.filter((link: string) => {
          const lower = link.toLowerCase();
          return (
            lower.includes("/job/") ||
            lower.includes("/jobs/") ||
            lower.includes("/position/") ||
            lower.includes("/opening/") ||
            lower.includes("/career/") ||
            lower.includes("?gh_jid=") || // Greenhouse
            lower.includes("jobs.lever.co") ||
            lower.includes("greenhouse.io") ||
            lower.includes("apply")
          );
        });

        // Add found job links
        for (const jobUrl of jobLinks.slice(0, 20)) {
          if (!allJobs.some(j => j.url === jobUrl)) {
            allJobs.push({
              title: "Job Opening",
              url: jobUrl,
            });
          }
        }

        // Use AI to extract job listings from markdown if available
        if (lovableKey && markdown.length > 100) {
          try {
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
                    content: "Extract job listings from career page content. Return JSON array only.",
                  },
                  {
                    role: "user",
                    content: `Extract job listings from this career page (company: ${companyName || "Unknown"}):

${markdown.slice(0, 4000)}

Return JSON array: [{"title": "Job Title", "location": "Location if found", "department": "Department if found"}]
Only include actual job titles. Return [] if none found. No markdown, just JSON.`,
                  },
                ],
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const content = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const extracted = JSON.parse(jsonMatch[0]);
                for (const job of extracted) {
                  if (job.title && !allJobs.some(j => j.title === job.title)) {
                    allJobs.push({
                      title: job.title,
                      url: pageUrl,
                      location: job.location,
                      department: job.department,
                    });
                  }
                }
              }
            }
          } catch (aiError) {
            console.warn("AI extraction failed:", aiError);
          }
        }
      } catch (scrapeError) {
        console.error("Scrape error for", pageUrl, scrapeError);
      }
    }

    console.log(`Extracted ${allJobs.length} jobs from ${companyName || formattedUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        company: companyName || new URL(formattedUrl).hostname,
        careerPagesFound: careerPages.length,
        jobs: allJobs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Company scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Scrape failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});