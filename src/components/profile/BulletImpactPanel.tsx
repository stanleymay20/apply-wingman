import { useState } from "react";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useBulletScorer, type BulletResult } from "@/hooks/useBulletScorer";
import { toast } from "sonner";

interface WorkHistoryItem {
  title?: string;
  company?: string;
  responsibilities?: string[];
  [key: string]: unknown;
}

interface BulletImpactPanelProps {
  workHistory: WorkHistoryItem[];
}

function scoreColor(score: number) {
  if (score >= 8) return "text-success";
  if (score >= 5) return "text-warning";
  return "text-destructive";
}

function scoreBg(score: number) {
  if (score >= 8) return "bg-success/10 border-success/20";
  if (score >= 5) return "bg-warning/10 border-warning/20";
  return "bg-destructive/10 border-destructive/20";
}

function scoreLabel(score: number) {
  if (score >= 8) return "Strong";
  if (score >= 5) return "OK";
  return "Weak";
}

export function BulletImpactPanel({ workHistory }: BulletImpactPanelProps) {
  const { scoreBullets, isScoring, results, reset } = useBulletScorer();
  const [expanded, setExpanded] = useState<number | null>(null);

  const allBullets = workHistory.flatMap((w) => w.responsibilities || []).filter(Boolean);
  const avgScore = results
    ? Math.round(results.reduce((sum, r) => sum + r.impact_score, 0) / results.length)
    : null;

  const handleScore = () => {
    if (!allBullets.length) {
      toast.error("No bullet points found in your work history. Parse your CV first.");
      return;
    }
    scoreBullets(allBullets);
  };

  const handleCopyImproved = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied improved bullet");
  };

  if (!allBullets.length) return null;

  return (
    <div className="glass-card p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/20">
            <TrendingUp className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Bullet Impact Score</h2>
            <p className="text-sm text-muted-foreground">
              AI scores each resume bullet and suggests stronger action verbs
            </p>
          </div>
        </div>

        {avgScore !== null && (
          <div className={cn("text-3xl font-bold", scoreColor(avgScore))}>
            {avgScore}
            <span className="text-lg">/10</span>
          </div>
        )}
      </div>

      {!results && (
        <Button onClick={handleScore} disabled={isScoring} className="w-full">
          {isScoring ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scoring {allBullets.length} bullets...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Score My Bullets ({allBullets.length})
            </>
          )}
        </Button>
      )}

      {results && (
        <>
          <div className="mb-4">
            <div className="flex justify-between mb-1 text-sm">
              <span className="text-muted-foreground">{scoreLabel(avgScore!)} overall impact</span>
              <span className="font-medium">{avgScore}/10</span>
            </div>
            <Progress value={(avgScore! / 10) * 100} className="h-2" />
          </div>

          <div className="space-y-3">
            {results.map((r, i) => (
              <div
                key={i}
                className={cn("rounded-lg border p-3 cursor-pointer transition-colors", scoreBg(r.impact_score))}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("text-lg font-bold shrink-0 w-8 text-center", scoreColor(r.impact_score))}>
                    {r.impact_score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{r.original}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.weak_verb && (
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                          weak: "{r.weak_verb}" → "{r.strong_verb}"
                        </Badge>
                      )}
                      {!r.has_metric && (
                        <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                          no metric
                        </Badge>
                      )}
                      {r.has_metric && (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          has metric
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-muted-foreground">
                    {expanded === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {expanded === i && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                    <div className="flex items-start gap-2 p-2 bg-background/50 rounded">
                      <ArrowRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground flex-1">{r.improved}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyImproved(r.improved); }}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy improved version"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={reset}>
            Re-score
          </Button>
        </>
      )}
    </div>
  );
}
