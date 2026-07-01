import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BulletResult {
  original: string;
  impact_score: number;
  weak_verb: string | null;
  strong_verb: string | null;
  has_metric: boolean;
  improved: string;
  reason: string;
}

export function useBulletScorer() {
  const [isScoring, setIsScoring] = useState(false);
  const [results, setResults] = useState<BulletResult[] | null>(null);

  const scoreBullets = async (bullets: string[]) => {
    if (!bullets.length) return;
    setIsScoring(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("score-bullets", {
        body: { bullets },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Scoring failed");
      setResults(data.results as BulletResult[]);
      return data.results as BulletResult[];
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to score bullets");
      return null;
    } finally {
      setIsScoring(false);
    }
  };

  const reset = () => setResults(null);

  return { scoreBullets, isScoring, results, reset };
}
