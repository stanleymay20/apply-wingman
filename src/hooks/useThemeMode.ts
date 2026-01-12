import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ThemeMode = "light" | "dark" | "system";

export function useThemeMode() {
  const { profile } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>(() => {
    // Initialize from localStorage first for immediate render
    const stored = localStorage.getItem("theme_mode");
    if (stored && ["light", "dark", "system"].includes(stored)) {
      return stored as ThemeMode;
    }
    return "dark"; // Default to dark
  });
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("dark");

  // Resolve system preference
  const resolveSystemPreference = useCallback((): "light" | "dark" => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  }, []);

  // Apply theme to document
  const applyMode = useCallback((themeMode: ThemeMode) => {
    const effectiveMode = themeMode === "system" ? resolveSystemPreference() : themeMode;
    setResolvedMode(effectiveMode);
    
    const root = document.documentElement;
    
    if (effectiveMode === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
      
      // Apply light mode CSS variables
      root.style.setProperty("--background", "0 0% 100%");
      root.style.setProperty("--foreground", "222.2 84% 4.9%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--card-foreground", "222.2 84% 4.9%");
      root.style.setProperty("--popover", "0 0% 100%");
      root.style.setProperty("--popover-foreground", "222.2 84% 4.9%");
      root.style.setProperty("--secondary", "210 40% 96.1%");
      root.style.setProperty("--secondary-foreground", "222.2 47.4% 11.2%");
      root.style.setProperty("--muted", "210 40% 96.1%");
      root.style.setProperty("--muted-foreground", "215.4 16.3% 46.9%");
      root.style.setProperty("--border", "214.3 31.8% 91.4%");
      root.style.setProperty("--input", "214.3 31.8% 91.4%");
      root.style.setProperty("--sidebar-background", "0 0% 98%");
      root.style.setProperty("--sidebar-foreground", "222.2 47.4% 11.2%");
      root.style.setProperty("--sidebar-accent", "210 40% 96.1%");
      root.style.setProperty("--sidebar-accent-foreground", "222.2 47.4% 11.2%");
      root.style.setProperty("--sidebar-border", "214.3 31.8% 91.4%");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      
      // Apply dark mode CSS variables (original navy theme)
      root.style.setProperty("--background", "214 35% 8%");
      root.style.setProperty("--foreground", "210 40% 98%");
      root.style.setProperty("--card", "214 35% 11%");
      root.style.setProperty("--card-foreground", "210 40% 98%");
      root.style.setProperty("--popover", "214 35% 13%");
      root.style.setProperty("--popover-foreground", "210 40% 98%");
      root.style.setProperty("--secondary", "214 30% 18%");
      root.style.setProperty("--secondary-foreground", "210 40% 90%");
      root.style.setProperty("--muted", "214 30% 14%");
      root.style.setProperty("--muted-foreground", "215 20% 55%");
      root.style.setProperty("--border", "214 30% 18%");
      root.style.setProperty("--input", "214 30% 14%");
      root.style.setProperty("--sidebar-background", "214 35% 10%");
      root.style.setProperty("--sidebar-foreground", "210 40% 85%");
      root.style.setProperty("--sidebar-accent", "214 30% 16%");
      root.style.setProperty("--sidebar-accent-foreground", "210 40% 90%");
      root.style.setProperty("--sidebar-border", "214 30% 15%");
    }
  }, [resolveSystemPreference]);

  // Load mode from profile on mount
  useEffect(() => {
    // Check profile first, then localStorage
    const stored = localStorage.getItem("theme_mode");
    const initialMode = stored && ["light", "dark", "system"].includes(stored) 
      ? (stored as ThemeMode) 
      : "dark";
    
    setModeState(initialMode);
    applyMode(initialMode);
  }, [applyMode]);

  // Listen for system preference changes
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyMode("system");
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [mode, applyMode]);

  // Set new mode
  const setMode = useCallback(
    async (newMode: ThemeMode) => {
      setModeState(newMode);
      applyMode(newMode);
      localStorage.setItem("theme_mode", newMode);

      // Save to database if user is logged in
      if (profile?.id) {
        try {
          // We'll store this in theme_preference with a mode prefix
          await supabase
            .from("profiles")
            .update({ theme_preference: `mode:${newMode}` })
            .eq("id", profile.id);
        } catch (error) {
          console.error("Failed to save theme mode:", error);
        }
      }

      const modeLabels: Record<ThemeMode, string> = {
        light: "Light",
        dark: "Dark",
        system: "System",
      };
      toast.success(`Theme set to ${modeLabels[newMode]}`);
    },
    [profile?.id, applyMode]
  );

  return {
    mode,
    resolvedMode,
    setMode,
    isDark: resolvedMode === "dark",
    isLight: resolvedMode === "light",
    isSystem: mode === "system",
  };
}
