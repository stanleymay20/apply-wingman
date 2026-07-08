-- Add 'posting_expired' as a valid job status so dead/removed postings can be
-- flagged distinctly and excluded from the matching/apply pipeline.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status = ANY (ARRAY[
    'discovered'::text,
    'queued'::text,
    'applied'::text,
    'rejected'::text,
    'interview'::text,
    'offer'::text,
    'withdrawn'::text,
    'expired'::text,
    'blacklisted'::text,
    'posting_expired'::text
  ])
);

-- Track when a liveness check last ran so periodic sweeps can prioritise
-- stale rows.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS liveness_checked_at timestamp with time zone;