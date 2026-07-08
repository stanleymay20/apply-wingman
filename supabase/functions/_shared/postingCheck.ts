// Shared posting liveness + ground-truth location utilities.
//
// Used by match-job (checked at scoring time) and check-job-liveness (periodic
// sweep of already-scored high-match rows). The goal is to catch two classes of
// bad postings BEFORE they surface as high-match jobs:
//
//   1. Dead/removed postings — the requisition no longer exists and the URL
//      redirects to a generic board/search page (e.g. Greenhouse's
//      "?error=true" board root) or returns a 404-equivalent.
//   2. Location mismatches — the stored `location` (often a stale "Remote"
//      label) doesn't reflect the real posting, which is onsite in a country
//      the candidate isn't authorized to work in and offers no sponsorship.
//
// Both checks are deliberately FAIL-OPEN on transient network errors: a flaky
// fetch must never wrongly expire a live posting.

const FETCH_TIMEOUT_MS = 12_000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface FetchedPosting {
  ok: boolean;
  status: number;
  finalUrl: string;
  body: string;
  networkError: boolean;
}

// Fetch a posting URL following redirects, capturing the final URL + a slice of
// the body for downstream liveness/location parsing.
export async function fetchPosting(url: string): Promise<FetchedPosting> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    let body = "";
    try {
      body = (await res.text()).slice(0, 40_000);
    } catch {
      body = "";
    }
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      body,
      networkError: false,
    };
  } catch (_e) {
    return { ok: false, status: 0, finalUrl: url, body: "", networkError: true };
  } finally {
    clearTimeout(timer);
  }
}

// Body markers that indicate a specific posting is gone even when the server
// still returns HTTP 200 (common for SPA job boards).
const DEAD_BODY_MARKERS = [
  "position is no longer",
  "no longer accepting applications",
  "no longer available",
  "job is no longer",
  "posting has been closed",
  "this job has expired",
  "job posting not found",
  "we couldn't find that",
  "could not be found",
  "page not found",
  "position has been filled",
];

export interface LivenessResult {
  alive: boolean;
  reason: string;
}

// Decide whether a posting is still live from the fetch result. Conservative by
// design: only declares "dead" on strong signals.
export function assessLiveness(originalUrl: string, fetched: FetchedPosting): LivenessResult {
  // Network failures are inconclusive — never expire on those.
  if (fetched.networkError) return { alive: true, reason: "network_error_inconclusive" };

  if (fetched.status === 404 || fetched.status === 410) {
    return { alive: false, reason: `HTTP ${fetched.status}` };
  }
  // Other 4xx/5xx are inconclusive (auth walls, bot blocks) — don't expire.
  if (fetched.status >= 400) return { alive: true, reason: `HTTP ${fetched.status}_inconclusive` };

  const original = originalUrl.toLowerCase();
  const final = fetched.finalUrl.toLowerCase();

  // Explicit board error redirect (Greenhouse uses ?error=true on dead reqs).
  if (/[?&]error=true/i.test(final)) return { alive: false, reason: "redirected_to_error_page" };

  // A specific Greenhouse requisition (/jobs/{id}) that redirects to a URL
  // without a numeric job id has fallen back to the board root = dead.
  if (/greenhouse\.io\/[^/]+\/jobs\/\d+/.test(original) && !/\/jobs\/\d+/.test(final)) {
    return { alive: false, reason: "greenhouse_requisition_removed" };
  }
  // Lever posting id (uuid-ish) that redirects to the board root = dead.
  if (
    /jobs\.lever\.co\/[^/]+\/[0-9a-f]{8}-/.test(original) &&
    !/[0-9a-f]{8}-[0-9a-f]{4}/.test(final)
  ) {
    return { alive: false, reason: "lever_posting_removed" };
  }
  // Workday requisition path lost after redirect.
  if (/myworkdayjobs\.com\/.+\/job\//.test(original) && !/\/job\//.test(final)) {
    return { alive: false, reason: "workday_requisition_removed" };
  }

  const body = fetched.body.toLowerCase();
  if (body && DEAD_BODY_MARKERS.some((m) => body.includes(m))) {
    return { alive: false, reason: "dead_marker_in_body" };
  }

  return { alive: true, reason: "ok" };
}

