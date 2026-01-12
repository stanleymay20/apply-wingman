import { forwardRef } from "react";
import { useTheme, ThemeOption, themeOptions } from "@/hooks/useTheme";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const ThemeSelector = forwardRef<HTMLDivElement, object>((_props, ref) => {
  const { currentTheme, setTheme } = useTheme();

  return (
    <div ref={ref} className="space-y-4">
      <Label className="text-foreground">Theme</Label>
      <p className="text-sm text-muted-foreground mb-4">
        Choose your preferred color scheme
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {(Object.entries(themeOptions) as [ThemeOption, typeof themeOptions[ThemeOption]][]).map(
          ([key, theme]) => {
            const isSelected = currentTheme === key;
            const colors = theme.colors;

            return (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={cn(
                  "relative p-4 rounded-xl border-2 transition-all text-left",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border/50 hover:border-primary/50"
                )}
                aria-label={`Select ${theme.name} theme`}
              >
                {/* Color preview */}
                <div className="flex gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: `hsl(${colors.primary})` }}
                  />
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: `hsl(${colors.accent})` }}
                  />
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, hsl(${colors.gradientFrom}), hsl(${colors.gradientTo}))`,
                    }}
                  />
                </div>

                <p className="font-medium text-foreground">{theme.name}</p>

                {isSelected && (
                  <div className="absolute top-2 right-2 text-primary">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                )}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
});

ThemeSelector.displayName = "ThemeSelector";
