import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ReferralEmail {
  id: string;
  user_id: string;
  application_id: string | null;
  job_id: string | null;
  recipient_name: string;
  recipient_email: string;
  recipient_title: string | null;
  company: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateReferralParams {
  application_id?: string;
  job_id?: string;
  recipient_name: string;
  recipient_email: string;
  recipient_title?: string;
  company: string;
  subject: string;
  body: string;
}

interface GenerateEmailParams {
  recipientName: string;
  recipientTitle?: string;
  company: string;
  jobTitle: string;
  userName: string;
  userSkills?: string[];
  userExperience?: number;
  userSummary?: string;
}

export function useReferralEmails() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const emailsQuery = useQuery({
    queryKey: ["referral-emails", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("referral_emails")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ReferralEmail[];
    },
    enabled: !!user,
  });

  const generateEmailMutation = useMutation({
    mutationFn: async (params: GenerateEmailParams) => {
      const { data, error } = await supabase.functions.invoke("generate-referral-email", {
        body: params,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { subject: string; body: string; tips?: string[] };
    },
    onError: (error) => {
      toast.error(`Failed to generate email: ${error.message}`);
    },
  });

  const createEmailMutation = useMutation({
    mutationFn: async (params: CreateReferralParams) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("referral_emails")
        .insert({ ...params, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-emails"] });
      toast.success("Referral email saved");
    },
    onError: (error) => {
      toast.error(`Failed to save email: ${error.message}`);
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReferralEmail> & { id: string }) => {
      const { error } = await supabase
        .from("referral_emails")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-emails"] });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("referral_emails")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-emails"] });
      toast.success("Email deleted");
    },
  });

  const markAsSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("referral_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-emails"] });
      toast.success("Marked as sent");
    },
  });

  return {
    emails: emailsQuery.data || [],
    isLoading: emailsQuery.isLoading,
    generateEmail: generateEmailMutation.mutateAsync,
    isGenerating: generateEmailMutation.isPending,
    createEmail: createEmailMutation.mutate,
    updateEmail: updateEmailMutation.mutate,
    deleteEmail: deleteEmailMutation.mutate,
    markAsSent: markAsSent.mutate,
    isCreating: createEmailMutation.isPending,
  };
}
