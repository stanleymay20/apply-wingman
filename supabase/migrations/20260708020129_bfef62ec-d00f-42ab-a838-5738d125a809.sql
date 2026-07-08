-- Add recruiter_email to jobs so the email application path has a destination.
-- Populated by the extract-recruiter-email edge function on demand.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS recruiter_email TEXT,
  ADD COLUMN IF NOT EXISTS recruiter_email_confidence TEXT
    CHECK (recruiter_email_confidence IN ('extracted', 'inferred', 'none')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recruiter_email_extracted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_email
  ON public.jobs (user_id, recruiter_email)
  WHERE recruiter_email IS NOT NULL;