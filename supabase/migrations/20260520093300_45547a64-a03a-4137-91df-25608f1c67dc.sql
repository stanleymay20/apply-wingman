-- ============================================================
-- PHASE 1 + 2: Observability ledger + truthful delivery
-- ============================================================

-- ===== ROLES =====
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
CREATE POLICY "Admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== AUTOMATION RUN LEDGER =====
DO $$ BEGIN
  CREATE TYPE public.automation_trigger_type AS ENUM ('cron', 'manual', 'retry', 'webhook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automation_run_status AS ENUM ('running', 'completed', 'partial', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trigger_type public.automation_trigger_type NOT NULL,
  execution_source text NOT NULL DEFAULT 'cron',
  worker_version text NOT NULL DEFAULT 'unknown',
  environment text NOT NULL DEFAULT 'production',
  initiated_by uuid,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  jobs_discovered integer NOT NULL DEFAULT 0,
  jobs_matched integer NOT NULL DEFAULT 0,
  applications_attempted integer NOT NULL DEFAULT 0,
  applications_succeeded integer NOT NULL DEFAULT 0,
  applications_failed integer NOT NULL DEFAULT 0,
  status public.automation_run_status NOT NULL DEFAULT 'running',
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_user_started ON public.automation_runs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON public.automation_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_correlation ON public.automation_runs (correlation_id);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own runs" ON public.automation_runs;
CREATE POLICY "Users view own runs" ON public.automation_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all runs" ON public.automation_runs;
CREATE POLICY "Admins view all runs" ON public.automation_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Inserts/updates are service-role only (no policies → only service role bypasses RLS)

-- ===== STEP EVENTS =====
DO $$ BEGIN
  CREATE TYPE public.automation_step_name AS ENUM (
    'discover_started', 'discover_completed',
    'match_started', 'match_completed',
    'apply_started', 'apply_completed', 'apply_failed',
    'cooldown_skipped',
    'retry_started', 'retry_completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automation_step_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.automation_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.automation_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step_name public.automation_step_name NOT NULL,
  status public.automation_step_status NOT NULL DEFAULT 'running',
  application_id uuid,
  job_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_run_steps_run ON public.automation_run_steps (run_id, started_at);
CREATE INDEX IF NOT EXISTS idx_run_steps_user ON public.automation_run_steps (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_run_steps_status ON public.automation_run_steps (status);

ALTER TABLE public.automation_run_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own steps" ON public.automation_run_steps;
CREATE POLICY "Users view own steps" ON public.automation_run_steps
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all steps" ON public.automation_run_steps;
CREATE POLICY "Admins view all steps" ON public.automation_run_steps
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== FAILURES =====
CREATE TABLE IF NOT EXISTS public.automation_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.automation_run_steps(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  application_id uuid,
  step_name public.automation_step_name,
  error_code text NOT NULL,
  error_message text NOT NULL,
  retryable boolean NOT NULL DEFAULT false,
  retry_count integer NOT NULL DEFAULT 0,
  dead_lettered boolean NOT NULL DEFAULT false,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failures_user_time ON public.automation_failures (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_failures_code ON public.automation_failures (error_code, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_failures_dead_letter ON public.automation_failures (dead_lettered) WHERE dead_lettered = true;

ALTER TABLE public.automation_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own failures" ON public.automation_failures;
CREATE POLICY "Users view own failures" ON public.automation_failures
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all failures" ON public.automation_failures;
CREATE POLICY "Admins view all failures" ON public.automation_failures
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== SYSTEM SETTINGS (typed + audited) =====
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('integer','number','boolean','string','json')),
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','user','feature_flag')),
  description text,
  min_value numeric,
  max_value numeric,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read settings" ON public.system_settings;
CREATE POLICY "Authenticated read settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins write settings" ON public.system_settings;
CREATE POLICY "Admins write settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Audit log (append-only, admins read)
CREATE TABLE IF NOT EXISTS public.system_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  changed_by uuid,
  old_value jsonb,
  new_value jsonb,
  operation text NOT NULL CHECK (operation IN ('insert','update','delete')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read settings audit" ON public.system_settings_audit;
CREATE POLICY "Admins read settings audit" ON public.system_settings_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.system_settings_audit(setting_key, changed_by, old_value, new_value, operation)
    VALUES (NEW.key, NEW.updated_by, NULL, NEW.value, 'insert');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.value IS DISTINCT FROM NEW.value THEN
      INSERT INTO public.system_settings_audit(setting_key, changed_by, old_value, new_value, operation)
      VALUES (NEW.key, NEW.updated_by, OLD.value, NEW.value, 'update');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.system_settings_audit(setting_key, changed_by, old_value, new_value, operation)
    VALUES (OLD.key, OLD.updated_by, OLD.value, NULL, 'delete');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_settings_audit ON public.system_settings;
CREATE TRIGGER trg_system_settings_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.record_settings_change();

-- Seed safe defaults
INSERT INTO public.system_settings (key, value, value_type, scope, description, min_value, max_value) VALUES
  ('automation.cooldown_days_default', '30'::jsonb, 'integer', 'global', 'Default per-company cooldown window in days', 1, 365),
  ('automation.max_apps_per_company_default', '1'::jsonb, 'integer', 'global', 'Default cap on apps per company within cooldown', 1, 20),
  ('automation.retry_max_attempts', '5'::jsonb, 'integer', 'global', 'Hard ceiling on retry attempts per application', 0, 10),
  ('automation.retry_backoff_base_ms', '2000'::jsonb, 'integer', 'global', 'Exponential backoff base for retries (ms)', 500, 60000),
  ('automation.daily_application_cap', '25'::jsonb, 'integer', 'global', 'Default per-user daily application cap', 1, 200),
  ('cv.parser_confidence_threshold', '0.6'::jsonb, 'number', 'global', 'Minimum AI confidence to auto-accept a parsed field', 0, 1)
ON CONFLICT (key) DO NOTHING;

-- ===== APPLICATIONS: delivery verification + retry tracking =====
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS delivery_provider text,
  ADD COLUMN IF NOT EXISTS delivery_provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_retry_reason text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE INDEX IF NOT EXISTS idx_apps_next_retry ON public.applications (next_retry_at) WHERE next_retry_at IS NOT NULL AND dead_lettered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apps_correlation ON public.applications (correlation_id);

-- Status transition guard: enforce monotonic forward motion
CREATE OR REPLACE FUNCTION public.guard_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_rank int;
  new_rank int;
  terminal_old boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Rank forward-progress statuses; non-listed statuses (failed, retrying, manual_action_required, withdrawn, rejected, interview, offer)
  -- are allowed transitions from any state.
  old_rank := CASE OLD.status
    WHEN 'pending' THEN 0
    WHEN 'queued' THEN 1
    WHEN 'preparing' THEN 2
    WHEN 'submitted' THEN 3
    WHEN 'delivered' THEN 4
    WHEN 'responded' THEN 5
    ELSE -1
  END;

  new_rank := CASE NEW.status
    WHEN 'pending' THEN 0
    WHEN 'queued' THEN 1
    WHEN 'preparing' THEN 2
    WHEN 'submitted' THEN 3
    WHEN 'delivered' THEN 4
    WHEN 'responded' THEN 5
    ELSE -1
  END;

  -- Never allow regressing within the forward lifecycle (e.g. delivered → submitted)
  IF old_rank >= 0 AND new_rank >= 0 AND new_rank < old_rank THEN
    RAISE EXCEPTION 'Illegal application status regression: % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Terminal states cannot move except into 'responded'/'interview'/'offer'/'rejected'/'withdrawn'
  terminal_old := OLD.status IN ('responded','interview','offer','rejected','withdrawn');
  IF terminal_old AND NEW.status NOT IN ('responded','interview','offer','rejected','withdrawn') THEN
    RAISE EXCEPTION 'Illegal transition from terminal status %: cannot move to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_app_status ON public.applications;
CREATE TRIGGER trg_guard_app_status
  BEFORE UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.guard_application_status_transition();

-- ===== Helper: increment counters on a run atomically =====
CREATE OR REPLACE FUNCTION public.increment_run_counter(
  p_run_id uuid,
  p_field text,
  p_delta integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_field NOT IN ('jobs_discovered','jobs_matched','applications_attempted','applications_succeeded','applications_failed') THEN
    RAISE EXCEPTION 'Invalid run counter field: %', p_field;
  END IF;
  EXECUTE format('UPDATE public.automation_runs SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2', p_field, p_field)
    USING p_delta, p_run_id;
END;
$$;

-- Restrict execute on internal helpers
REVOKE EXECUTE ON FUNCTION public.increment_run_counter(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_settings_change() FROM PUBLIC, anon, authenticated;