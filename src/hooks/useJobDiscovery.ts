import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCVProfile } from "./useCVProfile";
import { toast } from "sonner";
import { useState, useCallback } from "react";

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
  external_id?: string;
  source_type?: "direct_employer" | "agency_or_aggregator";
}

export interface DiscoveryRunStatus {
  timestamp: string;
  params: DiscoveryParams;
  jobsReturned: number;
  jobsSaved: number;
  duplicatesSkipped: number;
  error: string | null;
  status: "success" | "partial" | "error";
  /** Per-source outcome from the edge function, e.g. { firecrawl: "quota_exceeded", arbeitnow: "ok: 12 jobs" } */
  sources?: Record<string, string> | null;
}

// Discovery run status must be shared across every useJobDiscovery() instance:
// the dialog and saved-searches panel trigger runs while Jobs.tsx renders the
// status panel, and per-instance useState left the panel permanently empty.
const LAST_RUN_QUERY_KEY = ["discovery-last-run"];

// The edge function can legitimately run for a while (multiple Firecrawl
// searches + AI enhancement), but without a client timeout a hung function
// leaves the UI silently stuck forever.
const DISCOVERY_TIMEOUT_MS = 120_000;
const MATCH_TIMEOUT_MS = 30_000;
const MAX_AUTO_MATCH_JOBS = 10;
const MATCH_BATCH_SIZE = 3;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s — the edge function did not respond. Check the function logs in Lovable Cloud.`)),
        ms
      )
    ),
  ]);
}

// Normalize URL to detect duplicates across slight variations
function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking params, session IDs, etc.
    const cleanParams = ["utm_source", "utm_medium", "utm_campaign", "ref", "refId", "trk", "trackingId", "returnUrl"];
    cleanParams.forEach(param => parsed.searchParams.delete(param));
    // Lowercase and remove trailing slashes
    return parsed.toString().toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.toLowerCase().replace(/\/+$/, "");
  }
}

// Generate a unique external ID from the URL
function generateExternalId(url: string, platform: string): string {
  const normalized = normalizeJobUrl(url);
  // Extract job ID patterns from common platforms
  const patterns: Record<string, RegExp> = {
    linkedin: /\/view\/(\d+)/,
    indeed: /jk=([a-f0-9]+)/i,
    greenhouse: /\/jobs\/(\d+)/,
    lever: /\/([a-f0-9-]{36})/,
    workday: /\/job\/([^\/]+)/,
  };
  
  const pattern = patterns[platform];
  if (pattern) {
    const match = normalized.match(pattern);
    if (match) return `${platform}_${match[1]}`;
  }
  
  // Fallback: hash the normalized URL
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${platform}_${Math.abs(hash).toString(36)}`;
}

