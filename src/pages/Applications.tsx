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
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
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

export default function Applications() {
  const { applications, isLoading } = useApplications();
  const { createJob, isLoading: jobsLoading } = useJobs();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [newJob, setNewJob] = useState({
    title: "",
    company: "",
    source_url: "",
    source_platform: "linkedin" as const,
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
    if (!newJob.title || !newJob.company || !newJob.source_url) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    createJob(newJob);
    setNewJob({ title: "", company: "", source_url: "", source_platform: "linkedin" });
    setIsAddingJob(false);
  };

  const exportToCSV = () => {
    const headers = ["Role", "Company", "Location", "Platform", "Match Score", "Status", "Applied At"];
    const rows = filteredApplications.map(app => [
      app.job?.title || "",
      app.job?.company || "",
      app.job?.location || "",
      app.job?.source_platform || "",
      app.match_score,
      app.status,
      app.applied_at || "",
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Applications exported to CSV");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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

          <Button variant="outline" size="icon" onClick={exportToCSV} title="Export CSV">
            <Download className="w-4 h-4" />
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
                  />
                </div>
                <div>
                  <Label>Company *</Label>
                  <Input
                    placeholder="TechCorp GmbH"
                    value={newJob.company}
                    onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Job URL *</Label>
                  <Input
                    placeholder="https://..."
                    value={newJob.source_url}
                    onChange={(e) => setNewJob({ ...newJob, source_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Platform</Label>
                  <Select 
                    value={newJob.source_platform} 
                    onValueChange={(v) => setNewJob({ ...newJob, source_platform: v as typeof newJob.source_platform })}
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
                  Add Job
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Applications Table */}
      <div className="glass-card overflow-hidden animate-scale-in">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role / Company</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Location</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Platform</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Match</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Applied</th>
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
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {app.job?.location || 'Remote'}
                    </div>
                  </td>
                  <td className="p-4">
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
                    <StatusBadge status={app.status as "applied" | "interview" | "rejected" | "pending"} />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {app.applied_at 
                        ? new Date(app.applied_at).toLocaleDateString()
                        : 'Pending'}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    {app.job?.source_url && (
                      <a href={app.job.source_url} target="_blank" rel="noopener noreferrer">
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

        {filteredApplications.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">
              {applications.length === 0 
                ? "No applications yet. Add jobs or start automation to begin."
                : "No applications match your filters"}
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mt-6 animate-fade-in">
        <p className="text-sm text-muted-foreground">
          Showing {filteredApplications.length} of {applications.length} applications
        </p>
      </div>
    </div>
  );
}
