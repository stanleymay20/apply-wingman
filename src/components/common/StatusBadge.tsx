import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Status = 
  | "applied" 
  | "submitted" 
  | "interview" 
  | "rejected" 
  | "pending" 
  | "offer" 
  | "withdrawn"
  | "in_progress"
  | "failed"
  | "matched"
  | "new";

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  applied: {
    label: "Applied",
    className: "bg-info/20 text-info border border-info/30",
  },
  submitted: {
    label: "Submitted",
    className: "bg-info/20 text-info border border-info/30",
  },
  interview: {
    label: "Interview",
    className: "bg-success/20 text-success border border-success/30",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive/20 text-destructive border border-destructive/30",
  },
  pending: {
    label: "Pending",
    className: "bg-warning/20 text-warning border border-warning/30",
  },
  offer: {
    label: "Offer",
    className: "bg-gradient-to-r from-primary/20 to-success/20 text-success border border-success/30",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "bg-muted text-muted-foreground border border-border",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-primary/20 text-primary border border-primary/30",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/20 text-destructive border border-destructive/30",
  },
  matched: {
    label: "Matched",
    className: "bg-primary/20 text-primary border border-primary/30",
  },
  new: {
    label: "New",
    className: "bg-info/20 text-info border border-info/30",
  },
};

const defaultConfig = {
  label: "Unknown",
  className: "bg-muted text-muted-foreground border border-border",
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className }, ref) => {
    const normalizedStatus = status?.toLowerCase().replace(/\s+/g, "_") || "unknown";
    const config = statusConfig[normalizedStatus] || {
      ...defaultConfig,
      label: status || "Unknown",
    };
    
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
          config.className,
          className
        )}
      >
        {config.label}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
