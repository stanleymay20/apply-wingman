import { useState } from "react";
import { 
  Search, 
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  Percent,
  Loader2,
  Plus,
  Briefcase,
  Sparkles,
  Mail,
  FileText,
  Inbox,
  CheckCircle2,
  Rocket,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmationBadge, DeliveryStatusBadge } from "@/components/common/ConfirmationBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { useApplications } from "@/hooks/useApplications";
import { useJobs } from "@/hooks/useJobs";
import { toast } from "sonner";
import { jobSchema } from "@/lib/validation";
import { formatDistanceToNow } from "date-fns";
import { DocumentRequestDialog } from "@/components/applications/DocumentRequestDialog";
import { JobDiscoveryDialog } from "@/components/jobs/JobDiscoveryDialog";
import { ExportButton } from "@/components/applications/ExportButton";
import { ReferralEmailDialog } from "@/components/applications/ReferralEmailDialog";
import { LogEmailDialog } from "@/components/applications/LogEmailDialog";
import { ApplicationContractDialog } from "@/components/applications/ApplicationContractDialog";
import { AutoApplyButton } from "@/components/jobs/AutoApplyButton";
import { useAutoApply } from "@/hooks/useAutoApply";

type SourcePlatform = "linkedin" | "indeed" | "greenhouse" | "lever" | "company_website" | "other";

