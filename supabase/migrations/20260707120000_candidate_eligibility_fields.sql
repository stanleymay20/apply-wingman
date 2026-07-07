-- Candidate work-eligibility fields, used by match-job to hard-disqualify
-- jobs in locations where the candidate cannot legally work.
ALTER TABLE public.cv_profiles
  ADD COLUMN IF NOT EXISTS candidate_country text,
  ADD COLUMN IF NOT EXISTS work_authorized_countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS needs_sponsorship boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cv_profiles.candidate_country IS 'Country the candidate is currently based in';
COMMENT ON COLUMN public.cv_profiles.work_authorized_countries IS 'Countries/regions (e.g. Germany, EU) where the candidate already holds work authorization';
COMMENT ON COLUMN public.cv_profiles.needs_sponsorship IS 'Whether the candidate needs visa sponsorship outside their authorized countries';
