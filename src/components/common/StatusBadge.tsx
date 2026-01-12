import { cn } from "@/lib/utils";

type Status = "applied" | "interview" | "rejected" | "pending";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  applied: {
    label: "Applied",
    className: "status-applied",
  },
  interview: {
    label: "Interview",
    className: "status-interview",
  },
  rejected: {
    label: "Rejected",
    className: "status-rejected",
  },
  pending: {
    label: "Pending",
    className: "status-pending",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
