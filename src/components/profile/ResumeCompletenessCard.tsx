import { CheckCircle2, AlertCircle, Circle, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CVProfile {
  summary?: string | null;
  skills?: string[] | null;
  work_history?: unknown[] | null;
  education?: unknown[] | null;
  experience_years?: number | null;
  seniority_level?: string | null;
  cv_file_url?: string | null;
  keywords?: string[] | null;
  languages?: string[] | null;
}

interface UserProfile {
  preferred_roles?: string[] | null;
  preferred_locations?: string[] | null;
}

interface Section {
  label: string;
  done: boolean;
  tip: string;
  weight: number;
}

function buildSections(cv: CVProfile, user: UserProfile): Section[] {
  const workHistory = Array.isArray(cv.work_history) ? cv.work_history : [];
  const education = Array.isArray(cv.education) ? cv.education : [];
  const skills = Array.isArray(cv.skills) ? cv.skills : [];
  const keywords = Array.isArray(cv.keywords) ? cv.keywords : [];
  const preferredRoles = Array.isArray(user.preferred_roles) ? user.preferred_roles : [];
  const preferredLocations = Array.isArray(user.preferred_locations) ? user.preferred_locations : [];

  return [
    {
      label: "Resume uploaded",
      done: !!cv.cv_file_url,
      tip: "Upload a PDF or DOCX so your resume can be attached to applications.",
      weight: 20,
    },
    {
      label: "Summary / objective",
      done: !!cv.summary && cv.summary.length > 50,
      tip: "Add a 2–3 sentence summary that highlights your key value proposition.",
      weight: 15,
    },
    {
      label: "Work experience (2+ roles)",
      done: workHistory.length >= 2,
      tip: "Add at least two roles so hiring managers see career progression.",
      weight: 20,
    },
    {
      label: "Skills (5+ listed)",
      done: skills.length >= 5,
      tip: "List at least 5 relevant skills to improve ATS keyword matching.",
      weight: 15,
    },
    {
      label: "Education",
      done: education.length > 0,
      tip: "Add your highest degree to complete your profile.",
      weight: 10,
    },
    {
      label: "Experience level set",
      done: !!cv.experience_years && !!cv.seniority_level,
      tip: "Set your years of experience and seniority level for better job matching.",
      weight: 5,
    },
    {
      label: "Target roles added",
      done: preferredRoles.length > 0,
      tip: "Add the job titles you're targeting so the AI can discover matching jobs.",
      weight: 10,
    },
    {
      label: "Target locations added",
      done: preferredLocations.length > 0,
      tip: "Add preferred locations (or 'Remote') to filter job discovery.",
      weight: 5,
    },
  ];
}

interface ResumeCompletenessCardProps {
  cvProfile: CVProfile;
  userProfile: UserProfile;
}

export function ResumeCompletenessCard({ cvProfile, userProfile }: ResumeCompletenessCardProps) {
  const sections = buildSections(cvProfile, userProfile);
  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const earnedWeight = sections.filter((s) => s.done).reduce((sum, s) => sum + s.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  const getScoreLabel = (s: number) => {
    if (s === 100) return { label: "Complete", color: "text-success" };
    if (s >= 75) return { label: "Almost there", color: "text-info" };
    if (s >= 50) return { label: "Getting there", color: "text-warning" };
    return { label: "Needs work", color: "text-destructive" };
  };

  const { label, color } = getScoreLabel(score);
  const missing = sections.filter((s) => !s.done);

  return (
    <div className="glass-card p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Profile Completeness</h2>
          <p className="text-sm text-muted-foreground">Fill every section to maximise match quality</p>
        </div>
        <div className="text-right">
          <div className={cn("text-3xl font-bold", color)}>{score}%</div>
          <Badge variant="outline" className={cn("text-xs", color)}>{label}</Badge>
        </div>
      </div>

      <Progress value={score} className="h-2 mb-6" />

      <div className="space-y-2">
        {sections.map((s) => (
          <div key={s.label} className="flex items-start gap-3">
            {s.done ? (
              <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm", s.done ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
              {!s.done && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                  {s.tip}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {missing.length === 0 && (
        <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success text-center font-medium">
          Your profile is 100% complete — great position to start applying!
        </div>
      )}
    </div>
  );
}
