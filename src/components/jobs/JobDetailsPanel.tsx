import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  MapPin,
  Calendar,
  Briefcase,
  Target,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ResumeTailorButton } from "@/components/jobs/ResumeTailorButton";

interface MatchBreakdown {
  skills_match?: number;
  experience_match?: number;
  location_match?: number;
  seniority_match?: number;
  [key: string]: number | undefined;
}

interface MatchDetails {
  score: number;
  breakdown?: MatchBreakdown;
  matching_skills?: string[];
  missing_skills?: string[];
  recommendations?: string[];
}

export interface JobDetailsPanelJob {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  source_platform: string;
  source_url: string;
  description?: string | null;
  requirements?: string[] | null;
  is_remote?: boolean | null;
  job_type?: string | null;
  status?: string | null;
  match_score?: number | null;
  match_details?: unknown;
  created_at?: string | null;
  posted_at?: string | null;
}

interface JobDetailsPanelProps {
  job: JobDetailsPanelJob;
  onMatch?: (jobId: string) => void;
  isMatching?: boolean;
  hasCV?: boolean;
  /** If true, wraps content in a ScrollArea for constrained containers (e.g. drawer). */
  scroll?: boolean;
}

export function JobDetailsPanel({
  job,
  onMatch,
  isMatching,
  hasCV,
  scroll = false,
}: JobDetailsPanelProps) {
  const matchDetails = job.match_details as MatchDetails | null | undefined;
  const breakdown = matchDetails?.breakdown;

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-success/10 border-success/20";
    if (score >= 60) return "bg-warning/10 border-warning/20";
    return "bg-muted border-border";
  };

  const Content = (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{job.title}</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          {job.company}
        </p>
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-2">
        {job.location && (
          <Badge variant="outline" className="gap-1">
            <MapPin className="w-3 h-3" />
            {job.location}
          </Badge>
        )}
        {job.is_remote && (
          <Badge variant="outline" className="bg-primary/10 border-primary/20">
            Remote
          </Badge>
        )}
        {job.job_type && (
          <Badge variant="outline" className="capitalize">
            <Briefcase className="w-3 h-3 mr-1" />
            {job.job_type}
          </Badge>
        )}
        <Badge variant="outline" className="capitalize">
          {job.source_platform}
        </Badge>
      </div>

      {/* Match Score */}
      {job.match_score ? (
        <div className={cn("p-4 rounded-lg border", getScoreBg(job.match_score))}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Match Score</span>
            <span className={cn("text-2xl font-bold", getScoreColor(job.match_score))}>
              {job.match_score}%
            </span>
          </div>

          {breakdown && (
            <div className="space-y-2">
              {Object.entries(breakdown).map(([key, value]) => {
                if (value === undefined) return null;
                const label = key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            value >= 80
                              ? "bg-success"
                              : value >= 60
                                ? "bg-warning"
                                : "bg-muted-foreground"
                          )}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{value}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {matchDetails?.matching_skills && matchDetails.matching_skills.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-success" />
                Matching Skills
              </p>
              <div className="flex flex-wrap gap-1">
                {matchDetails.matching_skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="bg-success/10 text-success border-success/20 text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {matchDetails?.missing_skills && matchDetails.missing_skills.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <XCircle className="w-4 h-4 text-destructive" />
                Missing Skills
              </p>
              <div className="flex flex-wrap gap-1">
                {matchDetails.missing_skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-destructive/20 text-xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {matchDetails?.recommendations && matchDetails.recommendations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-sm font-medium mb-2">Recommendations</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {matchDetails.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasCV && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <ResumeTailorButton
                job={{
                  id: job.id,
                  title: job.title,
                  company: job.company,
                  description: job.description,
                  requirements: job.requirements,
                }}
                size="sm"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-dashed border-border bg-secondary/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Not Matched Yet</p>
              <p className="text-sm text-muted-foreground">
                {hasCV
                  ? "Calculate how well this job matches your CV"
                  : "Upload your CV first to enable matching"}
              </p>
            </div>
            {hasCV && (
              <div className="flex gap-2">
                {onMatch && (
                  <Button size="sm" onClick={() => onMatch(job.id)} disabled={isMatching}>
                    {isMatching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-1" />
                        Match
                      </>
                    )}
                  </Button>
                )}
                <ResumeTailorButton
                  job={{
                    id: job.id,
                    title: job.title,
                    company: job.company,
                    description: job.description,
                    requirements: job.requirements,
                  }}
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Description */}
      {job.description && (
        <div>
          <h4 className="font-medium mb-2">Description</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {job.description}
          </p>
        </div>
      )}

      {/* Requirements */}
      {job.requirements && job.requirements.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Requirements</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {job.requirements.map((req, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dates */}
      <div className="text-xs text-muted-foreground space-y-1">
        {job.posted_at && (
          <p className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Posted {formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })}
          </p>
        )}
        {job.created_at && (
          <p className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Discovered {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </p>
        )}
      </div>
    </div>
  );

  if (!scroll) return Content;

  return (
    <ScrollArea className="flex-1">
      <div className="pr-2">{Content}</div>
    </ScrollArea>
  );
}
