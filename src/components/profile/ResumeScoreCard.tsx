import { useState } from "react";
import { Target, CheckCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useResumeScore } from "@/hooks/useResumeScore";

interface ATSSuggestion {
  category: string;
  priority: string;
  suggestion: string;
}

interface ATSResult {
  score: number;
  suggestions: ATSSuggestion[];
  strengths: string[];
  missing_elements: string[];
  keyword_density: string;
}

interface ResumeScoreCardProps {
  cvProfileId: string;
  cvText: string;
  skills?: string[];
  experienceYears?: number;
  seniorityLevel?: string;
  existingScore?: number | null;
  existingSuggestions?: ATSResult | null;
}

export function ResumeScoreCard({
  cvProfileId,
  cvText,
  skills,
  experienceYears,
  seniorityLevel,
  existingScore,
  existingSuggestions,
}: ResumeScoreCardProps) {
  const { scoreResume, isScoring, scoreResult } = useResumeScore();
  const [expanded, setExpanded] = useState(false);

  const result = scoreResult || existingSuggestions;
  const score = scoreResult?.score ?? existingScore;

  const handleScore = () => {
    scoreResume({
      cvProfileId,
      cvText,
      skills,
      experience_years: experienceYears,
      seniority_level: seniorityLevel,
    });
  };

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-success";
    if (s >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    if (s >= 40) return "Fair";
    return "Needs Work";
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "high") return "bg-destructive/20 text-destructive border-destructive/30";
    if (priority === "medium") return "bg-warning/20 text-warning border-warning/30";
    return "bg-muted text-muted-foreground border-muted";
  };

  return (
    <div className="glass-card p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/20">
            <Target className="w-5 h-5 text-info" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">ATS Score</h2>
            <p className="text-sm text-muted-foreground">Applicant Tracking System compatibility</p>
          </div>
        </div>

        {score !== null && score !== undefined && (
          <div className={cn("text-3xl font-bold", getScoreColor(score))}>
            {score}
            <span className="text-lg">/100</span>
          </div>
        )}
      </div>

      {score !== null && score !== undefined ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">{getScoreLabel(score)}</span>
              <span className="text-sm font-medium text-foreground">{score}%</span>
            </div>
            <Progress value={score} className="h-2" />
          </div>

          {result?.keyword_density && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Keyword Density:</span>
              <Badge variant="outline" className="capitalize">
                {result.keyword_density}
              </Badge>
            </div>
          )}

          {result?.strengths && result.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Strengths
              </h4>
              <ul className="space-y-1">
                {result.strengths.slice(0, expanded ? undefined : 3).map((strength, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-success mt-1">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result?.suggestions && result.suggestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Suggestions
              </h4>
              <div className="space-y-2">
                {result.suggestions
                  .slice(0, expanded ? undefined : 3)
                  .map((s, i) => (
                    <div key={i} className="p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getPriorityColor(s.priority)}>
                          {s.priority}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {s.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{s.suggestion}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {(result?.suggestions?.length > 3 || result?.strengths?.length > 3) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="w-full"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show All
                </>
              )}
            </Button>
          )}

          <Button variant="outline" onClick={handleScore} disabled={isScoring} className="w-full">
            {isScoring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Re-analyzing...
              </>
            ) : (
              "Re-analyze Resume"
            )}
          </Button>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Analyze your resume for ATS compatibility and get actionable suggestions
          </p>
          <Button onClick={handleScore} disabled={isScoring || !cvText}>
            {isScoring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Target className="w-4 h-4 mr-2" />
                Analyze Resume
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
