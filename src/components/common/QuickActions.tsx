import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Send,
  Settings,
  BarChart2,
  Search,
  Sparkles,
  Plus,
  Play,
  Pause,
  Upload,
  HelpCircle,
  Moon,
  Sun,
  Keyboard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface QuickActionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickActions({ open, onOpenChange }: QuickActionsProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const runCommand = useCallback((command: () => void) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search commands, pages, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/jobs"))}>
            <Briefcase className="mr-2 h-4 w-4" />
            Jobs
            <CommandShortcut>⌘J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/applications"))}>
            <Send className="mr-2 h-4 w-4" />
            Applications
            <CommandShortcut>⌘A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/profile"))}>
            <FileText className="mr-2 h-4 w-4" />
            Profile
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/analytics"))}>
            <BarChart2 className="mr-2 h-4 w-4" />
            Analytics
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => {
            navigate("/jobs");
            // Trigger discover dialog via custom event
            setTimeout(() => window.dispatchEvent(new CustomEvent("open-job-discovery")), 100);
          })}>
            <Search className="mr-2 h-4 w-4" />
            Discover new jobs
            <CommandShortcut>⌘⇧F</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {
            navigate("/profile");
          })}>
            <Upload className="mr-2 h-4 w-4" />
            Upload resume
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/jobs"))}>
            <Sparkles className="mr-2 h-4 w-4" />
            Match all jobs
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          <CommandItem onSelect={() => runCommand(() => {
            window.dispatchEvent(new CustomEvent("open-keyboard-shortcuts"));
          })}>
            <Keyboard className="mr-2 h-4 w-4" />
            Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useQuickActions() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