export default function Applications() {
  const { applications, isLoading, refetch, updateStatus } = useApplications();
  const { createJob, isLoading: jobsLoading } = useJobs();
  const { autoApply, isApplying } = useAutoApply();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [documentDialog, setDocumentDialog] = useState<{
    open: boolean;
    applicationId: string;
    mode: "request" | "upload";
    required: string[];
    uploaded: string[];
  }>({ open: false, applicationId: "", mode: "request", required: [], uploaded: [] });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [logEmailDialog, setLogEmailDialog] = useState<{
    open: boolean;
    applicationId: string;
    companyName: string;
  }>({ open: false, applicationId: "", companyName: "" });
  const [contractDialog, setContractDialog] = useState<{
    open: boolean;
    job: { id: string; title: string; company: string; description: string | null; requirements: string[] | null };
    applicationId: string;
  } | null>(null);
  const [newJob, setNewJob] = useState({
    title: "",
    company: "",
    source_url: "",
    source_platform: "linkedin" as SourcePlatform,
  });

  const filteredApplications = applications.filter((app) => {
    const job = app.job;
    const matchesSearch = 
      (job?.title?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (job?.company?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || job?.source_platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const handleAddJob = () => {
    // Clear previous errors
    setFormErrors({});
    
    // Validate with Zod
    const validation = jobSchema.safeParse(newJob);
    
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        errors[field] = err.message;
      });
      setFormErrors(errors);
      toast.error("Please fix the form errors");
      return;
    }
    
    createJob({
      title: validation.data.title,
      company: validation.data.company,
      source_url: validation.data.source_url,
      source_platform: validation.data.source_platform,
    });
    setNewJob({ title: "", company: "", source_url: "", source_platform: "linkedin" });
    setFormErrors({});
    setIsAddingJob(false);
  };

  if (isLoading) {
    return <LoadingSpinner fullPage text="Loading applications..." />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold text-foreground mb-2">Applications</h1>
        <p className="text-muted-foreground">
          Complete history of all automated job applications
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 animate-scale-in">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by role or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary border-border"
              maxLength={100}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40 bg-secondary border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="offer">Offer</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="retrying">Retrying</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="manual_action_required">Action Needed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full md:w-40 bg-secondary border-border">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="indeed">Indeed</SelectItem>
              <SelectItem value="greenhouse">Greenhouse</SelectItem>
              <SelectItem value="lever">Lever</SelectItem>
              <SelectItem value="company_website">Company Site</SelectItem>
            </SelectContent>
          </Select>

          <ExportButton />

          <Button variant="outline" onClick={() => setIsDiscovering(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Discover Jobs
          </Button>

          <Dialog open={isAddingJob} onOpenChange={setIsAddingJob}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Job Manually</DialogTitle>
                <DialogDescription>
                  Add a job posting to track and match against your profile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Job Title *</Label>
                  <Input
                    placeholder="Senior Data Engineer"
                    value={newJob.title}
                    onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                    maxLength={200}
                    className={formErrors.title ? "border-destructive" : ""}
                  />
                  {formErrors.title && (
                    <p className="text-xs text-destructive mt-1">{formErrors.title}</p>
                  )}
                </div>
                <div>
                  <Label>Company *</Label>
                  <Input
                    placeholder="TechCorp GmbH"
                    value={newJob.company}
                    onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                    maxLength={200}
                    className={formErrors.company ? "border-destructive" : ""}
                  />
                  {formErrors.company && (
                    <p className="text-xs text-destructive mt-1">{formErrors.company}</p>
                  )}
                </div>
                <div>
                  <Label>Job URL *</Label>
                  <Input
                    placeholder="https://..."
                    value={newJob.source_url}
                    onChange={(e) => setNewJob({ ...newJob, source_url: e.target.value })}
                    maxLength={2000}
                    className={formErrors.source_url ? "border-destructive" : ""}
                  />
                  {formErrors.source_url && (
                    <p className="text-xs text-destructive mt-1">{formErrors.source_url}</p>
                  )}
                </div>
                <div>
                  <Label>Platform</Label>
                  <Select 
                    value={newJob.source_platform} 
                    onValueChange={(v) => setNewJob({ ...newJob, source_platform: v as SourcePlatform })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="indeed">Indeed</SelectItem>
                      <SelectItem value="greenhouse">Greenhouse</SelectItem>
                      <SelectItem value="lever">Lever</SelectItem>
                      <SelectItem value="company_website">Company Site</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddJob} className="w-full" disabled={jobsLoading}>
                  {jobsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Job"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Delivery Stats Summary */}
      {applications.length > 0 && (() => {
        const emailApps = applications.filter(a => a.application_method === "email");
        const sent = emailApps.filter(a => a.status === "submitted").length;
        const failed = emailApps.filter(a => a.status === "failed").length;
        const pending = emailApps.filter(a => a.status === "pending").length;
        const total = emailApps.length;
        const failedApps = applications.filter(a => a.status === "failed" && a.job);
        
        if (total === 0 && failedApps.length === 0) return null;
        
        return (
          <div className="space-y-3 mb-6 animate-fade-in">
            {total > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{total}</p>
                  <p className="text-xs text-muted-foreground">Email Apps</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-2xl font-bold text-success">{sent}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="glass-card p-3 text-center">
                  <p className="text-2xl font-bold text-warning">{pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            )}
            {failedApps.length > 0 && (
              <div className="glass-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">
                    {failedApps.length} failed application{failedApps.length > 1 ? 's' : ''}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isApplying}
                  onClick={async () => {
                    toast.info(`Retrying ${failedApps.length} failed applications...`);
                    for (const app of failedApps) {
                      if (!app.job) continue;
                      autoApply({
                        applicationId: app.id,
                        jobId: app.job_id,
                        method: app.application_method === "email" ? "email" : "assisted",
                        jobTitle: app.job.title,
                        company: app.job.company,
                        sourceUrl: app.job.source_url,
                        sourcePlatform: app.job.source_platform,
                        coverLetter: app.cover_letter || undefined,
                      });
                    }
                  }}
                >
                  {isApplying ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Rocket className="w-3 h-3 mr-1" />
                  )}
                  Retry All Failed
                </Button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Applications Table */}
      <div className="glass-card overflow-hidden animate-scale-in">
        {applications.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No applications yet"
            description="Add jobs manually or enable automation to start applying automatically"
            action={{
              label: "Add Your First Job",
              onClick: () => setIsAddingJob(true),
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/50">
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role / Company</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Location</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Platform</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Match</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden xl:table-cell">Confirmation</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden 2xl:table-cell">Delivery</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Applied</th>
                    <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app, index) => (
                    <tr 
                      key={app.id} 
                      className="table-row animate-slide-in border-b border-border/30 last:border-0"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-foreground">{app.job?.title || 'Unknown'}</p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Building2 className="w-3 h-3" />
                            {app.job?.company || 'Unknown'}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {app.job?.location || 'Remote'}
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-sm text-foreground capitalize">
                          {app.job?.source_platform?.replace('_', ' ') || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Percent className="w-3 h-3 text-primary" />
                          <span className="font-medium text-primary">{app.match_score}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={app.status || "pending"} />
                          {app.status === "retrying" && (app as any).next_retry_at && (
                            <span className="text-[10px] text-muted-foreground">
                              Retry {(app as any).retry_count ?? 0}/{(app as any).max_retries ?? 5} ·{" "}
                              {formatDistanceToNow(new Date((app as any).next_retry_at), { addSuffix: true })}
                            </span>
                          )}
                          {(app as any).dead_lettered_at && (
                            <span className="text-[10px] text-destructive">Dead-lettered · manual intervention required</span>
                          )}
                          {app.status === "manual_action_required" && (
                            <span className="text-[10px] text-yellow-600 dark:text-yellow-400">Manual action required</span>
                          )}
                          {(app as any).last_retry_reason && app.status !== "delivered" && (
                            <span className="text-[10px] text-muted-foreground">Reason: {(app as any).last_retry_reason}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 hidden xl:table-cell">
                        {app.job?.source_url && app.job?.source_platform ? (
                          <ConfirmationBadge
                            sourceUrl={app.job.source_url}
                            sourcePlatform={app.job.source_platform}
                            jobDescription={app.job.description}
                            applicationMethod={app.application_method}
                            size="sm"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 hidden 2xl:table-cell">
                        {app.application_method === "email" ? (
                          <DeliveryStatusBadge
                            status={
                              app.status === "submitted" ? "sent" : 
                              app.status === "failed" ? "failed" : 
                              "pending"
                            }
                            errorMessage={app.error_message}
                            size="sm"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {app.applied_at 
                            ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })
                            : 'Pending'}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Application Contract */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setContractDialog({
                                    open: true,
                                    job: {
                                      id: app.job_id,
                                      title: app.job?.title || "Job",
                                      company: app.job?.company || "Company",
                                      description: app.job?.description || null,
                                      requirements: app.job?.requirements || null,
                                    },
                                    applicationId: app.id,
                                  })
                                }
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Application Contract</TooltipContent>
                          </Tooltip>

                          {/* Log Email Response */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setLogEmailDialog({
                                    open: true,
                                    applicationId: app.id,
                                    companyName: app.job?.company || "Company",
                                  })
                                }
                                className={app.company_email_received ? "text-success" : ""}
                              >
                                {app.company_email_received ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Inbox className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {app.company_email_received ? "Email received - log more" : "Log email response"}
                            </TooltipContent>
                          </Tooltip>

                          {/* Referral Email */}
                          <ReferralEmailDialog
                            jobId={app.job_id}
                            applicationId={app.id}
                            company={app.job?.company || "Company"}
                            jobTitle={app.job?.title || "Job"}
                            trigger={
                              <Button variant="ghost" size="sm" title="Send referral email">
                                <Mail className="w-4 h-4" />
                              </Button>
                            }
                          />

                          {/* Finish manual application step */}
                          {app.status === "manual_action_required" && app.job?.source_url && (
                            <>
                              {/* Real anchor (same reliable pattern as the
                                  External Link action) — window.open was a
                                  silent no-op behind the tooltip trigger. */}
                              <a
                                href={app.job.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open the application form to complete it manually"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-yellow-600 dark:text-yellow-400 border-yellow-500/40"
                                >
                                  <ExternalLink className="w-4 h-4 mr-1" />
                                  Finish
                                </Button>
                              </a>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-success hover:text-success"
                                    onClick={() => {
                                      updateStatus({ id: app.id, status: "submitted" });
                                      toast.success("Marked as applied", {
                                        description: `${app.job?.company || "Application"} moved to Submitted.`,
                                      });
                                    }}
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  I've submitted it — mark as applied
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}

                          {/* Auto Apply / Retry Button */}
                          {(app.status === "pending" || app.status === "failed") && app.job && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {app.status === "failed" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isApplying}
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (!app.job) return;
                                      autoApply({
                                        applicationId: app.id,
                                        jobId: app.job_id,
                                        method: app.application_method === "email" ? "email" : "assisted",
                                        jobTitle: app.job.title,
                                        company: app.job.company,
                                        sourceUrl: app.job.source_url,
                                        sourcePlatform: app.job.source_platform,
                                        coverLetter: app.cover_letter || undefined,
                                      });
                                    }}
                                  >
                                    <Rocket className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <span>
                                    <AutoApplyButton
                                      job={{
                                        id: app.job_id,
                                        title: app.job.title,
                                        company: app.job.company,
                                        source_url: app.job.source_url,
                                        source_platform: app.job.source_platform,
                                        application: { id: app.id, cover_letter: app.cover_letter || undefined },
                                      }}
                                      variant="ghost"
                                      size="sm"
                                    />
                                  </span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {app.status === "failed" ? "Retry application" : "Auto apply"}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* External Link */}
                          {app.job?.source_url && (
                            <a 
                              href={app.job.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              aria-label="View job posting"
                            >
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredApplications.length === 0 && applications.length > 0 && (
              <div className="p-12 text-center">
                <p className="text-muted-foreground">No applications match your filters</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stats */}
      {applications.length > 0 && (
        <div className="flex items-center justify-between mt-6 animate-fade-in">
          <p className="text-sm text-muted-foreground">
            Showing {filteredApplications.length} of {applications.length} applications
          </p>
        </div>
      )}

      {/* Job Discovery Dialog */}
      <JobDiscoveryDialog open={isDiscovering} onOpenChange={setIsDiscovering} />

      {/* Document Request Dialog */}
      <DocumentRequestDialog
        open={documentDialog.open}
        onOpenChange={(open) => setDocumentDialog({ ...documentDialog, open })}
        applicationId={documentDialog.applicationId}
        requiredDocuments={documentDialog.required}
        uploadedDocuments={documentDialog.uploaded}
        mode={documentDialog.mode}
        onDocumentsUploaded={() => refetch()}
      />

      {/* Log Email Dialog */}
      <LogEmailDialog
        open={logEmailDialog.open}
        onOpenChange={(open) => setLogEmailDialog({ ...logEmailDialog, open })}
        applicationId={logEmailDialog.applicationId}
        companyName={logEmailDialog.companyName}
      />

      {/* Application Contract Dialog */}
      {contractDialog && (
        <ApplicationContractDialog
          open={contractDialog.open}
          onOpenChange={(open) => {
            if (!open) setContractDialog(null);
          }}
          job={contractDialog.job}
          applicationId={contractDialog.applicationId}
        />
      )}
    </div>
  );
}
