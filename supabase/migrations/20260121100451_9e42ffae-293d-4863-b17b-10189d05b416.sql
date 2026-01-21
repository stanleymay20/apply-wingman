-- Fix RLS policies to be PERMISSIVE (standard behavior)
-- Currently they are RESTRICTIVE which works differently

-- ========================================
-- profiles table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- ========================================
-- application_emails table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can view their own application emails" ON public.application_emails;
DROP POLICY IF EXISTS "Users can insert their own application emails" ON public.application_emails;
DROP POLICY IF EXISTS "Users can update their own application emails" ON public.application_emails;
DROP POLICY IF EXISTS "Users can delete their own application emails" ON public.application_emails;

CREATE POLICY "Users can view their own application emails"
ON public.application_emails FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own application emails"
ON public.application_emails FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own application emails"
ON public.application_emails FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own application emails"
ON public.application_emails FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- referral_emails table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can view their own referral emails" ON public.referral_emails;
DROP POLICY IF EXISTS "Users can create their own referral emails" ON public.referral_emails;
DROP POLICY IF EXISTS "Users can update their own referral emails" ON public.referral_emails;
DROP POLICY IF EXISTS "Users can delete their own referral emails" ON public.referral_emails;

CREATE POLICY "Users can view their own referral emails"
ON public.referral_emails FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral emails"
ON public.referral_emails FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral emails"
ON public.referral_emails FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own referral emails"
ON public.referral_emails FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- cv_profiles table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own CV profiles" ON public.cv_profiles;

CREATE POLICY "Users can view own CV profiles"
ON public.cv_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own CV profiles"
ON public.cv_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own CV profiles"
ON public.cv_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own CV profiles"
ON public.cv_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- applications table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own applications" ON public.applications;

CREATE POLICY "Users can view own applications"
ON public.applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
ON public.applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
ON public.applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
ON public.applications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- jobs table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own jobs" ON public.jobs;

CREATE POLICY "Users can view own jobs"
ON public.jobs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
ON public.jobs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
ON public.jobs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
ON public.jobs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- daily_stats table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own stats" ON public.daily_stats;

CREATE POLICY "Users can view own stats"
ON public.daily_stats FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
ON public.daily_stats FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
ON public.daily_stats FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stats"
ON public.daily_stats FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- job_discovery_runs table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can view their own job discovery runs" ON public.job_discovery_runs;
DROP POLICY IF EXISTS "Users can create their own job discovery runs" ON public.job_discovery_runs;
DROP POLICY IF EXISTS "Users can update their own job discovery runs" ON public.job_discovery_runs;

CREATE POLICY "Users can view their own job discovery runs"
ON public.job_discovery_runs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own job discovery runs"
ON public.job_discovery_runs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job discovery runs"
ON public.job_discovery_runs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job discovery runs"
ON public.job_discovery_runs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- saved_searches table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own saved searches" ON public.saved_searches;

CREATE POLICY "Users can view own saved searches"
ON public.saved_searches FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches"
ON public.saved_searches FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches"
ON public.saved_searches FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches"
ON public.saved_searches FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- auto_apply_schedules table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can view their own auto-apply schedules" ON public.auto_apply_schedules;
DROP POLICY IF EXISTS "Users can create their own auto-apply schedules" ON public.auto_apply_schedules;
DROP POLICY IF EXISTS "Users can update their own auto-apply schedules" ON public.auto_apply_schedules;
DROP POLICY IF EXISTS "Users can delete their own auto-apply schedules" ON public.auto_apply_schedules;

CREATE POLICY "Users can view their own auto-apply schedules"
ON public.auto_apply_schedules FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own auto-apply schedules"
ON public.auto_apply_schedules FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto-apply schedules"
ON public.auto_apply_schedules FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto-apply schedules"
ON public.auto_apply_schedules FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- notifications table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- platform_blacklist table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can manage own blacklist" ON public.platform_blacklist;

CREATE POLICY "Users can view own blacklist"
ON public.platform_blacklist FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blacklist"
ON public.platform_blacklist FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blacklist"
ON public.platform_blacklist FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blacklist"
ON public.platform_blacklist FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ========================================
-- application_logs table - recreate policies as PERMISSIVE
-- ========================================
DROP POLICY IF EXISTS "Users can view own logs" ON public.application_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.application_logs;

CREATE POLICY "Users can view own logs"
ON public.application_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs"
ON public.application_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);