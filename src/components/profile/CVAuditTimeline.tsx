import { format, formatDistanceToNow } from "date-fns";
import { 
  FileText, 
  Sparkles, 
  Target, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Zap,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCVAuditLog, type CVAuditEntry } from "@/hooks/useCVAuditLog";
import { cn } from "@/lib/utils";

interface CVAuditTimelineProps {
  cvProfileId?: string;
}

const getActionIcon = (action: string) => {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes("parse") || actionLower.includes("upload")) {
    return Upload;
  }
  if (actionLower.includes("optim")) {
    return Sparkles;
  }
  if (actionLower.includes("score")) {
    return Target;
  }
  if (actionLower.includes("apply") || actionLower.includes("submit")) {
    return Zap;
  }
  if (actionLower.includes("update") || actionLower.includes("refresh")) {
    return RefreshCw;
  }
  
  return FileText;
};

const getActionColor = (action: string, level: string) => {
  if (level === "error") return "text-destructive";
  if (level === "warn" || level === "warning") return "text-warning";
  
  const actionLower = action.toLowerCase();
  if (actionLower.includes("optim")) return "text-primary";
  if (actionLower.includes("score")) return "text-accent-foreground";
  if (actionLower.includes("apply")) return "text-success";
  
  return "text-muted-foreground";
};

const getLevelBadge = (level: string) => {
  switch (level) {
    case "error":
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    case "warn":
    case "warning":
      return <Badge variant="outline" className="text-xs border-warning text-warning">Warning</Badge>;
    case "success":
      return <Badge variant="outline" className="text-xs border-success text-success">Success</Badge>;
    default:
      return null;
  }
};

function AuditEntry({ entry }: { entry: CVAuditEntry }) {
  const Icon = getActionIcon(entry.action);
  const colorClass = getActionColor(entry.action, entry.level);
  const timestamp = new Date(entry.created_at);
  
  const details = entry.details as Record<string, unknown> | null;
  const score = details?.score as number | undefined;
  const previousScore = details?.previous_score as number | undefined;
  const iteration = details?.iteration as number | undefined;

  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={cn("p-2 rounded-full bg-muted", colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      
      <div className="flex-1 space-y-1 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{entry.message}</p>
          {getLevelBadge(entry.level)}
        </div>
        
        {(score !== undefined || iteration !== undefined) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {score !== undefined && (
              <span className="text-muted-foreground">
                Score: <span className="font-medium text-foreground">{score}%</span>
                {previousScore !== undefined && previousScore !== score && (
                  <span className={score > previousScore ? "text-success" : "text-destructive"}>
                    {" "}({score > previousScore ? "+" : ""}{score - previousScore}%)
                  </span>
                )}
              </span>
            )}
            {iteration !== undefined && (
              <span className="text-muted-foreground">
                Iteration: <span className="font-medium text-foreground">{iteration}</span>
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span title={format(timestamp, "PPpp")}>
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CVAuditTimeline({ cvProfileId }: CVAuditTimelineProps) {
  const { auditLog, isLoading } = useCVAuditLog(cvProfileId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            CV Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (auditLog.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            CV Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity recorded yet</p>
            <p className="text-xs">Upload and optimize your CV to see history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          CV Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-0">
            {auditLog.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
