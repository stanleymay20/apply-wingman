import { callAI, callAIJson, AIRateLimitError, AICreditsError, preflightAI, AIError } from "../_shared/aiClient.ts";
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

// Aggregator/search-result pages list many jobs but can't be applied to, so
// they must never enter the pipeline as if they were individual postings.
// URL shapes of individual postings are allowed through first; everything
// matching a known listing-page shape (by URL or title) is dropped.
const SINGLE_JOB_URL_PATTERNS = [
  /linkedin\.com\/jobs\/view\//,
  /indeed\.com\/(viewjob|rc\/clk|pagead\/clk)/,
  /greenhouse\.io\/[^/]+\/jobs\/\d+/,
  /jobs\.lever\.co\/[^/]+\/[0-9a-f][0-9a-f-]{7,}/,
  /myworkdayjobs\.com\/.+\/job\//,
  /jobs\.smartrecruiters\.com\/[^/]+\/\d+/,
];

const AGGREGATOR_URL_PATTERNS = [
  /linkedin\.com\/jobs\/?(\?|$)/,                                  // jobs home
  /linkedin\.com\/jobs\/search/,                                   // search results
  /linkedin\.com\/jobs\/[a-z0-9%+-]*-jobs[a-z0-9%+-]*\/?(\?|$)/,   // "…-jobs" hub pages
  /indeed\.com\/(m\/)?jobs(\.html)?(\?|$)/,                        // search results
  /indeed\.com\/q-[^/]*-jobs/,                                     // "/q-…-jobs.html" hub pages
  /indeed\.com\/(browsejobs|career(\/|\?|$)|cmp\/[^/]+\/jobs)/,    // browse/company hubs
  /greenhouse\.io\/[^/]+\/?(\?|$)/,                                // company board root
  /jobs\.lever\.co\/[^/]+\/?(\?|$)/,                               // company board root
  /\/jobs\/search(\/|\?|$)/,
  /\/(search|browse|find)-?jobs?(\/|\?|$)/,
];

const AGGREGATOR_TITLE_PATTERNS = [
  /\d[\d,.]*\+?\s*(open\s+)?(jobs|positions|openings|vacancies)\b/i, // "1,024 Data Jobs"
  /\bjobs\s+(in|near)\s+/i,                                          // "Analyst Jobs in Berlin"
  /\bjobs?,\s*(employment|vacancies|careers)\b/i,                    // "… Jobs, Employment | Indeed"
  /^\s*(top|best|latest|newest|browse|search|find)\b.*\b(jobs|openings|vacancies)\b/i,
];

function isAggregatorPage(url: string, title: string): boolean {
  const u = url.toLowerCase();
  if (SINGLE_JOB_URL_PATTERNS.some((re) => re.test(u))) return false;
  if (AGGREGATOR_URL_PATTERNS.some((re) => re.test(u))) return true;
  return AGGREGATOR_TITLE_PATTERNS.some((re) => re.test(title));
}

// ===== Free JSON job sources (no API key, no quota) =====
// These run alongside Firecrawl so an exhausted Firecrawl quota degrades
// discovery instead of zeroing it out. All results are pushed through the
// same aggregator/keyword filtering pipeline as Firecrawl results.

