-- =====================================================================
-- 1) Restrict EXECUTE on SECURITY DEFINER functions
--    Trigger-only and service-role-only functions should not be callable
--    via the API by anon/authenticated users.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.recent_applications_to_company(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_daily_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_run_counter(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_settings_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_auto_apply_schedule_on_run() FROM PUBLIC, anon, authenticated;

-- has_role is referenced inside RLS policies, so signed-in users must keep
-- EXECUTE on it. Only remove the anonymous role's ability to call it.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- =====================================================================
-- 2) Prevent privilege escalation on user_roles.
--    A RESTRICTIVE policy is ANDed with every permissive policy, so no
--    current or future permissive path can let a non-admin insert/modify
--    role rows (e.g. granting themselves 'admin').
-- =====================================================================
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can modify roles" ON public.user_roles;
CREATE POLICY "Only admins can modify roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 3) cv-files storage policies must apply to authenticated users only.
--    Re-scope the existing 'public' role policies to 'authenticated'.
-- =====================================================================
DROP POLICY IF EXISTS "Users can view their own CV files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own CV files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own CV files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own CV files" ON storage.objects;

CREATE POLICY "Users can view their own CV files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cv-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own CV files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cv-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own CV files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'cv-files' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'cv-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own CV files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cv-files' AND (auth.uid())::text = (storage.foldername(name))[1]);