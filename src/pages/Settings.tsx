import { useState, useEffect, useCallback } from "react";
import { 
  Bell, 
  Shield, 
  Sliders,
  Mail,
  Globe,
  AlertTriangle,
  Save,
  Loader2,
  Plus,
  X,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { profileSettingsSchema, domainSchema, nameSchema } from "@/lib/validation";

export default function Settings() {
  const { profile, refreshProfile, signOut, loading } = useAuth();
  const queryClient = useQueryClient();
  
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    daily_application_cap: 50,
    minimum_fit_score: 70,
    notifications_enabled: true,
    email_notifications: true,
    manual_approval_mode: false,
    full_name: "",
    email: "",
  });
  const [newBlacklistDomain, setNewBlacklistDomain] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setSettings({
        daily_application_cap: profile.daily_application_cap ?? 50,
        minimum_fit_score: profile.minimum_fit_score ?? 70,
        notifications_enabled: profile.notifications_enabled ?? true,
        email_notifications: profile.email_notifications ?? true,
        manual_approval_mode: profile.manual_approval_mode ?? false,
        full_name: profile.full_name || "",
        email: profile.email,
      });
    }
  }, [profile]);

  const { data: blacklist = [], isLoading: blacklistLoading } = useQuery({
    queryKey: ["blacklist", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("platform_blacklist")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  const saveSettings = useCallback(async () => {
    if (!profile) return;
    
    // Validate settings
    const validation = profileSettingsSchema.safeParse(settings);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        newErrors[field] = err.message;
      });
      setErrors(newErrors);
      toast.error("Please fix the validation errors");
      return;
    }
    
    // Validate name separately if provided
    if (settings.full_name) {
      const nameValidation = nameSchema.safeParse(settings.full_name);
      if (!nameValidation.success) {
        const errorMsg = nameValidation.error.errors[0]?.message || "Invalid name";
        setErrors({ full_name: errorMsg });
        toast.error(errorMsg);
        return;
      }
    }
    
    setErrors({});
    setIsSaving(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({
        daily_application_cap: settings.daily_application_cap,
        minimum_fit_score: settings.minimum_fit_score,
        notifications_enabled: settings.notifications_enabled,
        email_notifications: settings.email_notifications,
        manual_approval_mode: settings.manual_approval_mode,
        full_name: settings.full_name || null,
      })
      .eq("id", profile.id);

    setIsSaving(false);
    
    if (error) {
      toast.error("Failed to save settings");
    } else {
      await refreshProfile();
      toast.success("Settings saved successfully");
    }
  }, [profile, settings, refreshProfile]);

  const addToBlacklist = useMutation({
    mutationFn: async (domain: string) => {
      if (!profile) throw new Error("Not authenticated");
      
      // Validate domain
      const validation = domainSchema.safeParse(domain.toLowerCase().trim());
      if (!validation.success) {
        throw new Error(validation.error.errors[0]?.message || "Invalid domain");
      }
      
      // Check for duplicates
      const exists = blacklist.some(item => 
        item.domain.toLowerCase() === validation.data.toLowerCase()
      );
      if (exists) {
        throw new Error("Domain already in blacklist");
      }
      
      const { error } = await supabase
        .from("platform_blacklist")
        .insert({ user_id: profile.id, domain: validation.data });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      setNewBlacklistDomain("");
      setErrors({});
      toast.success("Domain added to blacklist");
    },
    onError: (error: Error) => {
      setErrors({ blacklist: error.message });
      toast.error(error.message);
    },
  });

  const removeFromBlacklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("platform_blacklist")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blacklist"] });
      toast.success("Domain removed from blacklist");
    },
    onError: () => {
      toast.error("Failed to remove domain");
    },
  });

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  if (loading) {
    return <LoadingSpinner fullPage text="Loading settings..." />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your automation preferences and safety controls
        </p>
      </div>

      {/* Account Settings */}
      <div className="glass-card p-6 mb-6 animate-scale-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-info/20">
            <User className="w-5 h-5 text-info" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Account</h2>
            <p className="text-sm text-muted-foreground">Your account information</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Full Name</Label>
            <Input
              value={settings.full_name}
              onChange={(e) => {
                setSettings({ ...settings, full_name: e.target.value });
                if (errors.full_name) setErrors({ ...errors, full_name: "" });
              }}
              className={`bg-secondary border-border mt-1 ${errors.full_name ? "border-destructive" : ""}`}
              maxLength={100}
              placeholder="Enter your full name"
            />
            {errors.full_name && (
              <p className="text-xs text-destructive mt-1">{errors.full_name}</p>
            )}
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={settings.email}
              disabled
              className="bg-secondary/50 border-border mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
          </div>
        </div>
      </div>

      {/* Application Settings */}
      <div className="glass-card p-6 mb-6 animate-scale-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/20">
            <Sliders className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Application Settings</h2>
            <p className="text-sm text-muted-foreground">Control how jobs are matched and applied</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Daily Cap */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-foreground">Daily Application Cap</Label>
                <p className="text-sm text-muted-foreground">Maximum applications per day (10-100)</p>
              </div>
              <span className="text-2xl font-bold text-primary">{settings.daily_application_cap}</span>
            </div>
            <Slider
              value={[settings.daily_application_cap]}
              onValueChange={([value]) => setSettings({ ...settings, daily_application_cap: value })}
              max={100}
              min={10}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>10</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {/* Min Match Score */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-foreground">Minimum Match Score</Label>
                <p className="text-sm text-muted-foreground">Only apply to jobs above this threshold (50-95%)</p>
              </div>
              <span className="text-2xl font-bold text-primary">{settings.minimum_fit_score}%</span>
            </div>
            <Slider
              value={[settings.minimum_fit_score]}
              onValueChange={([value]) => setSettings({ ...settings, minimum_fit_score: value })}
              max={95}
              min={50}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>50%</span>
              <span>70%</span>
              <span>95%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="glass-card p-6 mb-6 animate-scale-in" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-info/20">
            <Bell className="w-5 h-5 text-info" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
            <p className="text-sm text-muted-foreground">Manage how you receive updates</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">In-App Notifications</p>
                <p className="text-sm text-muted-foreground">Show notifications in the app</p>
              </div>
            </div>
            <Switch 
              checked={settings.notifications_enabled} 
              onCheckedChange={(checked) => setSettings({ ...settings, notifications_enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
            </div>
            <Switch 
              checked={settings.email_notifications} 
              onCheckedChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
            />
          </div>
        </div>
      </div>

      {/* Safety Controls */}
      <div className="glass-card p-6 mb-6 animate-scale-in" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-warning/20">
            <Shield className="w-5 h-5 text-warning" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Safety Controls</h2>
            <p className="text-sm text-muted-foreground">Protect against unwanted behavior</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
            <div>
              <p className="font-medium text-foreground">Manual Approval Mode</p>
              <p className="text-sm text-muted-foreground">Review each application before sending</p>
            </div>
            <Switch 
              checked={settings.manual_approval_mode} 
              onCheckedChange={(checked) => setSettings({ ...settings, manual_approval_mode: checked })}
            />
          </div>

          <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
            <Label className="text-foreground mb-2 block">Platform Blacklist</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Companies or domains to never apply to
            </p>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input 
                  placeholder="example.com"
                  value={newBlacklistDomain}
                  onChange={(e) => {
                    setNewBlacklistDomain(e.target.value);
                    if (errors.blacklist) setErrors({ ...errors, blacklist: "" });
                  }}
                  onKeyDown={(e) => e.key === "Enter" && newBlacklistDomain && addToBlacklist.mutate(newBlacklistDomain)}
                  className={`bg-secondary border-border ${errors.blacklist ? "border-destructive" : ""}`}
                  maxLength={255}
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => newBlacklistDomain && addToBlacklist.mutate(newBlacklistDomain)}
                  disabled={addToBlacklist.isPending}
                  aria-label="Add to blacklist"
                >
                  {addToBlacklist.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {errors.blacklist && (
                <p className="text-xs text-destructive">{errors.blacklist}</p>
              )}
            </div>

            {blacklistLoading ? (
              <LoadingSpinner size="sm" className="mt-4" />
            ) : blacklist.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-4">
                {blacklist.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-1 px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm"
                  >
                    {item.domain}
                    <button 
                      onClick={() => removeFromBlacklist.mutate(item.id)}
                      disabled={removeFromBlacklist.isPending}
                      aria-label={`Remove ${item.domain}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="font-medium text-destructive">Danger Zone</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Sign out of your account
            </p>
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Job Sources */}
      <div className="glass-card p-6 mb-6 animate-scale-in" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-success/20">
            <Globe className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Job Sources</h2>
            <p className="text-sm text-muted-foreground">Platforms we scan for jobs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: "LinkedIn", icon: "🔗", supported: true },
            { name: "Indeed", icon: "📋", supported: true },
            { name: "Greenhouse", icon: "🌱", supported: true },
            { name: "Lever", icon: "🎯", supported: true },
            { name: "Company Career Pages", icon: "🏢", supported: true },
            { name: "Email Alerts", icon: "📧", supported: false },
          ].map((source) => (
            <div 
              key={source.name}
              className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" role="img" aria-label={source.name}>{source.icon}</span>
                <span className="font-medium text-foreground">{source.name}</span>
              </div>
              <div className={`flex items-center gap-2 ${source.supported ? "text-success" : "text-muted-foreground"}`}>
                <div className={`w-2 h-2 rounded-full ${source.supported ? "bg-success" : "bg-muted-foreground"}`} />
                <span className="text-sm">{source.supported ? "Supported" : "Coming soon"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end animate-fade-in">
        <Button size="lg" onClick={saveSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
