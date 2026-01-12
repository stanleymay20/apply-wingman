-- Fix job discovery inserts failing due to overly strict platform check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'jobs_source_platform_check'
      AND n.nspname = 'public'
      AND t.relname = 'jobs'
  ) THEN
    ALTER TABLE public.jobs DROP CONSTRAINT jobs_source_platform_check;
  END IF;
END $$;

ALTER TABLE public.jobs
ADD CONSTRAINT jobs_source_platform_check
CHECK (
  source_platform IN (
    'linkedin',
    'indeed',
    'greenhouse',
    'lever',
    'workday',
    'smartrecruiters'
  )
);
