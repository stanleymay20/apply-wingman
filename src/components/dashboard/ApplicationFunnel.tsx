import { cn } from "@/lib/utils";

interface FunnelStage {
  label: string;
  count: number;
  color: string;
}

const funnelData: FunnelStage[] = [
  { label: "Jobs Scanned", count: 2847, color: "bg-info" },
  { label: "Matched (70%+)", count: 423, color: "bg-primary" },
  { label: "Applied", count: 312, color: "bg-success" },
  { label: "Interview", count: 28, color: "bg-warning" },
  { label: "Offer", count: 3, color: "bg-gradient-to-r from-primary to-info" },
];

export function ApplicationFunnel() {
  const maxCount = funnelData[0].count;

  return (
    <div className="glass-card p-6 animate-scale-in">
      <h3 className="text-lg font-semibold text-foreground mb-6">Application Funnel</h3>
      
      <div className="space-y-4">
        {funnelData.map((stage, index) => {
          const percentage = (stage.count / maxCount) * 100;
          const conversionRate = index > 0 
            ? ((stage.count / funnelData[index - 1].count) * 100).toFixed(1)
            : null;

          return (
            <div key={stage.label} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{stage.label}</span>
                <div className="flex items-center gap-2">
                  {conversionRate && (
                    <span className="text-xs text-muted-foreground">
                      {conversionRate}% conv.
                    </span>
                  )}
                  <span className="text-sm font-bold text-foreground">{stage.count.toLocaleString()}</span>
                </div>
              </div>
              <div className="relative h-8 bg-secondary rounded-lg overflow-hidden">
                <div 
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-3",
                    stage.color
                  )}
                  style={{ width: `${Math.max(percentage, 5)}%` }}
                >
                  {percentage > 15 && (
                    <span className="text-xs font-medium text-white/90">
                      {percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall Conversion</span>
          <span className="font-bold text-gradient">
            {((funnelData[funnelData.length - 1].count / funnelData[0].count) * 100).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
