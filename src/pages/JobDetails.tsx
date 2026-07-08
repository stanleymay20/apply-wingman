import { Button } from "@/components/ui/button";
import { JobDetailsPanel } from "@/components/jobs/JobDetailsPanel";
import { AutoApplyButton } from "@/components/jobs/AutoApplyButton";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useJobs } from "@/hooks/useJobs";
import { useCVProfile } from "@/hooks/useCVProfile";
import { useApplications } from "@/hooks/useApplications";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, ExternalLink } from "lucide-react";

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { jobs, isLoading, matchJob, isMatching } = useJobs();
  const { cvProfile } = useCVProfile();
  const { applications } = useApplications();

  const job = jobs.find((j) => j.id === jobId);
  const application = applications.find((app) => app.job_id === jobId);

  if (isLoading) return <LoadingSpinner />;

  if (!job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Button>
        </div>

        <EmptyState
          icon={Briefcase}
          title="Job not found"
          description="This job may have been deleted or you may not have access to it."
          action={{ label: "Go to Jobs", onClick: () => navigate("/jobs") }}
        />
      </div>
    );
  }

  const handleMatch = (id: string) => {
    if (cvProfile?.id) {
      matchJob({ jobId: id, cvProfileId: cvProfile.id });
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Button>

        <Button asChild>
          <a href={job.source_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Original Listing
          </a>
        </Button>
      </header>

      <section className="glass-card p-6">
        <JobDetailsPanel
          job={job}
          onMatch={handleMatch}
          isMatching={isMatching}
          hasCV={!!cvProfile}
        />
      </section>
    </main>
  );
}
