import { useState } from "react";
import { 
  Search, 
  Download, 
  ExternalLink,
  Building2,
  MapPin,
  Calendar,
  Percent,
  Loader2,
  Plus,
  Briefcase,
  FileText,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
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
import { Label } from "@/components/ui/label";
import { useApplications } from "@/hooks/useApplications";
import { useJobs } from "@/hooks/useJobs";
import { toast } from "sonner";
import { jobSchema } from "@/lib/validation";
import { formatDistanceToNow } from "date-fns";
import { DocumentRequestDialog } from "@/components/applications/DocumentRequestDialog";
import { JobDiscoveryDialog } from "@/components/jobs/JobDiscoveryDialog";

type SourcePlatform = "linkedin" | "indeed" | "greenhouse" | "lever" | "company_website" | "other";

export default function Applications() {
  const { applications, isLoading, refetch } = useApplications();
  const { createJob, isLoading: jobsLoading } = useJobs();
  
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

  const exportToCSV = () => {
    if (filteredApplications.length === 0) {
      toast.error("No applications to export");
      return;
    }
    
    const headers = ["Role", "Company", "Location", "Platform", "Match Score", "Status", "Applied At"];
    const rows = filteredApplications.map(app => [
      (app.job?.title || "").replace(/,/g, ";"),
      (app.job?.company || "").replace(/,/g, ";"),
      (app.job?.location || "").replace(/,/g, ";"),
      (app.job?.source_platform || "").replace(/,/g, ";"),
      app.match_score,
      app.status || "",
      app.applied_at || "",
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Applications exported to CSV");
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
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="offer">Offer</SelectItem>
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

          <Button 
            variant="outline" 
            size="icon" 
            onClick={exportToCSV} 
            title="Export CSV"
            disabled={filteredApplications.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>

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
                        <StatusBadge status={app.status || "pending"} />
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
    </div>
  );
}
