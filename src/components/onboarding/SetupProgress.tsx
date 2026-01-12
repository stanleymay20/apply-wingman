import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  FileText,
  Target,
  Settings,
  Rocket,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCVProfile } from "@/hooks/useCVProfile";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  isCompleted: boolean;
}

export function SetupProgress() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { cvProfile } = useCVProfile();

  const steps: SetupStep[] = useMemo(() => [
    {
      id: "cv",
      title: "Upload resume",
      description: "Parse your CV for AI matching",
      icon: FileText,
      route: "/profile",
      isCompleted: !!cvProfile?.last_parsed_at,
    },
    {
      id: "roles",
      title: "Set job preferences",
      description: "Add preferred roles & locations",
      icon: Target,
      route: "/profile",
      isCompleted: (profile?.preferred_roles?.length || 0) > 0,
    },
    {
      id: "settings",
      title: "Configure automation",
      description: "Set daily cap & match threshold",
      icon: Settings,
      route: "/settings",
      isCompleted: (profile?.daily_application_cap || 0) > 0 && (profile?.minimum_fit_score || 0) > 0,
    },
    {
      id: "automation",
      title: "Start automating",
      description: "Enable auto-apply",
      icon: Rocket,
      route: "/",
      isCompleted: profile?.automation_status === "running",
    },
  ], [cvProfile, profile]);

  const completedCount = steps.filter(s => s.isCompleted).length;
  const progress = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;
  const nextStep = steps.find(s => !s.isCompleted);

  if (allComplete) {
    return null;
  }

  return (
    <div className="glass-card p-6 mb-6 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Complete Your Setup</h3>
            <p className="text-sm text-muted-foreground">
              {completedCount} of {steps.length} steps completed
            </p>
          </div>
        </div>
        <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
      </div>

      <Progress value={progress} className="h-2 mb-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((step, index) => {
          const Icon = step.isCompleted ? CheckCircle2 : step.icon;
          const isNext = nextStep?.id === step.id;

          return (
            <button
              key={step.id}
              onClick={() => navigate(step.route)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                step.isCompleted
                  ? "bg-success/10 border-success/30"
                  : isNext
                    ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20"
                    : "bg-muted/50 border-border hover:border-primary/30"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg",
                step.isCompleted ? "bg-success/20" : isNext ? "bg-primary/20" : "bg-muted"
              )}>
                <Icon className={cn(
                  "w-4 h-4",
                  step.isCompleted ? "text-success" : isNext ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  step.isCompleted ? "text-success" : "text-foreground"
                )}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {step.description}
                </p>
              </div>
              {isNext && (
                <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {nextStep && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => navigate(nextStep.route)} size="sm">
            Continue: {nextStep.title}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
