-- Add source_type to classify direct-employer vs agency/aggregator listings.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'direct_employer';

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_source_type_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_source_type_check
  CHECK (source_type = ANY (ARRAY['direct_employer'::text, 'agency_or_aggregator'::text]));

-- Retroactively apply the widened company sanitizer: any company whose text
-- stacks 2+ seniority/role tokens is a leaked job title, not an employer name.
-- Re-derive from the ATS board slug in the URL, else "Unknown Company".
WITH suspect AS (
  SELECT
    id,
    lower(COALESCE(
      (regexp_match(source_url, 'jobs\.lever\.co/([A-Za-z0-9._-]+)'))[1],
      (regexp_match(source_url, 'greenhouse\.io/([A-Za-z0-9._-]+)/jobs/'))[1],
      (regexp_match(source_url, 'jobs\.smartrecruiters\.com/([A-Za-z0-9._-]+)'))[1],
      (regexp_match(source_url, '//([A-Za-z0-9_-]+)\.[A-Za-z0-9_.-]*myworkdayjobs\.com'))[1]
    )) AS slug
  FROM public.jobs
  WHERE (
    SELECT count(*) FROM regexp_matches(
      company,
      '(?i)\y(senior|lead|principal|staff|junior|mid|consultant|engineer|manager|analyst|scientist|specialist|director|developer|architect|coordinator|administrator|designer|recruiter|programmer|intern|associate|officer|executive|head|vp)\y',
      'g'
    )
  ) >= 2
)
UPDATE public.jobs j
SET company = CASE
    WHEN s.slug IS NOT NULL AND s.slug <> '' AND s.slug NOT IN ('v0','v1','api','boards','embed','www','en-us')
      THEN initcap(regexp_replace(s.slug, '[-_.]+', ' ', 'g'))
    ELSE 'Unknown Company'
  END,
  updated_at = now()
FROM suspect s
WHERE j.id = s.id;

-- Tag known third-party agency/aggregator boards (Jobgether) so they stay out
-- of the primary matching/apply pipeline.
UPDATE public.jobs
SET source_type = 'agency_or_aggregator', updated_at = now()
WHERE lower(company) = 'jobgether'
   OR source_url ILIKE '%lever.co/jobgether%'
   OR source_url ILIKE '%/jobgether/%';