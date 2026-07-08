-- has_role() is referenced by RLS policies (e.g. the admin policy on user_roles,
-- evaluated on every SELECT). Its EXECUTE privilege was missing for authenticated,
-- causing "permission denied for function has_role" (HTTP 403) and breaking admin detection.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- Re-affirm table grants so authenticated users can read their own roles and
-- service_role (edge functions/admin code) retains full access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;