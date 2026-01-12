import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Plus, X, Sparkles } from "lucide-react";
import { useJobDiscovery } from "@/hooks/useJobDiscovery";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface JobDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", icon: "🔗" },
  { id: "indeed", label: "Indeed", icon: "📋" },
  { id: "greenhouse", label: "Greenhouse", icon: "🌱" },
  { id: "lever", label: "Lever", icon: "🎯" },
  { id: "workday", label: "Workday", icon: "📊" },
  { id: "smartrecruiters", label: "SmartRecruiters", icon: "💼" },
];

export function JobDiscoveryDialog({ open, onOpenChange }: JobDiscoveryDialogProps) {
  const { profile } = useAuth();
  const { discoverJobs, isDiscovering } = useJobDiscovery();
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["linkedin", "indeed"]);
  const [keywords, setKeywords] = useState<string[]>(profile?.preferred_roles || []);
  const [locations, setLocations] = useState<string[]>(profile?.preferred_locations || []);
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Keep dialog defaults in sync with profile once it loads.
  // (useState initializers only run on first render, so profile-loaded values won't show otherwise)
  useEffect(() => {
    if (!open) return;

    if (keywords.length === 0 && (profile?.preferred_roles?.length ?? 0) > 0) {
      setKeywords(profile!.preferred_roles);
    }

    if (locations.length === 0 && (profile?.preferred_locations?.length ?? 0) > 0) {
      setLocations(profile!.preferred_locations);
    }
  }, [open, profile, keywords.length, locations.length]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const addLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation.trim())) {
      setLocations([...locations, newLocation.trim()]);
      setNewLocation("");
    }
  };

  const removeLocation = (location: string) => {
    setLocations(locations.filter((l) => l !== location));
  };

  const handleDiscover = () => {
    if (keywords.length === 0) {
      return;
    }
    
    console.log("Starting discovery with:", { keywords, locations, platforms: selectedPlatforms });
    
    discoverJobs(
      {
        keywords,
        locations,
        platforms: selectedPlatforms,
      },
      {
        onSuccess: () => {
          console.log("Discovery completed successfully");
          onOpenChange(false);
        },
        onError: (error) => {
          console.error("Discovery failed:", error);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Discover Matching Jobs
          </DialogTitle>
          <DialogDescription>
            Search for jobs across multiple platforms that match your profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Keywords */}
          <div className="space-y-3">
            <Label>Job Keywords / Roles</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Frontend Developer"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                className="bg-secondary border-border"
              />
              <Button variant="outline" size="icon" onClick={addKeyword}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button onClick={() => removeKeyword(keyword)} aria-label={`Remove ${keyword}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Locations */}
          <div className="space-y-3">
            <Label>Preferred Locations</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Berlin, Remote"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLocation()}
                className="bg-secondary border-border"
              />
              <Button variant="outline" size="icon" onClick={addLocation}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {locations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {locations.map((location) => (
                  <Badge key={location} variant="outline" className="gap-1">
                    {location}
                    <button onClick={() => removeLocation(location)} aria-label={`Remove ${location}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>Search Platforms</Label>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border/50 transition-colors cursor-pointer",
                    selectedPlatforms.includes(platform.id) && "bg-primary/10 border-primary/30"
                  )}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <Checkbox
                    id={platform.id}
                    checked={selectedPlatforms.includes(platform.id)}
                    onCheckedChange={() => togglePlatform(platform.id)}
                  />
                  <div className="flex items-center gap-2">
                    <span>{platform.icon}</span>
                    <Label htmlFor={platform.id} className="cursor-pointer">
                      {platform.label}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDiscover}
            disabled={keywords.length === 0 || selectedPlatforms.length === 0 || isDiscovering}
          >
            {isDiscovering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Discover Jobs
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
