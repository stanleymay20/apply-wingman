import { useState } from "react";
import { Plus, Check, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CVProfile {
  id: string;
  profile_name: string;
  is_active: boolean;
  skills: string[];
  experience_years: number | null;
  last_parsed_at: string | null;
}

interface CVProfileSelectorProps {
  profiles: CVProfile[];
  activeProfileId: string | null;
  onProfileChange: (id: string) => void;
  onRefresh: () => void;
}

export function CVProfileSelector({
  profiles,
  activeProfileId,
  onProfileChange,
  onRefresh,
}: CVProfileSelectorProps) {
  const { user } = useAuth();
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async () => {
    if (!user || !newProfileName.trim()) return;

    setIsCreating(true);
    try {
      const { error } = await supabase.from("cv_profiles").insert({
        user_id: user.id,
        profile_name: newProfileName.trim(),
        is_active: profiles.length === 0,
      });

      if (error) throw error;

      toast.success("Profile created");
      setNewProfileName("");
      setDialogOpen(false);
      onRefresh();
    } catch (error) {
      toast.error("Failed to create profile");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSetActive = async (id: string) => {
    if (!user) return;

    try {
      // Set all profiles inactive
      await supabase
        .from("cv_profiles")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Set selected profile active
      await supabase
        .from("cv_profiles")
        .update({ is_active: true })
        .eq("id", id);

      onProfileChange(id);
      onRefresh();
      toast.success("Active profile changed");
    } catch (error) {
      toast.error("Failed to change profile");
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;

    try {
      await supabase
        .from("cv_profiles")
        .update({ profile_name: editName.trim() })
        .eq("id", id);

      setEditingId(null);
      onRefresh();
      toast.success("Profile renamed");
    } catch (error) {
      toast.error("Failed to rename profile");
    }
  };

  const handleDelete = async (id: string) => {
    if (profiles.length <= 1) {
      toast.error("Cannot delete the only profile");
      return;
    }

    try {
      await supabase.from("cv_profiles").delete().eq("id", id);

      // If deleted profile was active, set another as active
      if (id === activeProfileId && profiles.length > 1) {
        const remaining = profiles.find((p) => p.id !== id);
        if (remaining) {
          await supabase
            .from("cv_profiles")
            .update({ is_active: true })
            .eq("id", remaining.id);
        }
      }

      onRefresh();
      toast.success("Profile deleted");
    } catch (error) {
      toast.error("Failed to delete profile");
    }
  };

  if (profiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
            profile.is_active
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 cursor-pointer"
          )}
          onClick={() => !profile.is_active && handleSetActive(profile.id)}
        >
          {editingId === profile.id ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(profile.id)}
              onKeyDown={(e) => e.key === "Enter" && handleRename(profile.id)}
              className="h-6 w-24 text-sm"
              autoFocus
            />
          ) : (
            <span className="text-sm font-medium">
              {profile.profile_name || "Default"}
            </span>
          )}

          {profile.is_active && (
            <Check className="w-4 h-4 text-primary" />
          )}

          {profile.skills?.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {profile.skills.length} skills
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(profile.id);
                  setEditName(profile.profile_name || "");
                }}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(profile.id);
                }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Profile
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Resume Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Input
                placeholder="Profile name (e.g., Frontend, Backend)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newProfileName.trim()}
              className="w-full"
            >
              {isCreating ? "Creating..." : "Create Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
