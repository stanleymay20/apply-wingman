import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
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
}

export interface DiscoveryRunStatus {
  timestamp: string;
  params: DiscoveryParams;
  jobsReturned: number;
  jobsSaved: number;
  duplicatesSkipped: number;
  error: string | null;
  status: "success" | "partial" | "error";
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
  const queryClient = useQueryClient();
  const [lastRun, setLastRun] = useState<DiscoveryRunStatus | null>(null);

  const discoverJobsMutation = useMutation({
    mutationFn: async (params: DiscoveryParams): Promise<DiscoveredJob[]> => {
      if (!user) throw new Error("Not authenticated");

      // Validate params - no empty searches allowed
      if (!params.keywords || params.keywords.length === 0) {
        throw new Error("At least one keyword is required");
      }

      console.log("Calling discover-jobs with:", params);

      try {
        const { data, error } = await supabase.functions.invoke("discover-jobs", {
          body: params,
        });

        console.log("discover-jobs response:", { data, error });

        if (error) {
          console.error("Edge function error:", error);
          throw new Error(error.message || "Failed to discover jobs");
        }
        if (data?.error) {
          console.error("Data error:", data.error);
          throw new Error(data.error);
        }
        return (data?.jobs || []) as DiscoveredJob[];
      } catch (err) {
        console.error("Discovery fetch error:", err);
        throw err;
      }
    },
    onSuccess: async (jobs, params) => {
      console.log("Discovery success, jobs:", jobs?.length);

      if (!user) {
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs?.length || 0,
          jobsSaved: 0,
          duplicatesSkipped: 0,
          error: "Not authenticated",
          status: "error",
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
        });
        toast.info("No new matching jobs found");
        return;
      }

      // Fetch ALL existing jobs for deduplication (source_url AND external_id)
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("source_url, external_id")
        .eq("user_id", user.id);

      // Build sets for fast lookup with normalized URLs
      const existingUrlSet = new Set<string>();
      const existingIdSet = new Set<string>();
      
      (existingJobs || []).forEach(job => {
        if (job.source_url) {
          existingUrlSet.add(normalizeJobUrl(job.source_url));
        }
        if (job.external_id) {
          existingIdSet.add(job.external_id);
        }
      });

      // Process jobs with deduplication
      const newJobs: DiscoveredJob[] = [];
      const seenInBatch = new Set<string>();
      let duplicatesSkipped = 0;

      for (const job of jobs) {
        const normalizedUrl = normalizeJobUrl(job.source_url);
        const externalId = generateExternalId(job.source_url, job.source_platform);

        // Check for duplicates: normalized URL, external_id, or within this batch
        if (
          existingUrlSet.has(normalizedUrl) ||
          existingIdSet.has(externalId) ||
          seenInBatch.has(normalizedUrl) ||
          seenInBatch.has(externalId)
        ) {
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

      console.log("Inserting jobs:", jobsToInsert.length, "Duplicates skipped:", duplicatesSkipped);
      const { data: insertedData, error } = await supabase.from("jobs").insert(jobsToInsert).select();

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
        });
        toast.error(`Failed to save jobs: ${error.message}`);
      } else {
        const savedCount = insertedData?.length || newJobs.length;
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs.length,
          jobsSaved: savedCount,
          duplicatesSkipped,
          error: null,
          status: "success",
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
    discoveredJobs: discoverJobsMutation.data,
    lastRun,
    clearLastRun: () => setLastRun(null),
  };
}
