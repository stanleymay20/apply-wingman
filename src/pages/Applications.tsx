import { useState } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  ExternalLink,
  ChevronDown,
  Building2,
  MapPin,
  Calendar,
  Percent
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

interface Application {
  id: string;
  company: string;
  role: string;
  location: string;
  platform: string;
  jobUrl: string;
  matchScore: number;
  status: "applied" | "interview" | "rejected" | "pending";
  appliedAt: string;
  method: string;
}

const applications: Application[] = [
  {
    id: "1",
    company: "TechCorp GmbH",
    role: "Senior Data Engineer",
    location: "Berlin, Germany",
    platform: "LinkedIn",
    jobUrl: "#",
    matchScore: 94,
    status: "interview",
    appliedAt: "2025-01-12 10:30",
    method: "Easy Apply",
  },
  {
    id: "2",
    company: "AI Solutions AG",
    role: "Machine Learning Engineer",
    location: "Munich, Germany",
    platform: "Greenhouse",
    jobUrl: "#",
    matchScore: 89,
    status: "applied",
    appliedAt: "2025-01-12 08:15",
    method: "Direct Form",
  },
  {
    id: "3",
    company: "DataFlow Inc",
    role: "Analytics Lead",
    location: "Remote (EU)",
    platform: "Indeed",
    jobUrl: "#",
    matchScore: 86,
    status: "applied",
    appliedAt: "2025-01-12 07:45",
    method: "Easy Apply",
  },
  {
    id: "4",
    company: "Growth Dynamics",
    role: "Growth Data Analyst",
    location: "Hamburg, Germany",
    platform: "Company Site",
    jobUrl: "#",
    matchScore: 82,
    status: "pending",
    appliedAt: "2025-01-12 06:20",
    method: "Email",
  },
  {
    id: "5",
    company: "StartupXYZ",
    role: "Data Scientist",
    location: "Frankfurt, Germany",
    platform: "Lever",
    jobUrl: "#",
    matchScore: 78,
    status: "rejected",
    appliedAt: "2025-01-11 14:30",
    method: "Direct Form",
  },
  {
    id: "6",
    company: "CloudTech Solutions",
    role: "Data Platform Lead",
    location: "Berlin, Germany",
    platform: "LinkedIn",
    jobUrl: "#",
    matchScore: 91,
    status: "applied",
    appliedAt: "2025-01-11 11:00",
    method: "Easy Apply",
  },
  {
    id: "7",
    company: "FinanceAI",
    role: "Senior ML Engineer",
    location: "Remote",
    platform: "Greenhouse",
    jobUrl: "#",
    matchScore: 88,
    status: "interview",
    appliedAt: "2025-01-11 09:30",
    method: "Direct Form",
  },
  {
    id: "8",
    company: "AutomateNow",
    role: "Automation Engineer",
    location: "Munich, Germany",
    platform: "Indeed",
    jobUrl: "#",
    matchScore: 85,
    status: "applied",
    appliedAt: "2025-01-10 16:45",
    method: "Easy Apply",
  },
];

export default function Applications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const filteredApplications = applications.filter((app) => {
    const matchesSearch = 
      app.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || app.platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

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
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="interview">Interview</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full md:w-40 bg-secondary border-border">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="LinkedIn">LinkedIn</SelectItem>
              <SelectItem value="Indeed">Indeed</SelectItem>
              <SelectItem value="Greenhouse">Greenhouse</SelectItem>
              <SelectItem value="Lever">Lever</SelectItem>
              <SelectItem value="Company Site">Company Site</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon">
            <Download className="w-4 h-4" />
          </Button>
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
                  className="table-row animate-slide-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-foreground">{app.role}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        {app.company}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {app.location}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-foreground">{app.platform}</span>
                    <p className="text-xs text-muted-foreground">{app.method}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Percent className="w-3 h-3 text-primary" />
                      <span className="font-medium text-primary">{app.matchScore}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredApplications.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No applications match your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6 animate-fade-in">
        <p className="text-sm text-muted-foreground">
          Showing {filteredApplications.length} of {applications.length} applications
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
