import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface Application {
  id: string;
  status: string;
  match_score: number;
  applied_at: string | null;
  created_at: string | null;
  cover_letter: string | null;
  notes: string | null;
  jobs: {
    title: string;
    company: string;
    location: string | null;
    source_platform: string;
    source_url: string;
    job_type: string | null;
    is_remote: boolean | null;
  } | null;
}

export function useApplicationExport() {
  const { user } = useAuth();

  const exportToCSV = useCallback(async () => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          match_score,
          applied_at,
          created_at,
          cover_letter,
          notes,
          jobs (
            title,
            company,
            location,
            source_platform,
            source_url,
            job_type,
            is_remote
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const applications = data as Application[];
      if (!applications || applications.length === 0) {
        toast.info("No applications to export");
        return;
      }

      // Build CSV content
      const headers = [
        "Job Title",
        "Company",
        "Location",
        "Status",
        "Match Score",
        "Platform",
        "Job Type",
        "Remote",
        "Applied Date",
        "Created Date",
        "Job URL",
        "Notes"
      ];

      const rows = applications.map((app) => [
        app.jobs?.title || "",
        app.jobs?.company || "",
        app.jobs?.location || "",
        app.status || "",
        app.match_score?.toString() || "",
        app.jobs?.source_platform || "",
        app.jobs?.job_type || "",
        app.jobs?.is_remote ? "Yes" : "No",
        app.applied_at ? format(new Date(app.applied_at), "yyyy-MM-dd HH:mm") : "",
        app.created_at ? format(new Date(app.created_at), "yyyy-MM-dd HH:mm") : "",
        app.jobs?.source_url || "",
        (app.notes || "").replace(/"/g, '""')
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `applications-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${applications.length} applications`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export applications");
    }
  }, [user]);

  const exportToJSON = useCallback(async () => {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("applications")
        .select(`
          id,
          status,
          match_score,
          applied_at,
          created_at,
          cover_letter,
          notes,
          jobs (
            title,
            company,
            location,
            source_platform,
            source_url,
            job_type,
            is_remote,
            description,
            requirements,
            benefits
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info("No applications to export");
        return;
      }

      const jsonContent = JSON.stringify(data, null, 2);

      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `applications-${format(new Date(), "yyyy-MM-dd")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${data.length} applications`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export applications");
    }
  }, [user]);

  return {
    exportToCSV,
    exportToJSON,
  };
}
