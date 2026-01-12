import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  keywords: string[];
  locations: string[];
  platforms: string[];
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateSearchParams {
  name: string;
  keywords: string[];
  locations: string[];
  platforms: string[];
}

export function useSavedSearches() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const searchesQuery = useQuery({
    queryKey: ["saved-searches", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SavedSearch[];
    },
    enabled: !!user,
  });

  const createSearchMutation = useMutation({
    mutationFn: async (params: CreateSearchParams) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("saved_searches")
        .insert({ ...params, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Search saved");
    },
    onError: (error) => {
      toast.error(`Failed to save search: ${error.message}`);
    },
  });

  const updateSearchMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<SavedSearch> & { id: string }) => {
      const { error } = await supabase
        .from("saved_searches")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
      toast.success("Search deleted");
    },
  });

  const markRunMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_searches")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });

  return {
    searches: searchesQuery.data || [],
    isLoading: searchesQuery.isLoading,
    createSearch: createSearchMutation.mutate,
    updateSearch: updateSearchMutation.mutate,
    deleteSearch: deleteSearchMutation.mutate,
    markRun: markRunMutation.mutate,
    isCreating: createSearchMutation.isPending,
  };
}
