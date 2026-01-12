import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeatureHighlightProps {
  id: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: "top" | "bottom";
  className?: string;
  children: React.ReactNode;
}

export function FeatureHighlight({
  id,
  title,
  description,
  action,
  position = "bottom",
  className,
  children,
}: FeatureHighlightProps) {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `feature_highlight_${id}`;

  useEffect(() => {
    const hasSeen = localStorage.getItem(storageKey);
    if (!hasSeen) {
      // Delay showing the highlight
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setIsVisible(false);
  };

  const handleAction = () => {
    handleDismiss();
    action?.onClick();
  };

  return (
    <div className={cn("relative", className)}>
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: position === "bottom" ? -10 : 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position === "bottom" ? -10 : 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute z-50 w-72",
              position === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
              "left-1/2 -translate-x-1/2"
            )}
          >
            <div className="bg-primary text-primary-foreground rounded-lg p-4 shadow-lg">
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 hover:bg-primary-foreground/10 rounded"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-primary-foreground/20 rounded">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 pr-4">
                  <h4 className="font-semibold text-sm mb-1">{title}</h4>
                  <p className="text-xs opacity-90 mb-3">{description}</p>
                  {action && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleAction}
                      className="h-7 text-xs"
                    >
                      {action.label}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
              {/* Arrow */}
              <div
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45",
                  position === "bottom" ? "-top-1.5" : "-bottom-1.5"
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
