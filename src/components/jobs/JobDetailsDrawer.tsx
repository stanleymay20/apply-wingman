import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { JobDetailsPanel, type JobDetailsPanelJob } from "@/components/jobs/JobDetailsPanel";
import { AutoApplyButton } from "@/components/jobs/AutoApplyButton";
import { ResumeTailorButton } from "@/components/jobs/ResumeTailorButton";
import { useApplications } from "@/hooks/useApplications";

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
  const { applications } = useApplications();
  
  if (!job) return null;

  // Find existing application for this job
  const application = applications.find((app) => app.job_id === job.id);

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

        <div className="pt-4 border-t space-y-2">
          <ResumeTailorButton
            job={{
              id: job.id,
              title: job.title,
              company: job.company,
              description: job.description,
              requirements: job.requirements,
            }}
            variant="outline"
            size="sm"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button variant="outline" asChild>
              <a href={job.source_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                View
              </a>
            </Button>
            <AutoApplyButton
              job={{
                id: job.id,
                title: job.title,
                company: job.company,
                source_url: job.source_url,
                source_platform: job.source_platform,
                application: application ? { id: application.id, cover_letter: application.cover_letter || undefined } : null,
              }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
