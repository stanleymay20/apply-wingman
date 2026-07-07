-- Allow the new free job sources in jobs.source_platform; without this the
-- batch insert of discovered jobs fails wholesale when it contains an
-- arbeitnow/remoteok row.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_source_platform_check;

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_source_platform_check
CHECK (
  source_platform IN (
    'linkedin',
    'indeed',
    'greenhouse',
    'lever',
    'workday',
    'smartrecruiters',
    'arbeitnow',
    'remoteok',
    'company_website',
    'other'
  )
);
