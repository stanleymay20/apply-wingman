import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
  fullPage?: boolean;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export const LoadingSpinner = forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ size = "md", text, className, fullPage = false }, ref) => {
    const content = (
      <div ref={ref} className={cn("flex flex-col items-center justify-center gap-3", className)}>
        <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
    );

    if (fullPage) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          {content}
        </div>
      );
    }

    return content;
  }
);

LoadingSpinner.displayName = "LoadingSpinner";
