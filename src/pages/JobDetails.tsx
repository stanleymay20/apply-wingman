import { Button } from "@/components/ui/button";
import { JobDetailsPanel } from "@/components/jobs/JobDetailsPanel";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { useJobs } from "@/hooks/useJobs";
import { useCVProfile } from "@/hooks/useCVProfile";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase } from "lucide-react";

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { jobs, isLoading, matchJob, isMatching } = useJobs();
  const { cvProfile } = useCVProfile();

  const job = jobs.find((j) => j.id === jobId);

  if (isLoading) return <LoadingSpinner />;

  if (!job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/jobs")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
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

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate("/jobs")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button asChild>
          <a href={job.source_url} target="_blank" rel="noopener noreferrer">
            Open listing
          </a>
        </Button>
      </header>

      <section className="glass-card p-6">
        <JobDetailsPanel
          job={job}
          onMatch={(id) => cvProfile?.id && matchJob({ jobId: id, cvProfileId: cvProfile.id })}
          isMatching={isMatching}
          hasCV={!!cvProfile}
        />
      </section>
    </main>
  );
}
