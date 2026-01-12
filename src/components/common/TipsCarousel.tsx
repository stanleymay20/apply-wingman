import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lightbulb, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Target,
  Rocket,
  FileText,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Tip {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const tips: Tip[] = [
  {
    id: "cv",
    title: "Upload Your Resume",
    description: "AI-powered matching works best with a detailed resume. Include skills, experience, and achievements.",
    icon: FileText,
  },
  {
    id: "match",
    title: "Check Match Scores",
    description: "Each job gets a match score based on your profile. Focus on 70%+ matches for best results.",
    icon: Target,
  },
  {
    id: "automation",
    title: "Set Daily Limits",
    description: "Use the daily cap to control how many applications are sent. Start with 20-30 per day.",
    icon: Rocket,
  },
  {
    id: "analytics",
    title: "Track Your Progress",
    description: "Check Analytics to see your application trends, response rates, and optimize your strategy.",
    icon: BarChart2,
  },
  {
    id: "discover",
    title: "Save Your Searches",
    description: "Create saved searches to automatically discover new jobs matching your criteria.",
    icon: Sparkles,
  },
];

interface TipsCarouselProps {
  className?: string;
}

export function TipsCarousel({ className }: TipsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    const hasDismissed = localStorage.getItem("tips_dismissed");
    if (hasDismissed) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (!autoPlay || dismissed) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [autoPlay, dismissed]);

  const handleDismiss = () => {
    localStorage.setItem("tips_dismissed", "true");
    setDismissed(true);
  };

  const handlePrevious = () => {
    setAutoPlay(false);
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const handleNext = () => {
    setAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  if (dismissed) return null;

  const currentTip = tips[currentIndex];
  const Icon = currentTip.icon;

  return (
    <div className={cn(
      "glass-card p-4 relative overflow-hidden",
      className
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
        aria-label="Dismiss tips"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-info/20 flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-info" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentTip.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0 pr-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-foreground" />
              <h4 className="text-sm font-semibold text-foreground">
                {currentTip.title}
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              {currentTip.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <div className="flex gap-1">
          {tips.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setAutoPlay(false);
                setCurrentIndex(index);
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === currentIndex ? "w-4 bg-primary" : "bg-muted"
              )}
              aria-label={`Go to tip ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handlePrevious}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleNext}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
