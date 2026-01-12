import { cn } from "@/lib/utils";

interface QuotaProgressProps {
  current: number;
  max: number;
  label?: string;
}

export function QuotaProgress({ current, max, label }: QuotaProgressProps) {
  const percentage = Math.min((current / max) * 100, 100);
  const remaining = max - current;
  
  const getColor = () => {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-warning";
    return "bg-primary";
  };

  const getGlow = () => {
    if (percentage >= 90) return "shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.5)]";
    if (percentage >= 70) return "shadow-[0_0_20px_-5px_hsl(var(--warning)/0.5)]";
    return "shadow-glow";
  };

  return (
    <div className="glass-card p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            {label || "Daily Application Quota"}
          </h3>
          <p className="text-2xl font-bold text-foreground mt-1">
            {current} <span className="text-muted-foreground text-lg font-normal">/ {max}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gradient">{remaining}</p>
          <p className="text-sm text-muted-foreground">remaining</p>
        </div>
      </div>
      
      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
            getColor(),
            getGlow()
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>0</span>
        <span>{Math.round(max / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
