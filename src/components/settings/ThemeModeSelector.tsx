import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useThemeMode, ThemeMode } from "@/hooks/useThemeMode";

const modeOptions: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Bright theme for daytime use",
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
    description: "Easy on the eyes at night",
  },
  {
    value: "system",
    label: "System",
    icon: Monitor,
    description: "Follow your OS preference",
  },
];

export function ThemeModeSelector() {
  const { mode, setMode, resolvedMode } = useThemeMode();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how ApplyPilot looks. Currently using {resolvedMode} mode.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = mode === option.value;
            
            return (
              <Button
                key={option.value}
                variant="outline"
                className={cn(
                  "h-auto py-6 flex flex-col items-center gap-3 transition-all",
                  isSelected && "border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                onClick={() => setMode(option.value)}
              >
                <Icon className={cn(
                  "w-8 h-8",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="text-center">
                  <p className={cn(
                    "font-medium",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
