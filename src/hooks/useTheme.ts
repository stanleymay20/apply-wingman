import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ThemeOption = "navy" | "emerald" | "purple" | "sunset" | "midnight" | "ocean";

interface ThemeColors {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  gradientFrom: string;
  gradientTo: string;
}

export const themeOptions: Record<ThemeOption, { name: string; colors: ThemeColors }> = {
  navy: {
    name: "Navy & Orange",
    colors: {
      primary: "25 95% 53%",
      primaryForeground: "0 0% 100%",
      accent: "217 91% 60%",
      accentForeground: "0 0% 100%",
      gradientFrom: "220 30% 15%",
      gradientTo: "220 35% 8%",
    },
  },
  emerald: {
    name: "Emerald",
    colors: {
      primary: "160 84% 39%",
      primaryForeground: "0 0% 100%",
      accent: "168 76% 42%",
      accentForeground: "0 0% 100%",
      gradientFrom: "160 20% 12%",
      gradientTo: "160 25% 6%",
    },
  },
  purple: {
    name: "Purple",
    colors: {
      primary: "270 76% 60%",
      primaryForeground: "0 0% 100%",
      accent: "280 65% 55%",
      accentForeground: "0 0% 100%",
      gradientFrom: "270 25% 15%",
      gradientTo: "270 30% 8%",
    },
  },
  sunset: {
    name: "Sunset",
    colors: {
      primary: "350 89% 60%",
      primaryForeground: "0 0% 100%",
      accent: "25 95% 53%",
      accentForeground: "0 0% 100%",
      gradientFrom: "350 20% 12%",
      gradientTo: "350 25% 6%",
    },
  },
  midnight: {
    name: "Midnight",
    colors: {
      primary: "210 100% 56%",
      primaryForeground: "0 0% 100%",
      accent: "199 89% 48%",
      accentForeground: "0 0% 100%",
      gradientFrom: "222 40% 10%",
      gradientTo: "222 45% 5%",
    },
  },
  ocean: {
    name: "Ocean",
    colors: {
      primary: "187 85% 43%",
      primaryForeground: "0 0% 100%",
      accent: "174 72% 56%",
      accentForeground: "0 0% 100%",
      gradientFrom: "190 30% 12%",
      gradientTo: "190 35% 6%",
    },
  },
};

export function useTheme() {
  const { profile } = useAuth();
  const [currentTheme, setCurrentTheme] = useState<ThemeOption>("navy");

  // Load theme from profile on mount
  useEffect(() => {
    if (profile?.theme_preference) {
      const savedTheme = profile.theme_preference as ThemeOption;
      if (themeOptions[savedTheme]) {
        setCurrentTheme(savedTheme);
        applyTheme(savedTheme);
      }
    } else {
      // Check localStorage as fallback
      const stored = localStorage.getItem("theme_preference");
      if (stored && themeOptions[stored as ThemeOption]) {
        setCurrentTheme(stored as ThemeOption);
        applyTheme(stored as ThemeOption);
      }
    }
  }, [profile?.theme_preference]);

  const applyTheme = useCallback((theme: ThemeOption) => {
    const colors = themeOptions[theme].colors;
    const root = document.documentElement;

    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--primary-foreground", colors.primaryForeground);
    root.style.setProperty("--accent", colors.accent);
    root.style.setProperty("--accent-foreground", colors.accentForeground);
    root.style.setProperty("--gradient-from", colors.gradientFrom);
    root.style.setProperty("--gradient-to", colors.gradientTo);

    // Update sidebar colors
    root.style.setProperty("--sidebar-primary", colors.primary);
    root.style.setProperty("--sidebar-primary-foreground", colors.primaryForeground);
  }, []);

  const setTheme = useCallback(
    async (theme: ThemeOption) => {
      setCurrentTheme(theme);
      applyTheme(theme);
      localStorage.setItem("theme_preference", theme);

      // Save to database if user is logged in
      if (profile?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({ theme_preference: theme })
          .eq("id", profile.id);

        if (error) {
          console.error("Failed to save theme preference:", error);
        } else {
          toast.success(`Theme changed to ${themeOptions[theme].name}`);
        }
      }
    },
    [profile?.id, applyTheme]
  );

  return {
    currentTheme,
    setTheme,
    themeOptions,
  };
}
