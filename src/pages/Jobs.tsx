import { useState, useMemo, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  MapPin,
  Building2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Filter,
  Briefcase,
  Target,
  Loader2,
  Rocket,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { useCVProfile } from "@/hooks/useCVProfile";
import { useJobDiscovery } from "@/hooks/useJobDiscovery";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { JobDiscoveryDialog } from "@/components/jobs/JobDiscoveryDialog";
import { CompanyTrackerDialog } from "@/components/jobs/CompanyTrackerDialog";
import { JobDetailsDrawer } from "@/components/jobs/JobDetailsDrawer";
import { JobDetailsPanel } from "@/components/jobs/JobDetailsPanel";
import { SavedSearchesPanel } from "@/components/jobs/SavedSearchesPanel";
import { BulkApplyDialog } from "@/components/jobs/BulkApplyDialog";
import { DiscoveryStatusPanel } from "@/components/jobs/DiscoveryStatusPanel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/common/HelpTooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const isAgencyJob = (job: { source_type?: string | null }) =>
  job.source_type === "agency_or_aggregator";

type JobStatus = "discovered" | "matched" | "applied" | "rejected" | "expired" | "posting_expired";

const STATUS_OPTIONS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "discovered", label: "Discovered" },
  { value: "matched", label: "Matched" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
  { value: "posting_expired", label: "Expired / Dead" },
];

const PLATFORM_OPTIONS = [
  { value: "all", label: "All Platforms" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "remoteok", label: "RemoteOK" },
  { value: "arbeitnow", label: "ArbeitNow" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "workday", label: "Workday" },
  { value: "smartrecruiters", label: "SmartRecruiters" },
  { value: "company_website", label: "Company Website" },
];

