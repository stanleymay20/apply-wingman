import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Target,
  Rocket,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Upload,
  MapPin,
  Briefcase,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCVProfile } from "@/hooks/useCVProfile";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action?: {
    label: string;
    route: string;
  };
  isCompleted: boolean;
}

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ open, onOpenChange }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { cvProfile } = useCVProfile();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to ApplyPilot!",
      description: "Let's get you set up to automate your job search—any industry, any role. This quick setup takes about 2 minutes.",
      icon: Sparkles,
      isCompleted: true,
    },
    {
      id: "cv",
      title: "Upload Your Resume",
      description: "Upload your CV/resume so our AI can match you with the best opportunities and generate tailored cover letters.",
      icon: Upload,
      action: { label: "Upload Resume", route: "/profile" },
      isCompleted: !!cvProfile?.last_parsed_at,
    },
    {
      id: "preferences",
      title: "Set Job Preferences",
      description: "Tell us your preferred job titles and locations. This helps us find jobs tailored to you.",
      icon: Target,
      action: { label: "Set Preferences", route: "/settings" },
      isCompleted: (profile?.preferred_roles?.length || 0) > 0 || (profile?.preferred_locations?.length || 0) > 0,
    },
    {
      id: "discover",
      title: "Discover Jobs",
      description: "Start discovering jobs from LinkedIn, Indeed, and company career pages. Our AI will score each match.",
      icon: Briefcase,
      action: { label: "Find Jobs", route: "/jobs" },
      isCompleted: false,
    },
    {
      id: "automation",
      title: "Enable Automation",
      description: "Turn on auto-apply to let ApplyPilot handle applications for you while you focus on preparing for interviews.",
      icon: Rocket,
      action: { label: "Start Automating", route: "/" },
      isCompleted: profile?.automation_status === "running",
    },
  ];

  const completedCount = steps.filter(s => s.isCompleted).length;
  const progress = (completedCount / steps.length) * 100;

  const handleAction = (route: string) => {
    onOpenChange(false);
    navigate(route);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onOpenChange(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Save that user has seen onboarding
    localStorage.setItem("onboarding_completed", "true");
    onOpenChange(false);
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Progress indicator */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {completedCount} completed
            </span>
          </div>
          <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 py-4">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentStep
                  ? "w-8 bg-primary"
                  : index < currentStep
                    ? "bg-success"
                    : "bg-muted"
              )}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="px-6 pb-6"
          >
            <DialogHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-4 rounded-2xl bg-primary/10 w-fit">
                <currentStepData.icon className="w-10 h-10 text-primary" />
              </div>
              <DialogTitle className="text-xl flex items-center justify-center gap-2">
                {currentStepData.title}
                {currentStepData.isCompleted && currentStep > 0 && (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                )}
              </DialogTitle>
              <DialogDescription className="text-base">
                {currentStepData.description}
              </DialogDescription>
            </DialogHeader>

            {/* Action button for current step */}
            {currentStepData.action && (
              <div className="mt-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleAction(currentStepData.action!.route)}
                >
                  {currentStepData.action.label}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/30 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip tour
          </Button>

          <Button
            size="sm"
            onClick={handleNext}
          >
            {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const hasSeenOnboarding = localStorage.getItem("onboarding_completed");
      const isNewUser = !hasSeenOnboarding;
      if (isNewUser) {
        // Small delay to let the page load first
        const timer = setTimeout(() => setShowOnboarding(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const completeOnboarding = () => {
    localStorage.setItem("onboarding_completed", "true");
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem("onboarding_completed");
    setShowOnboarding(true);
  };

  return { showOnboarding, setShowOnboarding, completeOnboarding, resetOnboarding };
}
