import { useState } from "react";
import {
  Sparkles,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { 
  useCVAutoOptimization, 
  OptimizationChange, 
  OptimizationResult 
} from "@/hooks/useCVAutoOptimization";

interface CVAutoOptimizationPanelProps {
  cvProfileId: string;
  cvSummary: string;
  cvSkills: string[];
  experienceYears?: number;
  seniorityLevel?: string;
  currentScore?: number | null;
  atsSuggestions?: any;
  onOptimizationComplete?: () => void;
}

export function CVAutoOptimizationPanel({
  cvProfileId,
  cvSummary,
  cvSkills,
  experienceYears,
  seniorityLevel,
  currentScore,
  atsSuggestions,
  onOptimizationComplete,
}: CVAutoOptimizationPanelProps) {
  const {
    runAutoOptimization,
    generateOptimization,
    applyOptimization,
    progress,
    pendingChanges,
    isOptimizing,
    isRunning,
    resetOptimization,
    TARGET_SCORE,
  } = useCVAutoOptimization();

  const [showPreview, setShowPreview] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const handleAutoOptimize = async () => {
    const result = await runAutoOptimization(cvProfileId, {
      summary: cvSummary,
      skills: cvSkills,
      experienceYears,
      seniorityLevel,
    });

    if (result.success && onOptimizationComplete) {
      onOptimizationComplete();
    }
  };

  const handlePreviewOptimization = async () => {
    try {
      await generateOptimization(cvProfileId, currentScore || undefined, atsSuggestions);
      setShowPreview(true);
    } catch {
      setShowPreview(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!pendingChanges) return;
    const success = await applyOptimization(cvProfileId, pendingChanges.optimized);
    if (success && onOptimizationComplete) {
      onOptimizationComplete();
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-success/20 text-success border-success/30";
      case "medium":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case "scoring":
        return <Target className="w-5 h-5 text-info animate-pulse" />;
      case "optimizing":
        return <Sparkles className="w-5 h-5 text-primary animate-pulse" />;
      case "applying":
        return <Zap className="w-5 h-5 text-warning animate-pulse" />;
      case "verifying":
        return <RefreshCw className="w-5 h-5 text-info animate-spin" />;
      case "complete":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Sparkles className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const needsOptimization = currentScore !== null && currentScore !== undefined && currentScore < TARGET_SCORE;
  const isOptimized = currentScore !== null && currentScore !== undefined && currentScore >= TARGET_SCORE;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isOptimized ? "bg-success/20" : "bg-primary/20"
            )}>
              {isOptimized ? (
                <CheckCircle className="w-5 h-5 text-success" />
              ) : (
                <Sparkles className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">CV Auto-Optimization</CardTitle>
              <CardDescription>
                AI-powered rewriting to achieve {TARGET_SCORE}%+ ATS score
              </CardDescription>
            </div>
          </div>
          {currentScore !== null && currentScore !== undefined && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-lg font-bold px-3 py-1",
                  currentScore >= TARGET_SCORE
                    ? "bg-success/20 text-success border-success/30"
                    : currentScore >= 70
                    ? "bg-warning/20 text-warning border-warning/30"
                    : "bg-destructive/20 text-destructive border-destructive/30"
                )}
              >
                {currentScore}%
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Display */}
        {isRunning && (
          <div className="p-4 bg-secondary/50 rounded-lg border border-border/50 space-y-3">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{progress.message}</p>
                <p className="text-xs text-muted-foreground">
                  Iteration {progress.iteration} of {progress.maxIterations}
                </p>
              </div>
            </div>
            <Progress 
              value={(progress.iteration / progress.maxIterations) * 100} 
              className="h-2"
            />
            {progress.currentScore !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Score:</span>
                <span className="font-medium text-foreground">{progress.currentScore}%</span>
              </div>
            )}
          </div>
        )}

        {/* Completion Status */}
        {progress.status === "complete" && (
          <div className="p-4 bg-success/10 rounded-lg border border-success/30 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Optimization Complete!</p>
              <p className="text-xs text-muted-foreground">{progress.message}</p>
            </div>
          </div>
        )}

        {progress.status === "failed" && (
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Optimization Incomplete</p>
              <p className="text-xs text-muted-foreground">{progress.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetOptimization}>
              Try Again
            </Button>
          </div>
        )}

        {/* Pending Changes Preview */}
        {pendingChanges && showPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview Changes
              </h4>
              <Badge variant="outline" className="bg-info/20 text-info border-info/30">
                Est. Score: {pendingChanges.estimated_score}%
              </Badge>
            </div>

            {pendingChanges.changes.map((change, index) => (
              <Collapsible
                key={index}
                open={expandedSections.includes(`change-${index}`)}
                onOpenChange={() => toggleSection(`change-${index}`)}
              >
                <CollapsibleTrigger asChild>
                  <div className="p-3 bg-secondary/50 rounded-lg border border-border/50 cursor-pointer hover:bg-secondary/70 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getImpactColor(change.impact)}>
                          {change.impact}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{change.section}</span>
                      </div>
                      {expandedSections.includes(`change-${index}`) ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{change.improvement}</p>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <p className="text-xs font-medium text-destructive mb-1">Original:</p>
                    <p className="text-xs text-muted-foreground">{change.original}</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="p-3 bg-success/5 rounded-lg border border-success/20">
                    <p className="text-xs font-medium text-success mb-1">Optimized:</p>
                    <p className="text-xs text-muted-foreground">{change.optimized}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            {pendingChanges.notes && (
              <div className="p-3 bg-info/5 rounded-lg border border-info/20">
                <p className="text-xs font-medium text-info mb-1">Optimization Notes:</p>
                <p className="text-xs text-muted-foreground">{pendingChanges.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleApplyChanges} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Apply Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  resetOptimization();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {progress.status === "idle" && !showPreview && (
          <div className="space-y-3">
            {needsOptimization && (
              <div className="p-3 bg-warning/10 rounded-lg border border-warning/30 flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning">
                    Score below {TARGET_SCORE}% threshold
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Auto-apply requires {TARGET_SCORE}%+ ATS score. Run auto-optimization to improve your CV.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleAutoOptimize}
                disabled={isOptimizing || isRunning}
                className="gap-2"
              >
                {isOptimizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Auto-Optimize
              </Button>
              <Button
                variant="outline"
                onClick={handlePreviewOptimization}
                disabled={isOptimizing || isRunning}
                className="gap-2"
              >
                {isOptimizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Preview First
              </Button>
            </div>

            {isOptimized && (
              <p className="text-xs text-center text-success">
                ✓ Your CV meets the {TARGET_SCORE}%+ threshold for auto-apply
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