export default function Jobs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const jobDetailsView = profile?.job_details_view || "drawer";

  const { jobs, isLoading, matchJob, isMatching, refetch } = useJobs();
  const { cvProfile } = useCVProfile();
  const { lastRun, clearLastRun } = useJobDiscovery();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [includeAgency, setIncludeAgency] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [companyTrackerOpen, setCompanyTrackerOpen] = useState(false);
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [batchMatching, setBatchMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectedJob, setSelectedJob] = useState<(typeof jobs)[0] | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Agency/aggregator listings (e.g. Jobgether) route candidates into a
  // third-party funnel rather than the real employer, so they're excluded from
  // the primary matching/apply pipeline unless the user opts in.
  const agencyCount = useMemo(() => jobs.filter(isAgencyJob).length, [jobs]);

  const pipelineJobs = useMemo(
    () => (includeAgency ? jobs : jobs.filter((j) => !isAgencyJob(j))),
    [jobs, includeAgency]
  );

  // Dead/removed postings (marked posting_expired by the liveness check) must
  // never surface as matchable or applyable. They stay visible in the table via
  // the "Expired / Dead" status filter, but are excluded from Match All, Good
  // Fit counts and Bulk Apply.
  const livePipelineJobs = useMemo(
    () => pipelineJobs.filter((j) => j.status !== "posting_expired"),
    [pipelineJobs]
  );

  const expiredCount = useMemo(
    () => pipelineJobs.filter((j) => j.status === "posting_expired").length,
    [pipelineJobs]
  );

  const filteredJobs = useMemo(() => {
    return pipelineJobs.filter((job) => {
      const matchesSearch =
        searchQuery === "" ||
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.location?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesPlatform =
        platformFilter === "all" || job.source_platform === platformFilter;

      // Hide expired postings from the default view; only show them when the
      // user explicitly filters to "Expired / Dead".
      const hideExpired = statusFilter !== "posting_expired" && job.status === "posting_expired";

      return matchesSearch && matchesStatus && matchesPlatform && !hideExpired;
    });
  }, [pipelineJobs, searchQuery, statusFilter, platformFilter]);

  const matchedJobs = useMemo(() => {
    return livePipelineJobs.filter((j) => j.match_score);
  }, [livePipelineJobs]);

  const handleMatchJob = (jobId: string) => {
    if (!cvProfile) {
      toast.error("Please upload your CV first to enable matching");
      return;
    }
    setMatchingJobId(jobId);
    matchJob(
      { jobId, cvProfileId: cvProfile.id },
      {
        onSettled: () => setMatchingJobId(null),
      }
    );
  };

  const handleMatchAll = async () => {
    if (!cvProfile) {
      toast.error("Please upload your CV first to enable matching");
      return;
    }
    if (batchMatching) return;

    const unmatchedJobs = livePipelineJobs.filter((job) => !job.match_score);
    if (unmatchedJobs.length === 0) {
      toast.info("All jobs are already matched");
      return;
    }

    const total = unmatchedJobs.length;
    const cvProfileId = cvProfile.id;
    const toastId = "match-all";
    let done = 0;
    let failed = 0;

    setBatchMatching(true);
    setMatchProgress({ done: 0, total });
    toast.loading(`Matching 0/${total} jobs…`, { id: toastId });

    // Process the entire unmatched batch with bounded concurrency. Each job is
    // scored server-side (match-job runs its own AI retry/backoff), so there is
    // NO client-side abort/timeout wrapping the batch — it runs until every job
    // is done. Failures are skipped and surfaced, not silently dropped.
    const CONCURRENCY = 4;
    const queue = [...unmatchedJobs];

    const worker = async () => {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;
        try {
          const { data, error } = await supabase.functions.invoke("match-job", {
            body: { jobId: job.id, cvProfileId },
          });
          if (error) throw new Error(error.message || "Request failed");
          if (data?.error) throw new Error(data.error);
        } catch (e) {
          failed += 1;
          console.warn(`Match failed for job ${job.id}:`, e);
        } finally {
          done += 1;
          setMatchProgress({ done, total });
          toast.loading(`Matching ${done}/${total} jobs…`, { id: toastId });
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker())
      );
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setBatchMatching(false);
      setMatchProgress(null);

      const matched = total - failed;
      if (failed === 0) {
        toast.success(`Matched all ${total} jobs`, { id: toastId });
      } else if (matched === 0) {
        toast.error(`Could not match any jobs (${failed} failed). Please try again.`, {
          id: toastId,
        });
      } else {
        toast.warning(
          `Matched ${matched}/${total} jobs. ${failed} skipped due to errors.`,
          { id: toastId }
        );
      }
    }
  };

  const handleJobClick = (job: (typeof jobs)[number]) => {
    if (jobDetailsView === "drawer") {
      setSelectedJob(job);
    } else if (jobDetailsView === "page") {
      navigate(`/jobs/${job.id}`);
    } else {
      // inline expand/collapse
      setExpandedJobId((prev) => (prev === job.id ? null : job.id));
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      discovered: "bg-info/10 text-info border-info/20",
      matched: "bg-primary/10 text-primary border-primary/20",
      applied: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      expired: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge variant="outline" className={cn("capitalize", styles[status])}>
        {status}
      </Badge>
    );
  };

  const getMatchScoreBadge = (score: number | null) => {
    if (!score) return null;
    const color =
      score >= 80
        ? "bg-success/10 text-success border-success/20"
        : score >= 60
          ? "bg-warning/10 text-warning border-warning/20"
          : "bg-muted text-muted-foreground border-border";
    return (
      <Badge variant="outline" className={cn("font-mono", color)}>
        {score}%
      </Badge>
    );
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">
            Browse and manage discovered job opportunities
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setCompanyTrackerOpen(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            Track Company
          </Button>
          <Button onClick={() => setDiscoveryOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Discover Jobs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-info/10">
                    <Briefcase className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{jobs.length}</p>
                    <p className="text-sm text-muted-foreground">Total Jobs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{matchedJobs.length}</p>
                    <p className="text-sm text-muted-foreground">Matched</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-success/10">
                    <Sparkles className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {livePipelineJobs.filter((j) => (j.match_score || 0) >= 70).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Good Fit (70%+)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-warning/10">
                    <Filter className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {pipelineJobs.filter((j) => !j.match_score).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Unmatched</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, company, or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-secondary"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as JobStatus | "all")}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleMatchAll}
                  disabled={batchMatching || isMatching || !cvProfile}
                >
                  {batchMatching ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Target className="w-4 h-4 mr-2" />
                  )}
                  {batchMatching && matchProgress
                    ? `Matching ${matchProgress.done}/${matchProgress.total}`
                    : "Match All"}
                </Button>
                <Button onClick={() => setBulkApplyOpen(true)} disabled={matchedJobs.length === 0}>
                  <Rocket className="w-4 h-4 mr-2" />
                  Bulk Apply
                </Button>
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                <Switch
                  id="include-agency"
                  checked={includeAgency}
                  onCheckedChange={setIncludeAgency}
                />
                <Label htmlFor="include-agency" className="cursor-pointer text-sm">
                  Include agency/aggregator listings
                  {agencyCount > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}({agencyCount} hidden)
                    </span>
                  )}
                </Label>
                <HelpTooltip content="Third-party boards like Jobgether post roles on behalf of unnamed employers and route you into their own screening funnel. They're excluded from Match All, Good Fit counts and Bulk Apply by default." />
              </div>
            </CardContent>
          </Card>


          {/* Jobs Table */}
          {filteredJobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description={
                jobs.length === 0
                  ? "Start discovering jobs by clicking the 'Discover Jobs' button above."
                  : "Try adjusting your filters to find more jobs."
              }
              action={
                jobs.length === 0
                  ? {
                      label: "Discover Jobs",
                      onClick: () => setDiscoveryOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  {filteredJobs.length} Job{filteredJobs.length !== 1 && "s"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {jobDetailsView === "inline" && <TableHead className="w-10" />}
                        <TableHead>Job Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="hidden md:table-cell">Location</TableHead>
                        <TableHead className="hidden sm:table-cell">Platform</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredJobs.map((job) => (
                        <Fragment key={job.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-secondary/50"
                            onClick={() => handleJobClick(job)}
                          >
                            {jobDetailsView === "inline" && (
                              <TableCell className="w-10">
                                {expandedJobId === job.id ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )}
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="font-medium">{job.title}</div>
                              {job.job_type && (
                                <span className="text-xs text-muted-foreground capitalize">
                                  {job.job_type}
                                  {job.is_remote && " • Remote"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                {job.company}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                {job.location || "Not specified"}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="capitalize">
                                {job.source_platform}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(job.status || "discovered")}</TableCell>
                            <TableCell>
                              {job.match_score ? (
                                getMatchScoreBadge(job.match_score)
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMatchJob(job.id);
                                  }}
                                  disabled={isMatching || !cvProfile}
                                >
                                  {matchingJobId === job.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Target className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(job.source_url, "_blank");
                                }}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Inline expand */}
                          {jobDetailsView === "inline" && expandedJobId === job.id && (
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                className="bg-secondary/30 border-t-0"
                              >
                                <div className="p-4">
                                  <JobDetailsPanel
                                    job={job}
                                    onMatch={handleMatchJob}
                                    isMatching={isMatching && matchingJobId === job.id}
                                    hasCV={!!cvProfile}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <DiscoveryStatusPanel lastRun={lastRun} onDismiss={clearLastRun} />
          <SavedSearchesPanel onSearchRun={refetch} />
        </div>
      </div>

      <JobDiscoveryDialog open={discoveryOpen} onOpenChange={setDiscoveryOpen} />

      {/* Drawer mode */}
      {jobDetailsView === "drawer" && (
        <JobDetailsDrawer
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJob(null)}
          onMatch={handleMatchJob}
          isMatching={isMatching}
          hasCV={!!cvProfile}
        />
      )}

      <BulkApplyDialog
        open={bulkApplyOpen}
        onOpenChange={setBulkApplyOpen}
        jobs={matchedJobs}
        onComplete={refetch}
      />

      <CompanyTrackerDialog
        open={companyTrackerOpen}
        onOpenChange={setCompanyTrackerOpen}
      />
    </div>
  );
}
