import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Rocket,
  ExternalLink,
  ListChecks,
  Bookmark,
  Mail,
  Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAutoApply } from "@/hooks/useAutoApply";
import { useCVProfile } from "@/hooks/useCVProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BulkApplyMode = "auto_apply" | "queue_links" | "shortlist";

interface Job {
  id: string;
  title: string;
  company: string;
  match_score?: number;
  source_url: string;
  source_platform: string;
}

interface BulkApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: Job[];
  onComplete?: () => void;
}

export function BulkApplyDialog({
  open,
  onOpenChange,
  jobs,
  onComplete,
}: BulkApplyDialogProps) {
  const { profile } = useAuth();
  const { bulkAutoApply, isApplying, detectApplyMethod } = useAutoApply();
  const { cvProfile } = useCVProfile();

  const defaultThreshold = profile?.minimum_fit_score || 70;
  const savedMode = (profile as any)?.bulk_apply_mode as BulkApplyMode | undefined;

  const [threshold, setThreshold] = useState(70);
  const [mode, setMode] = useState<BulkApplyMode>("auto_apply");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Sync dialog defaults whenever it opens
  useEffect(() => {
    if (!open) return;
    setThreshold(defaultThreshold);
    setMode(savedMode || "auto_apply");
    setProgress(0);
  }, [open, defaultThreshold, savedMode]);

  const eligibleJobs = useMemo(() => {
    return jobs.filter((job) => (job.match_score || 0) >= threshold);
  }, [jobs, threshold]);

  const handleApply = async () => {
    if (eligibleJobs.length === 0) {
      toast.info("No jobs meet the threshold");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (mode === "shortlist") {
        toast.success(`Shortlisted ${eligibleJobs.length} jobs`);
      } else if (mode === "queue_links") {
        // Open links and let user apply manually
        eligibleJobs.slice(0, 5).forEach((job) => {
          window.open(job.source_url, "_blank");
        });
        if (eligibleJobs.length > 5) {
          toast.info(`Opened first 5 links. ${eligibleJobs.length - 5} more available.`);
        } else {
          toast.success(`Opened ${eligibleJobs.length} job links`);
        }
      } else {
        // auto_apply: Use the real auto-apply system
        const jobsToApply = eligibleJobs.map((job) => ({
          id: job.id,
          title: job.title,
          company: job.company,
          source_url: job.source_url,
          source_platform: job.source_platform,
        }));

        const results = await bulkAutoApply(jobsToApply);
        const successCount = results.filter((r) => r.success).length;
        
        if (successCount === jobsToApply.length) {
          toast.success(`Successfully applied to ${successCount} jobs!`);
        } else {
          toast.info(`Applied to ${successCount}/${jobsToApply.length} jobs`);
        }
      }

      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to process bulk apply");
    } finally {
      setIsProcessing(false);
    }
  };

  const modeOptions: { value: BulkApplyMode; label: string; icon: React.ReactNode; description: string }[] = [
    {
      value: "auto_apply",
      label: "Auto Apply",
      icon: <Rocket className="w-4 h-4" />,
      description: "Automatically apply using email or ATS APIs",
    },
    {
      value: "queue_links",
      label: "Open Links",
      icon: <ExternalLink className="w-4 h-4" />,
      description: "Open job pages for manual application",
    },
    {
      value: "shortlist",
      label: "Shortlist Only",
      icon: <Bookmark className="w-4 h-4" />,
      description: "Just mark for later without applying",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Bulk Apply
          </DialogTitle>
          <DialogDescription>
            Apply to multiple jobs that meet your match threshold
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Threshold Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Minimum Match Score</Label>
              <Badge variant="outline" className="font-mono">
                {threshold}%
              </Badge>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v)}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              {eligibleJobs.length} of {jobs.filter((j) => j.match_score).length} matched jobs meet this threshold
            </p>
          </div>

          {/* Mode Selection */}
          <div className="space-y-3">
            <Label>Apply Mode</Label>
            <div className="space-y-2">
              {modeOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    mode === opt.value
                      ? "bg-primary/10 border-primary/30"
                      : "border-border/50 hover:bg-secondary"
                  )}
                  onClick={() => setMode(opt.value)}
                >
                  <Checkbox
                    checked={mode === opt.value}
                    onCheckedChange={() => setMode(opt.value)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {opt.icon}
                      <span className="font-medium">{opt.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {eligibleJobs.length > 0 && (
            <div className="space-y-2">
              <Label>Jobs to Apply ({eligibleJobs.length})</Label>
              <ScrollArea className="h-32 rounded-lg border border-border/50 p-2">
                <div className="space-y-1">
                  {eligibleJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="truncate flex-1">{job.title}</span>
                      <Badge variant="outline" className="ml-2 shrink-0">
                        {job.match_score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={eligibleJobs.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                Apply to {eligibleJobs.length} Jobs
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
