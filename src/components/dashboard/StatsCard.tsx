import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info";
}

const variantStyles = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
};

const iconBgStyles = {
  default: "bg-secondary",
  primary: "bg-primary/20",
  success: "bg-success/20",
  warning: "bg-warning/20",
  info: "bg-info/20",
};

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = "default" 
}: StatsCardProps) {
  return (
    <div className="stat-card animate-scale-in">
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "p-3 rounded-xl",
          iconBgStyles[variant]
        )}>
          <Icon className={cn("w-6 h-6", variantStyles[variant])} />
        </div>
        {trend && (
          <span className={cn(
            "text-sm font-medium px-2 py-1 rounded-full",
            trend.isPositive 
              ? "bg-success/20 text-success" 
              : "bg-destructive/20 text-destructive"
          )}>
            {trend.isPositive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className={cn("text-3xl font-bold", variantStyles[variant])}>{value}</p>
      
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
}
