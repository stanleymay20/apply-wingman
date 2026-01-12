import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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

export function useJobDiscovery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    onSuccess: async (jobs) => {
      console.log("Discovery success, jobs:", jobs?.length);
      
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      
      if (!jobs || jobs.length === 0) {
        toast.info("No new matching jobs found");
        return;
      }

      // Insert discovered jobs into database
      const jobsToInsert = jobs.map((job) => ({
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
      const { error } = await supabase.from("jobs").insert(jobsToInsert);

      if (error) {
        console.error("Failed to save discovered jobs:", error);
        toast.error("Failed to save some discovered jobs");
      } else {
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["applications"] });
        toast.success(`Found ${jobs.length} new jobs!`);

        // Create notification
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "jobs_discovered",
          title: "New Jobs Found",
          message: `Discovered ${jobs.length} matching jobs from your preferred platforms`,
          data: { count: jobs.length },
        });
      }
    },
    onError: (error) => {
      console.error("Discovery error:", error);
      toast.error(`Discovery failed: ${error.message}`);
    },
  });

  return {
    discoverJobs: discoverJobsMutation.mutate,
    isDiscovering: discoverJobsMutation.isPending,
    discoveredJobs: discoverJobsMutation.data,
  };
}
