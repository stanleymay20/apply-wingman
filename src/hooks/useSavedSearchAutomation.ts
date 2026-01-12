import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useJobDiscovery } from "@/hooks/useJobDiscovery";

function frequencyToMs(freq: string | null | undefined) {
  if (freq === "hourly") return 60 * 60 * 1000;
  if (freq === "daily") return 24 * 60 * 60 * 1000;
  return null;
}

function isDue(lastRunAt: string | null, intervalMs: number) {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  return Number.isFinite(last) ? Date.now() - last >= intervalMs : true;
}

/**
 * Runs saved searches automatically while the app is open.
 * Controlled by Settings.saved_search_frequency AND Automation status (running).
 */
export function useSavedSearchAutomation() {
  const { profile } = useAuth();
  const { searches, markRun, isLoading } = useSavedSearches();
  const { discoverJobsAsync } = useJobDiscovery() as unknown as {
    discoverJobsAsync: (params: { keywords: string[]; locations: string[]; platforms: string[] }) => Promise<unknown>;
  };

  const intervalMs = useMemo(
    () => frequencyToMs(profile?.saved_search_frequency),
    [profile?.saved_search_frequency]
  );

  const enabled =
    profile?.automation_status === "running" &&
    !!intervalMs &&
    !isLoading &&
    searches.some((s) => s.is_active);

  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled || !intervalMs) return;

    let cancelled = false;

    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const active = searches.filter((s) => s.is_active);
        for (const search of active) {
          if (cancelled) return;
          if (!isDue(search.last_run_at, intervalMs)) continue;

          await discoverJobsAsync({
            keywords: search.keywords,
            locations: search.locations,
            platforms: search.platforms,
          });

          // Mark run after successful discovery
          markRun(search.id);
        }
      } finally {
        runningRef.current = false;
      }
    };

    // Run once on enable (catch up), then at interval
    run();
    const id = window.setInterval(run, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs, searches, discoverJobsAsync, markRun]);
}
