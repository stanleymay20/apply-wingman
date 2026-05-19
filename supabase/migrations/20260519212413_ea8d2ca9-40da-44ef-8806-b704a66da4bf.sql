
-- Relax status check to allow new lifecycle states
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_status_check
  CHECK (status = ANY (ARRAY[
    'pending','queued','preparing','submitted','delivered','responded',
    'failed','retrying','manual_action_required',
    'interview','rejected','offer','withdrawn'
  ]));

-- Recruiter safety user preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_cooldown_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_apps_per_company integer NOT NULL DEFAULT 1;

-- Helper: count recent applications to a company for a user
CREATE OR REPLACE FUNCTION public.recent_applications_to_company(
  p_user_id uuid,
  p_company text,
  p_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.applications a
  JOIN public.jobs j ON j.id = a.job_id
  WHERE a.user_id = p_user_id
    AND lower(j.company) = lower(p_company)
    AND a.created_at >= now() - (p_days || ' days')::interval
    AND a.status <> 'failed';
$$;

REVOKE EXECUTE ON FUNCTION public.recent_applications_to_company(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_applications_to_company(uuid, text, integer) TO authenticated, service_role;
