import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  Loader2, 
  Plus, 
  ExternalLink, 
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CompanyTrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScrapedJob {
  title: string;
  url: string;
  location?: string;
  department?: string;
}

interface ScrapeResult {
  company: string;
  careerPagesFound: number;
  jobs: ScrapedJob[];
}

export function CompanyTrackerDialog({ open, onOpenChange }: CompanyTrackerDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [companyUrl, setCompanyUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ScrapeResult | null>(null);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  const handleScan = async () => {
    if (!companyUrl.trim()) {
      toast.error("Please enter a company website URL");
      return;
    }

    setIsScanning(true);
    setResults(null);
    setSavedJobs(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("scrape-company-careers", {
        body: { companyUrl, companyName },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setResults(data);
      
      if (data.jobs.length === 0) {
        toast.info(`No job listings found on ${data.company}'s careers page`);
      } else {
        toast.success(`Found ${data.jobs.length} job openings at ${data.company}`);
      }
    } catch (err) {
      console.error("Company scan error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to scan company website");
    } finally {
      setIsScanning(false);
    }
  };

  const saveJob = async (job: ScrapedJob) => {
    if (!user || savedJobs.has(job.url)) return;

    try {
      const { error } = await supabase.from("jobs").insert({
        title: job.title,
        company: results?.company || companyName || "Unknown",
        location: job.location || null,
        source_platform: "company_website",
        source_url: job.url,
        description: job.department ? `Department: ${job.department}` : null,
        is_remote: job.location?.toLowerCase().includes("remote") ?? false,
        user_id: user.id,
        status: "discovered",
      });

      if (error) throw error;

      setSavedJobs(prev => new Set([...prev, job.url]));
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Saved: ${job.title}`);
    } catch (err) {
      console.error("Save job error:", err);
      toast.error("Failed to save job");
    }
  };

  const saveAllJobs = async () => {
    if (!user || !results) return;

    const unsavedJobs = results.jobs.filter(j => !savedJobs.has(j.url));
    if (unsavedJobs.length === 0) {
      toast.info("All jobs already saved");
      return;
    }

    try {
      const jobsToInsert = unsavedJobs.map(job => ({
        title: job.title,
        company: results.company,
        location: job.location || null,
        source_platform: "company_website",
        source_url: job.url,
        description: job.department ? `Department: ${job.department}` : null,
        is_remote: job.location?.toLowerCase().includes("remote") ?? false,
        user_id: user.id,
        status: "discovered",
      }));

      const { error } = await supabase.from("jobs").insert(jobsToInsert);
      if (error) throw error;

      setSavedJobs(new Set(results.jobs.map(j => j.url)));
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Saved ${unsavedJobs.length} jobs from ${results.company}`);
    } catch (err) {
      console.error("Save all jobs error:", err);
      toast.error("Failed to save jobs");
    }
  };

  const handleClose = () => {
    setResults(null);
    setCompanyUrl("");
    setCompanyName("");
    setSavedJobs(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Track Company Careers
          </DialogTitle>
          <DialogDescription>
            Scan a company's website to find and track their job openings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Company URL Input */}
          <div className="space-y-2">
            <Label>Company Website URL</Label>
            <Input
              placeholder="e.g. stripe.com or https://careers.google.com"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="bg-secondary border-border"
              disabled={isScanning}
            />
          </div>

          {/* Optional Company Name */}
          <div className="space-y-2">
            <Label>Company Name (Optional)</Label>
            <Input
              placeholder="e.g. Stripe"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="bg-secondary border-border"
              disabled={isScanning}
            />
          </div>

          {/* Scan Button */}
          <Button 
            onClick={handleScan} 
            disabled={!companyUrl.trim() || isScanning}
            className="w-full"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning careers page...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4 mr-2" />
                Scan for Jobs
              </>
            )}
          </Button>

          {/* Results */}
          {results && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">{results.company}</h3>
                  <p className="text-sm text-muted-foreground">
                    Found {results.jobs.length} job{results.jobs.length !== 1 ? "s" : ""} 
                    {results.careerPagesFound > 0 && ` across ${results.careerPagesFound} career pages`}
                  </p>
                </div>
                {results.jobs.length > 0 && (
                  <Button variant="outline" size="sm" onClick={saveAllJobs}>
                    <Plus className="w-4 h-4 mr-1" />
                    Save All
                  </Button>
                )}
              </div>

              {results.jobs.length > 0 ? (
                <ScrollArea className="h-64 rounded-md border border-border/50">
                  <div className="p-2 space-y-2">
                    {results.jobs.map((job, idx) => (
                      <div
                        key={`${job.url}-${idx}`}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="font-medium text-foreground truncate">
                            {job.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {job.location && (
                              <Badge variant="outline" className="text-xs">
                                {job.location}
                              </Badge>
                            )}
                            {job.department && (
                              <Badge variant="secondary" className="text-xs">
                                {job.department}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(job.url, "_blank")}
                            title="View job posting"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          {savedJobs.has(job.url) ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => saveJob(job)}
                              title="Save job"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center p-8 text-center bg-secondary/30 rounded-lg">
                  <div>
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No job listings found. Try the company's main careers page directly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}