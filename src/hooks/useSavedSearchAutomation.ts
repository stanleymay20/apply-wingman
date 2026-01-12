import { useEffect, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function frequencyToMs(freq: string | null | undefined) {
  if (freq === "hourly") return 60 * 60 * 1000; // 1 hour
  if (freq === "daily") return 24 * 60 * 60 * 1000; // 24 hours
  return null;
}

function isDue(lastRunAt: string | null, intervalMs: number) {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  return Number.isFinite(last) ? Date.now() - last >= intervalMs : true;
}

/**
 * Runs saved searches automatically while the app is open.
 * Controlled by:
 * - Settings.saved_search_frequency (manual/hourly/daily)
 * - Automation status (must be "running")
 * - Saved searches must be marked as is_active
 */
export function useSavedSearchAutomation() {
  const { profile, user } = useAuth();
  const { searches, markRun, isLoading } = useSavedSearches();
  const queryClient = useQueryClient();
  
  // All refs declared unconditionally at the top
  const runningRef = useRef(false);
  const lastCheckRef = useRef(0);

  const intervalMs = useMemo(
    () => frequencyToMs(profile?.saved_search_frequency),
    [profile?.saved_search_frequency]
  );

  const activeSearches = useMemo(
    () => searches.filter((s) => s.is_active),
    [searches]
  );

  const enabled =
    !!user &&
    profile?.automation_status === "running" &&
    !!intervalMs &&
    !isLoading &&
    activeSearches.length > 0;

  // Inline discovery function to avoid hook ordering issues
  const runDiscovery = useCallback(
    async (params: { keywords: string[]; locations: string[]; platforms: string[] }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("discover-jobs", {
        body: params,
      });

      if (error) throw new Error(error.message || "Failed to discover jobs");
      if (data?.error) throw new Error(data.error);

      const jobs = data?.jobs || [];
      if (jobs.length === 0) return 0;

      // Filter duplicates
      const existingUrls = await supabase
        .from("jobs")
        .select("source_url")
        .eq("user_id", user.id);

      const existingUrlSet = new Set(existingUrls.data?.map((j) => j.source_url) || []);
      const newJobs = jobs.filter((job: { source_url: string }) => !existingUrlSet.has(job.source_url));

      if (newJobs.length === 0) return 0;

      // Insert jobs
      const jobsToInsert = newJobs.map((job: {
        title: string;
        company: string;
        location?: string;
        source_platform: string;
        source_url: string;
        description?: string;
        requirements?: string[];
        is_remote?: boolean;
        job_type?: string;
      }) => ({
        title: job.title,
        company: job.company,
        location: job.location || null,
        source_platform: job.source_platform,
        source_url: job.source_url,
        description: job.description || null,
        requirements: job.requirements || [],
        is_remote: job.is_remote ?? false,
        job_type: job.job_type || null,
        user_id: user.id,
        status: "discovered",
      }));

      const { error: insertError } = await supabase.from("jobs").insert(jobsToInsert);
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      return newJobs.length;
    },
    [user, queryClient]
  );

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    let cancelled = false;

    const run = async () => {
      // Prevent concurrent runs
      if (runningRef.current) return;

      // Throttle checks to every 30 seconds minimum
      const now = Date.now();
      if (now - lastCheckRef.current < 30000) return;
      lastCheckRef.current = now;

      runningRef.current = true;

      try {
        for (const search of activeSearches) {
          if (cancelled) return;
          if (!isDue(search.last_run_at, intervalMs)) continue;

          console.log(`[Automation] Running saved search: ${search.name}`);
          toast.info(`Running saved search: ${search.name}`);

          try {
            const count = await runDiscovery({
              keywords: search.keywords,
              locations: search.locations,
              platforms: search.platforms,
            });

            markRun(search.id);
            if (count > 0) {
              toast.success(`Found ${count} new jobs from "${search.name}"`);
            }
          } catch (err) {
            console.error(`[Automation] Search "${search.name}" failed:`, err);
          }

          // Small delay between searches to avoid rate limiting
          await new Promise((r) => setTimeout(r, 2000));
        }
      } finally {
        runningRef.current = false;
      }
    };

    // Run once on enable (catch up), then check periodically
    run();

    // Check every minute if any search is due
    const id = window.setInterval(run, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs, activeSearches, runDiscovery, markRun]);
}
