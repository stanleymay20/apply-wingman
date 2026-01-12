import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘", "D"], description: "Go to Dashboard" },
      { keys: ["⌘", "J"], description: "Go to Jobs" },
      { keys: ["⌘", "A"], description: "Go to Applications" },
      { keys: ["⌘", "P"], description: "Go to Profile" },
      { keys: ["⌘", ","], description: "Go to Settings" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Open command menu" },
      { keys: ["⌘", "⇧", "F"], description: "Discover jobs" },
      { keys: ["Esc"], description: "Close dialog/drawer" },
    ],
  },
  {
    title: "Help",
    shortcuts: [
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-keyboard-shortcuts", handleOpen);
    return () => window.removeEventListener("open-keyboard-shortcuts", handleOpen);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && 
          !(e.target instanceof HTMLInputElement) && 
          !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {group.title}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Kbd key={keyIndex}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useKeyboardNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Skip if in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "d") {
        e.preventDefault();
        navigate("/");
      } else if (isMod && e.key === "j") {
        e.preventDefault();
        navigate("/jobs");
      } else if (isMod && e.key === "a") {
        e.preventDefault();
        navigate("/applications");
      } else if (isMod && e.key === "p") {
        e.preventDefault();
        navigate("/profile");
      } else if (isMod && e.key === ",") {
        e.preventDefault();
        navigate("/settings");
      } else if (isMod && e.shiftKey && e.key === "f") {
        e.preventDefault();
        navigate("/jobs");
        setTimeout(() => window.dispatchEvent(new CustomEvent("open-job-discovery")), 100);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [navigate]);
}
