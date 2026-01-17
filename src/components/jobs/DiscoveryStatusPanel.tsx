import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, X, AlertTriangle, Zap } from "lucide-react";
import { DiscoveryRunStatus } from "@/hooks/useJobDiscovery";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface DiscoveryStatusPanelProps {
  lastRun: DiscoveryRunStatus | null;
  onDismiss: () => void;
}

export function DiscoveryStatusPanel({ lastRun, onDismiss }: DiscoveryStatusPanelProps) {
  if (!lastRun) return null;

  const statusConfig = {
    success: {
      icon: CheckCircle2,
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/30",
      label: "Success",
    },
    partial: {
      icon: AlertTriangle,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/30",
      label: "Partial",
    },
    error: {
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/30",
      label: "Error",
    },
  };

  const config = statusConfig[lastRun.status];
  const Icon = config.icon;

  return (
    <Card className={cn("border", config.borderColor, config.bgColor)}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Last Discovery Run
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", config.color)} />
          <Badge variant="outline" className={cn("text-xs", config.color)}>
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(lastRun.timestamp), { addSuffix: true })}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-background/50 rounded p-2">
            <p className="text-muted-foreground text-xs">Jobs Found</p>
            <p className="font-semibold">{lastRun.jobsReturned}</p>
          </div>
          <div className="bg-background/50 rounded p-2">
            <p className="text-muted-foreground text-xs">Jobs Saved</p>
            <p className="font-semibold">{lastRun.jobsSaved}</p>
          </div>
          <div className="bg-background/50 rounded p-2">
            <p className="text-muted-foreground text-xs">Duplicates</p>
            <p className="font-semibold">{lastRun.duplicatesSkipped || 0}</p>
          </div>
        </div>

        {/* Search Parameters */}
        <div className="text-xs">
          <p className="text-muted-foreground mb-1">Search Parameters:</p>
          <div className="flex flex-wrap gap-1">
            {lastRun.params.keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="text-xs">
                {kw}
              </Badge>
            ))}
            {lastRun.params.locations.slice(0, 2).map((loc) => (
              <Badge key={loc} variant="outline" className="text-xs">
                {loc}
              </Badge>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {lastRun.error && (
          <div className="bg-destructive/10 text-destructive text-xs rounded p-2 border border-destructive/20">
            <p className="font-medium mb-1">Error Details:</p>
            <p className="break-words">{lastRun.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
