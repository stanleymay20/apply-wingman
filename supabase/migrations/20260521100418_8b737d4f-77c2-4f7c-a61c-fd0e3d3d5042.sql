
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS first_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS provider_context jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_idempotency_key
  ON public.applications(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_applications_retry_due
  ON public.applications(next_retry_at)
  WHERE status = 'retrying' AND dead_lettered_at IS NULL;

-- Seed retry-related system settings (admin can tune later).
INSERT INTO public.system_settings (key, value, value_type, scope, description, min_value, max_value)
VALUES
  ('retry.base_delay_seconds',     '2'::jsonb,   'number', 'global', 'Initial retry delay in seconds.', 1, 60),
  ('retry.multiplier',             '2'::jsonb,   'number', 'global', 'Exponential backoff multiplier.', 1.5, 5),
  ('retry.max_delay_seconds',      '3600'::jsonb,'number', 'global', 'Maximum retry delay cap in seconds.', 60, 21600),
  ('retry.jitter_seconds',         '15'::jsonb,  'number', 'global', 'Random jitter (± seconds) added per attempt.', 0, 300),
  ('retry.max_retries',            '5'::jsonb,   'number', 'global', 'Default maximum retries before dead-letter.', 1, 20),
  ('retry.batch_size',             '25'::jsonb,  'number', 'global', 'Max retries processed per cron tick.', 1, 200),
  ('retry.cron_interval_minutes',  '2'::jsonb,   'number', 'global', 'Cron tick frequency in minutes.', 1, 60)
ON CONFLICT (key) DO NOTHING;
