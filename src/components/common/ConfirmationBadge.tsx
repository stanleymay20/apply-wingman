import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  detectApplicationMethod, 
  getConfirmationStatus,
  type DetectedMethod 
} from "@/lib/applicationMethods";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfirmationBadgeProps {
  sourceUrl: string;
  sourcePlatform: string;
  jobDescription?: string | null;
  applicationMethod?: string | null;
  showTooltip?: boolean;
  size?: "sm" | "default";
}

export function ConfirmationBadge({
  sourceUrl,
  sourcePlatform,
  jobDescription,
  applicationMethod,
  showTooltip = true,
  size = "default",
}: ConfirmationBadgeProps) {
  const method = detectApplicationMethod(sourceUrl, sourcePlatform, jobDescription);
  const status = getConfirmationStatus(method);
  
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const badgeSize = size === "sm" ? "text-xs px-1.5 py-0.5" : "";
  
  const Icon = status.icon === "check" 
    ? CheckCircle 
    : status.icon === "clock" 
      ? Clock 
      : AlertTriangle;
  
  const variantStyles = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    muted: "bg-muted text-muted-foreground border-border",
  };

  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1 whitespace-nowrap",
        variantStyles[status.variant],
        badgeSize
      )}
    >
      <Icon className={iconSize} />
      <span className="hidden sm:inline">{status.label}</span>
      <span className="sm:hidden">
        {status.variant === "success" ? "Expected" : "Not expected"}
      </span>
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{method.label}</p>
          <p className="text-xs text-muted-foreground">{method.description}</p>
          {applicationMethod && (
            <p className="text-xs">
              Applied via: <span className="font-medium capitalize">{applicationMethod}</span>
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface DeliveryStatusBadgeProps {
  status: "sent" | "failed" | "pending" | null;
  errorMessage?: string | null;
  size?: "sm" | "default";
}

export function DeliveryStatusBadge({ 
  status, 
  errorMessage,
  size = "default" 
}: DeliveryStatusBadgeProps) {
  if (!status) return null;
  
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const badgeSize = size === "sm" ? "text-xs px-1.5 py-0.5" : "";
  
  const config = {
    sent: {
      label: "Delivered",
      icon: CheckCircle,
      className: "bg-success/10 text-success border-success/20",
    },
    failed: {
      label: "Failed",
      icon: AlertTriangle,
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    pending: {
      label: "Pending",
      icon: Clock,
      className: "bg-warning/10 text-warning border-warning/20",
    },
  };
  
  const { label, icon: Icon, className } = config[status];

  const badge = (
    <Badge variant="outline" className={cn("gap-1", className, badgeSize)}>
      <Icon className={iconSize} />
      {label}
    </Badge>
  );

  if (!errorMessage) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs text-destructive">{errorMessage}</p>
      </TooltipContent>
    </Tooltip>
  );
}
