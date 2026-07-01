import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TailorResult {
  tailored_summary: string;
  tailored_cv_text: string;
  key_changes: string[];
  keywords_added: string[];
}

export function useResumeTailor() {
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null);

  const tailorResume = async (cvProfile: Record<string, unknown>, job: Record<string, unknown>) => {
    setIsTailoring(true);
    setTailorResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("tailor-resume", {
        body: { cvProfile, job },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Tailoring failed");

      setTailorResult(data as TailorResult);
      return data as TailorResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to tailor resume";
      toast.error(msg);
      return null;
    } finally {
      setIsTailoring(false);
    }
  };

  const reset = () => setTailorResult(null);

  return { tailorResume, isTailoring, tailorResult, reset };
}
