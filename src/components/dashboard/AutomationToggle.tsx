import { useState } from "react";
import { Power, Pause, Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AutomationStatus = "running" | "paused" | "stopped";

export function AutomationToggle() {
  const [status, setStatus] = useState<AutomationStatus>("running");

  const statusConfig = {
    running: {
      label: "Running",
      description: "Scanning and applying to jobs",
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
      icon: <div className="pulse-dot" />,
    },
    paused: {
      label: "Paused",
      description: "Automation temporarily stopped",
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/30",
      icon: <Pause className="w-4 h-4 text-warning" />,
    },
    stopped: {
      label: "Stopped",
      description: "Emergency stop activated",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
    },
  };

  const config = statusConfig[status];

  const toggleStatus = () => {
    if (status === "running") setStatus("paused");
    else if (status === "paused") setStatus("running");
    else setStatus("running");
  };

  const emergencyStop = () => {
    setStatus("stopped");
  };

  return (
    <div className="glass-card p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Automation Control</h3>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
          config.bg,
          config.border,
          "border"
        )}>
          {config.icon}
          <span className={config.color}>{config.label}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-6">{config.description}</p>

      <div className="flex gap-3">
        <Button
          onClick={toggleStatus}
          variant={status === "running" ? "outline" : "default"}
          className="flex-1"
        >
          {status === "running" ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Resume
            </>
          )}
        </Button>
        
        <Button
          onClick={emergencyStop}
          variant="destructive"
          size="icon"
          disabled={status === "stopped"}
          title="Emergency Stop"
        >
          <Power className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