export function useJobDiscovery() {
  const { user } = useAuth();
  const { cvProfile } = useCVProfile();
  const queryClient = useQueryClient();
  const [isMatching, setIsMatching] = useState(false);

  const { data: lastRun = null } = useQuery<DiscoveryRunStatus | null>({
    queryKey: LAST_RUN_QUERY_KEY,
    queryFn: () => null,
    enabled: false,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const setLastRun = useCallback(
    (status: DiscoveryRunStatus | null) => {
      queryClient.setQueryData(LAST_RUN_QUERY_KEY, status);
    },
    [queryClient]
  );

  // Trigger job matching for newly discovered jobs
  const matchJobsInBackground = useCallback(async (jobIds: string[]) => {
    const jobIdsToMatch = jobIds.slice(0, MAX_AUTO_MATCH_JOBS);
    if (!cvProfile?.id || jobIdsToMatch.length === 0) return;
    
    setIsMatching(true);
    const matchResults: { jobId: string; score: number; error?: string }[] = [];

    const matchOneJob = async (jobId: string) => {
      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke("match-job", { body: { jobId, cvProfileId: cvProfile.id } }),
          MATCH_TIMEOUT_MS,
          "Job matching"
        );
        
        if (error) {
          console.error(`Match error for job ${jobId}:`, error);
          return { jobId, score: 0, error: error.message };
        } else if (data?.success) {
          const result = { jobId, score: data.data?.score || 0 };
          
          // Notify for high match scores (80%+)
          if (data.data?.score >= 80) {
            // Fetch job details for notification
            const { data: jobData } = await supabase
              .from("jobs")
              .select("title, company")
              .eq("id", jobId)
              .single();
            
            if (jobData && user) {
              toast.success(`🎯 High match: ${jobData.title} at ${jobData.company}`, {
                description: `${data.data.score}% match! ${data.data.recommendation === 'strong_apply' ? 'Strongly recommended!' : ''}`,
                action: {
                  label: "View",
                  onClick: () => window.location.href = `/jobs/${jobId}`,
                },
              });
              
              // Create persistent notification
              await supabase.from("notifications").insert({
                user_id: user.id,
                type: "high_match_job",
                title: "🎯 High Match Job Found!",
                message: `${jobData.title} at ${jobData.company} - ${data.data.score}% match`,
                data: { jobId, score: data.data.score, recommendation: data.data.recommendation },
              });
            }
          }
          return result;
        }
      } catch (err) {
        console.error(`Match exception for job ${jobId}:`, err);
        return { jobId, score: 0, error: String(err) };
      }
      return { jobId, score: 0, error: "No match score returned" };
    };

    try {
      for (let i = 0; i < jobIdsToMatch.length; i += MATCH_BATCH_SIZE) {
        const batch = jobIdsToMatch.slice(i, i + MATCH_BATCH_SIZE);
        matchResults.push(...await Promise.all(batch.map(matchOneJob)));

        if (i + MATCH_BATCH_SIZE < jobIdsToMatch.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } finally {
      setIsMatching(false);
    }
    
    const successCount = matchResults.filter(r => !r.error).length;
    const highMatches = matchResults.filter(r => r.score >= 80).length;
    
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      if (highMatches > 0) {
        toast.success(`Matched ${successCount} jobs! ${highMatches} with 80%+ score`);
      }
    }
    
    return matchResults;
  }, [cvProfile?.id, user, queryClient]);

  const discoverJobsMutation = useMutation({
    mutationFn: async (
      params: DiscoveryParams
    ): Promise<{ jobs: DiscoveredJob[]; sources: Record<string, string> | null }> => {
      if (!user) throw new Error("Not authenticated");

      // Validate params - no empty searches allowed
      if (!params.keywords || params.keywords.length === 0) {
        throw new Error("At least one keyword is required");
      }

      console.log("Calling discover-jobs with:", params);

      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke("discover-jobs", { body: params }),
          DISCOVERY_TIMEOUT_MS,
          "Job discovery"
        );

        console.log("discover-jobs response:", { data, error });

        if (error) {
          console.error("Edge function error:", error);
          throw new Error(error.message || "Failed to discover jobs");
        }
        if (data?.error) {
          console.error("Data error:", data.error, "sources:", data.sources);
          const userFacingError = data.code === "AI_NOT_CONFIGURED"
            ? "AI service is not configured. Open Admin → AI Provider and choose an available provider, then try discovery again."
            : data.error;
          const sourceSummary = data.sources
            ? ` [${Object.entries(data.sources as Record<string, string>)
                .map(([name, status]) => `${name}: ${status}`)
                .join(", ")}]`
            : "";
          throw new Error(userFacingError + sourceSummary);
        }
        return {
          jobs: (data?.jobs || []) as DiscoveredJob[],
          sources: (data?.sources as Record<string, string> | undefined) ?? null,
        };
      } catch (err) {
        console.error("Discovery fetch error:", err);
        throw err;
      }
    },
    onSuccess: async ({ jobs, sources }, params) => {
      console.log("Discovery success, jobs:", jobs?.length, "sources:", sources);

      if (!user) {
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs?.length || 0,
          jobsSaved: 0,
          duplicatesSkipped: 0,
          error: "Not authenticated",
          status: "error",
          sources,
        });
        toast.error("Not authenticated");
        return;
      }

      if (!jobs || jobs.length === 0) {
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: 0,
          jobsSaved: 0,
          duplicatesSkipped: 0,
          error: null,
          status: "success",
          sources,
        });
        toast.info("No new matching jobs found");
        return;
      }

      // Process jobs with batch-level deduplication. Existing-row deduplication
      // is enforced by the database via jobs.source_key, so we avoid the old
      // "fetch all jobs" approach that silently capped at 1,000 rows.
      const newJobs: DiscoveredJob[] = [];
      const seenInBatch = new Set<string>();
      let duplicatesSkipped = 0;

      for (const job of jobs) {
        const normalizedUrl = normalizeJobUrl(job.source_url);
        const externalId = generateExternalId(job.source_url, job.source_platform);

        // Check duplicates within this function response; existing duplicates
        // are ignored by the upsert below using the database's unique source key.
        if (seenInBatch.has(normalizedUrl) || seenInBatch.has(externalId)) {
          duplicatesSkipped++;
          continue;
        }

        seenInBatch.add(normalizedUrl);
        seenInBatch.add(externalId);
        newJobs.push({ ...job, external_id: externalId });
      }

      if (newJobs.length === 0) {
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs.length,
          jobsSaved: 0,
          duplicatesSkipped,
          error: "All jobs already exist in your list",
          status: "partial",
          sources,
        });
        toast.info(`Found ${jobs.length} jobs, but all ${duplicatesSkipped} were duplicates`);
        return;
      }

      // Insert discovered jobs into database
      const jobsToInsert = newJobs.map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location || null,
        source_platform: job.source_platform,
        source_url: job.source_url,
        external_id: job.external_id || null,
        description: job.description || null,
        requirements: job.requirements || [],
        is_remote: job.is_remote ?? false,
        job_type: job.job_type || null,
        user_id: user.id,
        status: "discovered",
      }));

      console.log("Saving jobs:", jobsToInsert.length, "Batch duplicates skipped:", duplicatesSkipped);
      const { data: insertedData, error } = await supabase
        .from("jobs")
        .upsert(jobsToInsert, { onConflict: "user_id,source_key", ignoreDuplicates: true })
        .select();

      if (error) {
        console.error("Failed to save discovered jobs:", error);
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs.length,
          jobsSaved: 0,
          duplicatesSkipped,
          error: `Database error: ${error.code} - ${error.message}`,
          status: "error",
          sources,
        });
        toast.error(`Failed to save jobs: ${error.message}`);
      } else {
        const savedCount = insertedData?.length ?? newJobs.length;
        duplicatesSkipped += Math.max(0, newJobs.length - savedCount);
        const insertedJobIds = insertedData?.map(j => j.id) || [];

        if (savedCount === 0) {
          setLastRun({
            timestamp: new Date().toISOString(),
            params,
            jobsReturned: jobs.length,
            jobsSaved: 0,
            duplicatesSkipped,
            error: "All jobs already exist in your list",
            status: "partial",
            sources,
          });
          toast.info(`Found ${jobs.length} jobs, but all ${duplicatesSkipped} were duplicates`);
          return;
        }
        
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs.length,
          jobsSaved: savedCount,
          duplicatesSkipped,
          error: null,
          status: "success",
          sources,
        });

        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["applications"] });
        
        const message = duplicatesSkipped > 0 
          ? `Found ${savedCount} new jobs! (${duplicatesSkipped} duplicates skipped)`
          : `Found ${savedCount} new jobs!`;
        toast.success(message);

        // Create notification
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "jobs_discovered",
          title: "Jobs Found",
          message: `Discovered ${savedCount} new job listings${duplicatesSkipped > 0 ? ` (${duplicatesSkipped} duplicates filtered)` : ""}`,
          data: { count: savedCount, duplicatesSkipped, platforms: params.platforms },
        });

        // Trigger automatic job matching for newly discovered jobs
        if (insertedJobIds.length > 0 && cvProfile?.id) {
          toast.info("Calculating match scores for new jobs...");
          matchJobsInBackground(insertedJobIds);
        }
      }
    },
    onError: (error, params) => {
      console.error("Discovery error:", error);
      setLastRun({
        timestamp: new Date().toISOString(),
        params,
        jobsReturned: 0,
        jobsSaved: 0,
        duplicatesSkipped: 0,
        error: error.message,
        status: "error",
      });
      toast.error(`Discovery failed: ${error.message}`);
    },
  });

  // Promise-based wrapper for automation hook
  const discoverJobsAsync = useCallback(
    (params: DiscoveryParams) => {
      return discoverJobsMutation.mutateAsync(params);
    },
    [discoverJobsMutation]
  );

  return {
    discoverJobs: discoverJobsMutation.mutate,
    discoverJobsAsync,
    isDiscovering: discoverJobsMutation.isPending,
    isMatching,
    matchJobsInBackground,
    discoveredJobs: discoverJobsMutation.data?.jobs,
    lastRun,
    clearLastRun: () => setLastRun(null),
  };
}
