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
import { Search, Loader2, Plus, X, Sparkles, Bookmark } from "lucide-react";
import { useJobDiscovery } from "@/hooks/useJobDiscovery";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  { id: "company_website", label: "Company Websites", icon: "🏢" },
];

export function JobDiscoveryDialog({ open, onOpenChange }: JobDiscoveryDialogProps) {
  const { profile } = useAuth();
  const { discoverJobs, isDiscovering } = useJobDiscovery();
  const { createSearch, isCreating } = useSavedSearches();
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["linkedin", "indeed"]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [searchName, setSearchName] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Reset state when dialog opens - start fresh, don't auto-populate from profile
  useEffect(() => {
    if (open && !initialized) {
      // Start with empty keywords - user adds what they want to search
      // Only set default location if none exist
      if (locations.length === 0) {
        setLocations(["Remote"]);
      }
      setInitialized(true);
    }
    
    // Reset initialized flag when dialog closes
    if (!open) {
      setInitialized(false);
    }
  }, [open, initialized, locations.length]);

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
      toast.error("Add at least one keyword to search for jobs");
      return;
    }
    
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform to search");
      return;
    }
    
    console.log("Starting discovery with:", { keywords, locations, platforms: selectedPlatforms });
    
    discoverJobs(
      {
        keywords,
        locations: locations.length > 0 ? locations : ["Remote"],
        platforms: selectedPlatforms,
      },
      {
        onSuccess: () => {
          console.log("Discovery completed successfully");
          onOpenChange(false);
        },
        onError: (error) => {
          console.error("Discovery failed:", error);
          toast.error(`Discovery failed: ${error.message}`);
        },
      }
    );
  };

  const handleSaveSearch = () => {
    if (keywords.length === 0) {
      toast.error("Add at least one keyword to save");
      return;
    }
    const name = searchName.trim() || keywords.slice(0, 2).join(", ");
    createSearch({
      name,
      keywords,
      locations,
      platforms: selectedPlatforms,
    });
    setSearchName("");
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
            Search for any job role across multiple platforms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Keywords */}
          <div className="space-y-3">
            <Label>Job Keywords / Roles</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Teacher, Nurse, Accountant"
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

          {/* Save Search */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <Label>Save This Search (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Search name (auto-generated if empty)"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="bg-secondary border-border"
              />
              <Button
                variant="outline"
                onClick={handleSaveSearch}
                disabled={keywords.length === 0 || isCreating}
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Save
              </Button>
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
