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
    mutationFn: async (params: DiscoveryParams) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("discover-jobs", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.jobs as DiscoveredJob[];
    },
    onSuccess: async (jobs) => {
      if (!user || jobs.length === 0) {
        toast.info("No new matching jobs found");
        return;
      }

      // Insert discovered jobs into database
      const jobsToInsert = jobs.map((job) => ({
        ...job,
        user_id: user.id,
        status: "discovered",
      }));

      const { error } = await supabase.from("jobs").insert(jobsToInsert);

      if (error) {
        console.error("Failed to save discovered jobs:", error);
        toast.error("Failed to save some discovered jobs");
      } else {
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
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
      toast.error(`Discovery failed: ${error.message}`);
    },
  });

  return {
    discoverJobs: discoverJobsMutation.mutate,
    isDiscovering: discoverJobsMutation.isPending,
    discoveredJobs: discoverJobsMutation.data,
  };
}
