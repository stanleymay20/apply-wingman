import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useJobDiscovery } from "@/hooks/useJobDiscovery";
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
  const { discoverJobsAsync, isDiscovering } = useJobDiscovery();

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

  const runningRef = useRef(false);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    let cancelled = false;

    const run = async () => {
      // Prevent concurrent runs
      if (runningRef.current || isDiscovering) return;
      
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
            await discoverJobsAsync({
              keywords: search.keywords,
              locations: search.locations,
              platforms: search.platforms,
            });

            // Mark run after successful discovery
            markRun(search.id);
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
  }, [enabled, intervalMs, activeSearches, discoverJobsAsync, markRun, isDiscovering]);
}