// ===== Ground-truth location =====

// Fetch the authoritative location for a Workday posting via the public CXS
// JSON API, which returns the real location even though the HTML is JS-rendered.
// e.g. https://visa.wd5.myworkdayjobs.com/en-US/Visa/job/Data-Engineer_REF082556W
//   -> https://visa.wd5.myworkdayjobs.com/wday/cxs/visa/Visa/job/Data-Engineer_REF082556W
export async function fetchWorkdayLocation(url: string): Promise<string | null> {
  try {
    const m = url.match(
      /https?:\/\/([^.]+)\.([^.]+)\.myworkdayjobs\.com\/([^/]+)\/([^/]+)\/job\/(.+)$/i,
    );
    if (!m) return null;
    const tenant = m[1];
    const site = m[4];
    const jobPath = m[5].split(/[?#]/)[0];
    const host = url.match(/https?:\/\/([^/]+)/)![1];
    const cxsUrl = `https://${host}/wday/cxs/${tenant}/${site}/job/${jobPath}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(cxsUrl, {
        headers: { ...BROWSER_HEADERS, Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const info = data?.jobPostingInfo ?? {};
      const parts: string[] = [];
      if (info.location) parts.push(String(info.location));
      if (Array.isArray(info.additionalLocations)) {
        parts.push(...info.additionalLocations.map(String));
      }
      const joined = parts.filter(Boolean).join(" | ").trim();
      return joined || null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

// Extract a location string from JSON-LD JobPosting markup embedded in an ATS
// page (Greenhouse, Lever, many company sites embed schema.org JobPosting).
export function extractJsonLdLocation(body: string): string | null {
  if (!body) return null;
  try {
    const blocks = [...body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const b of blocks) {
      let json: unknown;
      try {
        json = JSON.parse(b[1].trim());
      } catch {
        continue;
      }
      const candidates = Array.isArray(json) ? json : [json];
      for (const c of candidates) {
        const obj = c as Record<string, unknown>;
        const type = String(obj?.["@type"] ?? "");
        if (!/JobPosting/i.test(type)) continue;
        const loc = obj["jobLocation"];
        const locs = Array.isArray(loc) ? loc : [loc];
        const names: string[] = [];
        for (const l of locs) {
          const addr = (l as Record<string, unknown>)?.["address"] as Record<string, unknown> | undefined;
          if (addr) {
            const bits = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .map((x) => (typeof x === "object" && x ? (x as Record<string, unknown>).name ?? "" : x))
              .filter(Boolean)
              .map(String);
            if (bits.length) names.push(bits.join(", "));
          }
        }
        const jobLocationType = String(obj["jobLocationType"] ?? "");
        if (names.length) {
          return /telecommute|remote/i.test(jobLocationType)
            ? `Remote (${names.join(" | ")})`
            : names.join(" | ");
        }
      }
    }
  } catch {
    // ignore parse failures
  }
  return null;
}

// ===== Location eligibility =====

// EU / EEA member states (candidate work-authorized region when "EU" is present)
// plus common EU city tokens so a bare-city location still resolves correctly.
const EU_TOKENS = [
  "germany", "deutschland", "berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln",
  "france", "paris", "lyon", "netherlands", "amsterdam", "rotterdam", "spain", "madrid", "barcelona",
  "italy", "rome", "milan", "portugal", "lisbon", "porto", "ireland", "dublin", "poland", "warsaw",
  "kraków", "krakow", "belgium", "brussels", "austria", "vienna", "wien", "sweden", "stockholm",
  "denmark", "copenhagen", "finland", "helsinki", "czech", "prague", "romania", "bucharest",
  "greece", "athens", "hungary", "budapest", "luxembourg", "estonia", "tallinn", "lithuania",
  "latvia", "slovakia", "slovenia", "croatia", "bulgaria", "cyprus", "malta",
];

const EU_REGION_TOKENS = ["eu", "e.u.", "european union", "europe", "emea", "eea"];

// Clearly-non-EU countries the candidate would need sponsorship for.
const NON_EU_COUNTRY_PATTERNS: { country: string; re: RegExp }[] = [
  { country: "United States", re: /\b(united states|u\.?s\.?a\.?|\busa\b|u\.?s\.?)\b/i },
  { country: "United States", re: /\bus\s*[-–]\s*/i }, // "US - Foster City"
  { country: "India", re: /\b(india|bangalore|bengaluru|hyderabad|pune|chennai|mumbai|gurgaon|gurugram|noida|delhi)\b/i },
  { country: "Canada", re: /\b(canada|toronto|vancouver|montreal|ottawa|calgary)\b/i },
  { country: "United Kingdom", re: /\b(united kingdom|england|london|manchester)\b/i },
  { country: "Australia", re: /\b(australia|sydney|melbourne)\b/i },
  { country: "Singapore", re: /\bsingapore\b/i },
  { country: "UAE", re: /\b(dubai|abu dhabi|uae|united arab emirates)\b/i },
  { country: "Brazil", re: /\b(brazil|brasil|são paulo|sao paulo)\b/i },
  { country: "Japan", re: /\b(japan|tokyo)\b/i },
];

// US state-code suffix like ", CA" / ", NY" — strong US signal.
const US_STATE_SUFFIX =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

export interface EligibilityInput {
  work_authorized_countries?: string[] | null;
  candidate_country?: string | null;
  needs_sponsorship?: boolean | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  detectedCountry: string | null;
}

// Deterministic location-eligibility check against ground-truth location text.
// Fail-open: only returns ineligible on a positively identified non-authorized
// country with no sponsorship on offer.
export function assessLocationEligibility(
  locationText: string | null | undefined,
  isRemote: boolean,
  visaSponsorship: boolean,
  cv: EligibilityInput,
): EligibilityResult {
  const loc = (locationText ?? "").toLowerCase().trim();
  if (!loc) return { eligible: true, reason: "no_location_data", detectedCountry: null };

  // If sponsorship is explicitly offered, location is not a hard blocker.
  if (visaSponsorship) return { eligible: true, reason: "sponsorship_offered", detectedCountry: null };

  const authorized = (cv.work_authorized_countries ?? []).map((c) => c.toLowerCase());
  const hasEuAuth =
    authorized.some((a) => EU_REGION_TOKENS.includes(a) || EU_TOKENS.includes(a)) ||
    (cv.candidate_country ?? "").toLowerCase() === "germany" ||
    authorized.includes("germany");

  // Authorized-region signal in the location => eligible.
  const mentionsEu =
    EU_REGION_TOKENS.some((t) => new RegExp(`\\b${t.replace(/\./g, "\\.")}\\b`, "i").test(loc)) ||
    EU_TOKENS.some((t) => loc.includes(t));
  if (hasEuAuth && mentionsEu) {
    return { eligible: true, reason: "authorized_region_match", detectedCountry: "EU" };
  }

  // Positively identify a non-authorized country.
  let detected: string | null = null;
  for (const { country, re } of NON_EU_COUNTRY_PATTERNS) {
    if (re.test(loc)) {
      detected = country;
      break;
    }
  }
  if (!detected && US_STATE_SUFFIX.test(locationText ?? "")) detected = "United States";

  if (detected) {
    // Detected a non-authorized country the candidate can't work in without
    // sponsorship. A bare "Remote" label does NOT rescue this — the remote is
    // scoped to that country. Only an authorized-region mention would.
    if (hasEuAuth && mentionsEu) {
      return { eligible: true, reason: "also_authorized_region", detectedCountry: detected };
    }
    return {
      eligible: false,
      reason: `onsite_${detected.replace(/\s+/g, "_").toLowerCase()}_no_sponsorship`,
      detectedCountry: detected,
    };
  }

  // Generic remote with no country signal is fine.
  return { eligible: true, reason: "ambiguous_fail_open", detectedCountry: null };
}
