import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ApplicationEmail {
  id: string;
  user_id: string;
  application_id: string;
  received_at: string;
  from_email: string;
  subject: string;
  snippet: string | null;
  email_type: "response" | "interview" | "rejection" | "offer";
  is_automated: boolean;
  created_at: string;
}

export function useApplicationEmails(applicationId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const emailsQuery = useQuery({
    queryKey: ["application-emails", applicationId],
    queryFn: async () => {
      if (!user || !applicationId) return [];

      const { data, error } = await supabase
        .from("application_emails")
        .select("*")
        .eq("application_id", applicationId)
        .order("received_at", { ascending: false });

      if (error) throw error;
      return data as ApplicationEmail[];
    },
    enabled: !!user && !!applicationId,
  });

  const addEmailMutation = useMutation({
    mutationFn: async ({
      applicationId,
      fromEmail,
      subject,
      snippet,
      emailType,
      receivedAt,
    }: {
      applicationId: string;
      fromEmail: string;
      subject: string;
      snippet?: string;
      emailType: "response" | "interview" | "rejection" | "offer";
      receivedAt?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("application_emails")
        .insert({
          user_id: user.id,
          application_id: applicationId,
          from_email: fromEmail,
          subject,
          snippet,
          email_type: emailType,
          received_at: receivedAt || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update application status based on email type
      const statusMap: Record<string, string> = {
        interview: "interview",
        rejection: "rejected",
        offer: "offer",
      };

      if (statusMap[emailType]) {
        await supabase
          .from("applications")
          .update({
            status: statusMap[emailType],
            company_email_received: true,
            company_email_received_at: receivedAt || new Date().toISOString(),
            company_email_subject: subject,
            company_email_snippet: snippet,
            response_received_at: new Date().toISOString(),
          })
          .eq("id", applicationId);
      } else {
        await supabase
          .from("applications")
          .update({
            company_email_received: true,
            company_email_received_at: receivedAt || new Date().toISOString(),
            company_email_subject: subject,
            company_email_snippet: snippet,
          })
          .eq("id", applicationId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-emails"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Email response logged!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to log email: ${error.message}`);
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from("application_emails")
        .delete()
        .eq("id", emailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["application-emails"] });
      toast.success("Email record deleted");
    },
    onError: () => {
      toast.error("Failed to delete email record");
    },
  });

  return {
    emails: emailsQuery.data || [],
    isLoading: emailsQuery.isLoading,
    addEmail: addEmailMutation.mutate,
    isAdding: addEmailMutation.isPending,
    deleteEmail: deleteEmailMutation.mutate,
    isDeleting: deleteEmailMutation.isPending,
  };
}