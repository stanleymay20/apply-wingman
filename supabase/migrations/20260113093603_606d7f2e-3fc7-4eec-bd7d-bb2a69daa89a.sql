-- Job discovery runs (tracks background execution)
CREATE TABLE IF NOT EXISTS public.job_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  params jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  jobs_found integer NOT NULL DEFAULT 0,
  jobs_saved integer NOT NULL DEFAULT 0,
  error text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_discovery_runs_user_created_at
  ON public.job_discovery_runs (user_id, created_at DESC);

ALTER TABLE public.job_discovery_runs ENABLE ROW LEVEL SECURITY;

-- Users can view their own runs
DO $$ BEGIN
  CREATE POLICY "Users can view their own job discovery runs"
  ON public.job_discovery_runs
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can create their own runs
DO $$ BEGIN
  CREATE POLICY "Users can create their own job discovery runs"
  ON public.job_discovery_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can update their own runs (used by backend functions running as the user)
DO $$ BEGIN
  CREATE POLICY "Users can update their own job discovery runs"
  ON public.job_discovery_runs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keep updated_at current
DROP TRIGGER IF EXISTS trg_job_discovery_runs_updated_at ON public.job_discovery_runs;
CREATE TRIGGER trg_job_discovery_runs_updated_at
BEFORE UPDATE ON public.job_discovery_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
