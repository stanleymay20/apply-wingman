import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { JobDetailsPanel, type JobDetailsPanelJob } from "@/components/jobs/JobDetailsPanel";

interface JobDetailsDrawerProps {
  job: JobDetailsPanelJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMatch?: (jobId: string) => void;
  isMatching?: boolean;
  hasCV?: boolean;
}

export function JobDetailsDrawer({
  job,
  open,
  onOpenChange,
  onMatch,
  isMatching,
  hasCV,
}: JobDetailsDrawerProps) {
  if (!job) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden">
          <JobDetailsPanel
            job={job}
            onMatch={onMatch}
            isMatching={isMatching}
            hasCV={hasCV}
            scroll
          />
        </div>

        <div className="pt-4 border-t flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button className="flex-1" asChild>
            <a href={job.source_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Job
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
