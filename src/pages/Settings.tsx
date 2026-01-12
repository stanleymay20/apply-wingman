import { useState } from "react";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Sliders,
  Mail,
  Globe,
  Clock,
  AlertTriangle,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  const [dailyCap, setDailyCap] = useState([50]);
  const [minMatchScore, setMinMatchScore] = useState([70]);
  const [manualApproval, setManualApproval] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [instantAlerts, setInstantAlerts] = useState(true);
  const [dailySummary, setDailySummary] = useState(true);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your automation preferences and safety controls
        </p>
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
                <p className="text-sm text-muted-foreground">Maximum applications per day</p>
              </div>
              <span className="text-2xl font-bold text-primary">{dailyCap[0]}</span>
            </div>
            <Slider
              value={dailyCap}
              onValueChange={setDailyCap}
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
                <p className="text-sm text-muted-foreground">Only apply to jobs above this threshold</p>
              </div>
              <span className="text-2xl font-bold text-primary">{minMatchScore[0]}%</span>
            </div>
            <Slider
              value={minMatchScore}
              onValueChange={setMinMatchScore}
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

          {/* Scan Interval */}
          <div>
            <Label className="text-foreground mb-2 block">Scan Interval</Label>
            <Select defaultValue="30">
              <SelectTrigger className="w-full bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Every 15 minutes</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
                <SelectItem value="120">Every 2 hours</SelectItem>
              </SelectContent>
            </Select>
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

        <div className="space-y-6">
          <div>
            <Label className="text-foreground mb-2 block">Email Address</Label>
            <Input 
              type="email" 
              defaultValue="user@example.com"
              className="bg-secondary border-border"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Instant Alerts</p>
                  <p className="text-sm text-muted-foreground">Interviews, rejections, and errors</p>
                </div>
              </div>
              <Switch checked={instantAlerts} onCheckedChange={setInstantAlerts} />
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Daily Summary</p>
                  <p className="text-sm text-muted-foreground">End-of-day application report</p>
                </div>
              </div>
              <Switch checked={dailySummary} onCheckedChange={setDailySummary} />
            </div>
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
            <Switch checked={manualApproval} onCheckedChange={setManualApproval} />
          </div>

          <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
            <Label className="text-foreground mb-2 block">Platform Blacklist</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Companies or platforms to never apply to
            </p>
            <Input 
              placeholder="Add company or domain..."
              className="bg-secondary border-border"
            />
          </div>

          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="font-medium text-destructive">Danger Zone</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Clear all data and reset automation settings
            </p>
            <Button variant="destructive" size="sm">
              Reset All Settings
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
            <p className="text-sm text-muted-foreground">Configure where to scan for jobs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: "LinkedIn", connected: true, icon: "🔗" },
            { name: "Indeed", connected: true, icon: "📋" },
            { name: "Greenhouse", connected: true, icon: "🌱" },
            { name: "Lever", connected: false, icon: "🎯" },
            { name: "Gmail (Job Alerts)", connected: true, icon: "📧" },
            { name: "Custom Career Pages", connected: false, icon: "🏢" },
          ].map((source) => (
            <div 
              key={source.name}
              className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{source.icon}</span>
                <span className="font-medium text-foreground">{source.name}</span>
              </div>
              <div className={`flex items-center gap-2 ${source.connected ? "text-success" : "text-muted-foreground"}`}>
                <div className={`w-2 h-2 rounded-full ${source.connected ? "bg-success" : "bg-muted-foreground"}`} />
                <span className="text-sm">{source.connected ? "Connected" : "Not connected"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end animate-fade-in">
        <Button size="lg">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
