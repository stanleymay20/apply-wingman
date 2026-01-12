import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useState } from "react";

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

export interface DiscoveryRunStatus {
  timestamp: string;
  params: DiscoveryParams;
  jobsReturned: number;
  jobsSaved: number;
  error: string | null;
  status: "success" | "partial" | "error";
}

export function useJobDiscovery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lastRun, setLastRun] = useState<DiscoveryRunStatus | null>(null);

  const discoverJobsMutation = useMutation({
    mutationFn: async (params: DiscoveryParams): Promise<DiscoveredJob[]> => {
      if (!user) throw new Error("Not authenticated");

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
          error: null,
          status: "success",
        });
        toast.info("No new matching jobs found");
        return;
      }

      // Filter out jobs that already exist (by source_url)
      const existingUrls = await supabase
        .from("jobs")
        .select("source_url")
        .eq("user_id", user.id);
      
      const existingUrlSet = new Set(existingUrls.data?.map((j) => j.source_url) || []);
      const newJobs = jobs.filter((job) => !existingUrlSet.has(job.source_url));

      if (newJobs.length === 0) {
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs.length,
          jobsSaved: 0,
          error: "All jobs already exist in your list",
          status: "partial",
        });
        toast.info("All discovered jobs already exist in your list");
        return;
      }

      // Insert discovered jobs into database
      const jobsToInsert = newJobs.map((job) => ({
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

      console.log("Inserting jobs:", jobsToInsert.length);
      const { data: insertedData, error } = await supabase.from("jobs").insert(jobsToInsert).select();

      if (error) {
        console.error("Failed to save discovered jobs:", error);
        setLastRun({
          timestamp: new Date().toISOString(),
          params,
          jobsReturned: jobs.length,
          jobsSaved: 0,
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
          error: null,
          status: "success",
        });
        
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["applications"] });
        toast.success(`Found ${savedCount} new real jobs!`);

        // Create notification
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "jobs_discovered",
          title: "Real Jobs Found",
          message: `Discovered ${savedCount} real job listings from ${params.platforms.join(", ")}`,
          data: { count: savedCount, platforms: params.platforms },
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
        error: error.message,
        status: "error",
      });
      toast.error(`Discovery failed: ${error.message}`);
    },
  });

  return {
    discoverJobs: discoverJobsMutation.mutate,
    isDiscovering: discoverJobsMutation.isPending,
    discoveredJobs: discoverJobsMutation.data,
    lastRun,
    clearLastRun: () => setLastRun(null),
  };
}
