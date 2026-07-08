ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS source_key text GENERATED ALWAYS AS (lower(regexp_replace(btrim(source_url), '/+$', ''))) STORED;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
), duplicate_map AS (
  SELECT id AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.automation_run_steps s
SET job_id = duplicate_map.keep_id
FROM duplicate_map
WHERE s.job_id = duplicate_map.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
), duplicate_map AS (
  SELECT id AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.applications a
SET job_id = duplicate_map.keep_id
FROM duplicate_map
WHERE a.job_id = duplicate_map.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
), duplicate_map AS (
  SELECT id AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.application_logs l
SET job_id = duplicate_map.keep_id
FROM duplicate_map
WHERE l.job_id = duplicate_map.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
), duplicate_map AS (
  SELECT id AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.referral_emails r
SET job_id = duplicate_map.keep_id
FROM duplicate_map
WHERE r.job_id = duplicate_map.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, source_key
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
)
DELETE FROM public.jobs j
USING ranked
WHERE j.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_user_source_key_unique
ON public.jobs (user_id, source_key);

CREATE INDEX IF NOT EXISTS idx_jobs_user_platform_created
ON public.jobs (user_id, source_platform, created_at DESC);