function htmlToText(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAnyKeyword(title: string, description: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase().slice(0, 2000);
  return keywords.some((keyword) => {
    const kw = keyword.toLowerCase();
    const words = kw.split(/\s+/).filter((w) => w.length > 2);
    return (
      titleLower.includes(kw) ||
      descLower.includes(kw) ||
      words.some((w) => titleLower.includes(w) || descLower.includes(w))
    );
  });
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json", "User-Agent": "apply-wingman/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArbeitnowJobs(): Promise<DiscoveredJob[]> {
  const data = (await fetchJsonWithTimeout("https://www.arbeitnow.com/api/job-board-api")) as {
    data?: unknown[];
  };
  const items = Array.isArray(data?.data) ? data.data : [];
  return items
    .map((raw): DiscoveredJob => {
      const item = raw as Record<string, unknown>;
      return {
        title: String(item.title ?? "").trim(),
        company: String(item.company_name ?? "").trim() || "Unknown Company",
        location: String(item.location ?? "") || (item.remote ? "Remote" : ""),
        source_platform: "arbeitnow",
        source_url: String(item.url ?? ""),
        description: htmlToText(String(item.description ?? "")).slice(0, 2000),
        requirements: Array.isArray(item.tags) ? item.tags.slice(0, 5).map(String) : [],
        is_remote: Boolean(item.remote),
        job_type: Array.isArray(item.job_types) && item.job_types.length > 0
          ? String(item.job_types[0]).toLowerCase()
          : "full-time",
      };
    })
    .filter((j) => j.title && j.source_url);
}

async function fetchRemoteOkJobs(): Promise<DiscoveredJob[]> {
  const data = await fetchJsonWithTimeout("https://remoteok.com/api");
  // First array element is a legal notice, and lacks position/id fields.
  const items = (Array.isArray(data) ? data : []).filter(
    (x): x is Record<string, unknown> =>
      !!x && typeof x === "object" && "id" in x && ("position" in x || "title" in x)
  );
  return items
    .map((item): DiscoveredJob => ({
      title: String(item.position ?? item.title ?? "").trim(),
      company: String(item.company ?? "").trim() || "Unknown Company",
      location: String(item.location ?? "") || "Remote",
      source_platform: "remoteok",
      source_url: String(item.url ?? ""),
      description: htmlToText(String(item.description ?? "")).slice(0, 2000),
      requirements: Array.isArray(item.tags) ? item.tags.slice(0, 5).map(String) : [],
      is_remote: true,
      job_type: "full-time",
    }))
    .filter((j) => j.title && j.source_url);
}

// Collect company board slugs from the user's stored job URLs so we can
// re-query those companies' public posting APIs for free.
async function collectBoardSlugs(
  // deno-lint-ignore no-explicit-any
  supabaseService: any,
  userId: string,
  urlLikeFilter: string,
  slugPattern: RegExp,
  reservedSlugs: Set<string>,
): Promise<Map<string, string>> {
  const { data: rows } = await supabaseService
    .from("jobs")
    .select("source_url, company")
    .eq("user_id", userId)
    .ilike("source_url", urlLikeFilter)
    .limit(200);
  const slugs = new Map<string, string>();
  for (const row of rows ?? []) {
    const m = String(row.source_url ?? "").match(slugPattern);
    if (m?.[1] && !reservedSlugs.has(m[1].toLowerCase())) {
      const company = row.company && row.company !== "Unknown Company" ? row.company : m[1];
      if (!slugs.has(m[1])) slugs.set(m[1], company);
    }
  }
  return slugs;
}

const MAX_BOARDS_PER_SOURCE = 5;

async function refreshBoards(
  slugs: Map<string, string>,
  fetchBoard: (slug: string, company: string) => Promise<DiscoveredJob[]>,
): Promise<DiscoveredJob[]> {
  const entries = [...slugs.entries()].slice(0, MAX_BOARDS_PER_SOURCE);
  const results = await Promise.all(
    entries.map(async ([slug, company]) => {
      try {
        return await fetchBoard(slug, company);
      } catch (e) {
        console.warn(`Board refresh failed for "${slug}":`, e instanceof Error ? e.message : e);
        return [];
      }
    })
  );
  return results.flat().filter((j) => j.title && j.source_url);
}

// deno-lint-ignore no-explicit-any
async function refreshGreenhouseBoards(supabaseService: any, userId: string): Promise<DiscoveredJob[]> {
  const slugs = await collectBoardSlugs(
    supabaseService,
    userId,
    "%greenhouse.io%",
    /greenhouse\.io\/([A-Za-z0-9_-]+)\/jobs\//i,
    new Set(["v1", "boards", "embed", "api"]),
  );
  return refreshBoards(slugs, async (token, company) => {
    const data = (await fetchJsonWithTimeout(
      `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`
    )) as { jobs?: unknown[] };
    return (data?.jobs ?? []).map((raw): DiscoveredJob => {
      const j = raw as Record<string, unknown>;
      const locationName = String((j.location as Record<string, unknown> | undefined)?.name ?? "");
      return {
        title: String(j.title ?? "").trim(),
        company,
        location: locationName,
        source_platform: "greenhouse",
        source_url: String(j.absolute_url ?? ""),
        // Greenhouse returns HTML-escaped markup in `content`
        description: htmlToText(String(j.content ?? "")).slice(0, 2000),
        requirements: [],
        is_remote: /remote/i.test(locationName),
        job_type: "full-time",
      };
    });
  });
}

// deno-lint-ignore no-explicit-any
async function refreshLeverBoards(supabaseService: any, userId: string): Promise<DiscoveredJob[]> {
  const slugs = await collectBoardSlugs(
    supabaseService,
    userId,
    "%jobs.lever.co%",
    /jobs\.lever\.co\/([A-Za-z0-9._-]+)/i,
    new Set(["v0", "api"]),
  );
  return refreshBoards(slugs, async (slug, company) => {
    const data = await fetchJsonWithTimeout(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return (Array.isArray(data) ? data : []).map((raw): DiscoveredJob => {
      const p = raw as Record<string, unknown>;
      const categories = (p.categories ?? {}) as Record<string, unknown>;
      const locationName = String(categories.location ?? "");
      return {
        title: String(p.text ?? "").trim(),
        company,
        location: locationName,
        source_platform: "lever",
        source_url: String(p.hostedUrl ?? ""),
        description: htmlToText(String(p.descriptionPlain ?? p.description ?? "")).slice(0, 2000),
        requirements: [],
        is_remote: /remote/i.test(locationName) || String(p.workplaceType ?? "") === "remote",
        job_type: /part.?time/i.test(String(categories.commitment ?? "")) ? "part-time" : "full-time",
      };
    });
  });
}

// deno-lint-ignore no-explicit-any
async function refreshSmartRecruitersBoards(supabaseService: any, userId: string): Promise<DiscoveredJob[]> {
  const slugs = await collectBoardSlugs(
    supabaseService,
    userId,
    "%jobs.smartrecruiters.com%",
    /jobs\.smartrecruiters\.com\/([A-Za-z0-9._-]+)/i,
    new Set(["api"]),
  );
  return refreshBoards(slugs, async (slug, company) => {
    const data = (await fetchJsonWithTimeout(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings`
    )) as { content?: unknown[] };
    return (data?.content ?? []).map((raw): DiscoveredJob => {
      const p = raw as Record<string, unknown>;
      const loc = (p.location ?? {}) as Record<string, unknown>;
      const locationName = [loc.city, loc.country].filter(Boolean).map(String).join(", ");
      return {
        title: String(p.name ?? "").trim(),
        company,
        location: locationName,
        source_platform: "smartrecruiters",
        source_url: `https://jobs.smartrecruiters.com/${slug}/${String(p.id ?? "")}`,
        // The postings list endpoint has no job description; keyword matching
        // falls back to the title for these.
        description: "",
        requirements: [],
        is_remote: Boolean(loc.remote) || /remote/i.test(locationName),
        job_type: "full-time",
      };
    });
  });
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

    // Firecrawl keys: primary + connector-managed fallback. An exhausted key
    // (HTTP 402) rolls over to the next so one depleted key doesn't kill search.
    const firecrawlKeys = [
      Deno.env.get("FIRECRAWL_API_KEY"),
      Deno.env.get("FIRECRAWL_API_KEY_1"),
    ]
      .filter((k): k is string => !!k && k.trim().length > 0)
      .filter((k, i, arr) => arr.indexOf(k) === i);
    let firecrawlKeyIdx = 0;
    const firecrawlKey = firecrawlKeys[0]; // truthy when at least one key is configured
    const sourceReport: Record<string, string> = {};

    if (!firecrawlKey) {
      // Firecrawl is one source among several now — keep going without it.
      console.error("FIRECRAWL_API_KEY not configured — skipping Firecrawl search");
      sourceReport.firecrawl = "not_configured";
    }

    // AI health preflight — job parsing/classification needs AI, so don't spend
    // Firecrawl credits if no AI provider is configured.
    try {
      await preflightAI();
    } catch (e) {
      if (e instanceof AIError) {
        return new Response(
          JSON.stringify({ success: false, error: e.message, code: "AI_NOT_CONFIGURED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw e;
    }

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
    let aggregatorsFiltered = 0;

    // Shared filtering pipeline for non-Firecrawl sources: dedupe, aggregator
    // filter, and keyword relevance — same gates the Firecrawl results face.
    const addCandidateJob = (job: DiscoveredJob): boolean => {
      if (!job.source_url || seenUrls.has(job.source_url)) return false;
      seenUrls.add(job.source_url);
      if (isAggregatorPage(job.source_url, job.title)) {
        aggregatorsFiltered++;
        return false;
      }
      if (!matchesAnyKeyword(job.title, job.description, keywords)) return false;
      allJobs.push(job);
      return true;
    };

    // Kick off the free JSON sources in parallel with the Firecrawl loop.
    // Each source catches its own failure so it can never abort the run.
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const runSource = (name: string, fn: () => Promise<DiscoveredJob[]>) =>
      fn()
        .then((jobs) => ({ name, jobs }))
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Source "${name}" failed:`, msg);
          sourceReport[name] = `failed: ${msg}`;
          return { name, jobs: [] as DiscoveredJob[] };
        });

    const freeSourceTasks = [
      // Always-on, quota-free feeds (Arbeitnow is Germany/EU-focused).
      runSource("arbeitnow", fetchArbeitnowJobs),
      runSource("remoteok", fetchRemoteOkJobs),
    ];
    if (platforms.length === 0 || platforms.includes("greenhouse")) {
      freeSourceTasks.push(runSource("greenhouse_refresh", () => refreshGreenhouseBoards(supabaseService, userId)));
    }
    if (platforms.length === 0 || platforms.includes("lever")) {
      freeSourceTasks.push(runSource("lever_refresh", () => refreshLeverBoards(supabaseService, userId)));
    }
    if (platforms.length === 0 || platforms.includes("smartrecruiters")) {
      freeSourceTasks.push(runSource("smartrecruiters_refresh", () => refreshSmartRecruitersBoards(supabaseService, userId)));
    }

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
    // (skipped entirely when Firecrawl isn't configured)
    for (const keyword of firecrawlKey ? keywords.slice(0, 5) : []) {
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
        const doFirecrawlFetch = () =>
          fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${firecrawlKeys[firecrawlKeyIdx]}`,
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

        let searchResponse = await doFirecrawlFetch();

        // Credit exhaustion (402) on the current key: roll over to the next
        // configured key (e.g. the connector-managed one) and retry.
        while (searchResponse.status === 402 && firecrawlKeyIdx < firecrawlKeys.length - 1) {
          await searchResponse.body?.cancel();
          firecrawlKeyIdx++;
          console.warn(`Firecrawl key #${firecrawlKeyIdx + 1} in use after 402 rollover`);
          searchResponse = await doFirecrawlFetch();
        }

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

          if (isAggregatorPage(result.url, result.title || "")) {
            aggregatorsFiltered++;
            console.info(`Skipping aggregator/listing page: ${result.url}`);
            continue;
          }

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

    // Record Firecrawl's outcome — a failure here no longer aborts the run.
    if (firecrawlKey) {
      if (searchAttempts > 0 && searchErrors.length === searchAttempts) {
        sourceReport.firecrawl = searchErrors.some((e) => e.status === 402)
          ? "quota_exceeded"
          : `failed: ${searchErrors[0]?.message ?? "all searches failed"}`;
      } else {
        sourceReport.firecrawl = `ok: ${allJobs.length} jobs`;
      }
    }

    // Merge the free-source results through the shared filtering pipeline.
    const freeResults = await Promise.all(freeSourceTasks);
    for (const { name, jobs } of freeResults) {
      if (sourceReport[name]) continue; // fetch failed, already recorded
      let added = 0;
      for (const candidate of jobs) {
        if (addCandidateJob(candidate)) added++;
      }
      sourceReport[name] = `ok: ${added} jobs`;
    }

    console.info("Source report:", sourceReport);

    // Only report total failure when no source succeeded at all — a Firecrawl
    // quota error with working free sources is a partial success.
    const anySourceSucceeded = Object.values(sourceReport).some((s) => s.startsWith("ok"));
    if (allJobs.length === 0 && !anySourceSucceeded) {
      const creditsExhausted = sourceReport.firecrawl === "quota_exceeded";
      return new Response(
        JSON.stringify({
          success: false,
          error: creditsExhausted
            ? "Job discovery failed: the Firecrawl search quota is exhausted and the free job sources also returned errors. Try again shortly."
            : "All job sources failed. Please try again shortly.",
          code: creditsExhausted ? "FIRECRAWL_CREDITS_EXHAUSTED" : "DISCOVERY_FAILED",
          unavailable: true,
          sources: sourceReport,
          searchErrors,
          jobs: [],
          userId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(`Discovered ${allJobs.length} real jobs total (${aggregatorsFiltered} aggregator pages filtered)`);

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
        aggregatorsFiltered,
        sources: sourceReport,
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
