-- =====================================================
-- APPLYPILOT ENTERPRISE DATABASE SCHEMA
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER PROFILES TABLE
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  location TEXT,
  visa_required BOOLEAN DEFAULT false,
  preferred_locations TEXT[] DEFAULT ARRAY['Germany', 'EU', 'Remote'],
  preferred_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  daily_application_cap INTEGER DEFAULT 50,
  minimum_fit_score INTEGER DEFAULT 70,
  notifications_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  manual_approval_mode BOOLEAN DEFAULT false,
  automation_status TEXT DEFAULT 'paused' CHECK (automation_status IN ('running', 'paused', 'stopped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- CV/RESUME DATA TABLE
-- =====================================================
CREATE TABLE public.cv_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cv_file_url TEXT,
  cv_file_name TEXT,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  experience_years INTEGER DEFAULT 0,
  seniority_level TEXT,
  languages TEXT[] DEFAULT ARRAY[]::TEXT[],
  education JSONB DEFAULT '[]'::jsonb,
  work_history JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_parsed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cv_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own CV profiles" ON public.cv_profiles
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- JOBS TABLE
-- =====================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo_url TEXT,
  location TEXT,
  job_type TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'EUR',
  description TEXT,
  requirements TEXT[],
  benefits TEXT[],
  source_platform TEXT NOT NULL CHECK (source_platform IN ('linkedin', 'indeed', 'greenhouse', 'lever', 'company_website', 'other')),
  source_url TEXT NOT NULL,
  external_id TEXT,
  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_remote BOOLEAN DEFAULT false,
  visa_sponsorship BOOLEAN DEFAULT false,
  match_score INTEGER,
  match_details JSONB,
  status TEXT DEFAULT 'discovered' CHECK (status IN ('discovered', 'queued', 'applied', 'rejected', 'interview', 'offer', 'withdrawn', 'expired', 'blacklisted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own jobs" ON public.jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_jobs_user_status ON public.jobs(user_id, status);
CREATE INDEX idx_jobs_user_score ON public.jobs(user_id, match_score DESC);
CREATE INDEX idx_jobs_created ON public.jobs(created_at DESC);

-- =====================================================
-- APPLICATIONS TABLE
-- =====================================================
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cv_profile_id UUID REFERENCES public.cv_profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'failed', 'interview', 'rejected', 'offer', 'withdrawn')),
  application_method TEXT CHECK (application_method IN ('easy_apply', 'form_submit', 'email', 'manual')),
  cover_letter TEXT,
  custom_responses JSONB DEFAULT '{}'::jsonb,
  match_score INTEGER NOT NULL,
  applied_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  notes TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own applications" ON public.applications
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_applications_user_status ON public.applications(user_id, status);
CREATE INDEX idx_applications_date ON public.applications(applied_at DESC);

-- =====================================================
-- APPLICATION LOGS TABLE
-- =====================================================
CREATE TABLE public.application_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  level TEXT DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error', 'success')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.application_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON public.application_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_logs_user_date ON public.application_logs(user_id, created_at DESC);

-- =====================================================
-- DAILY STATS TABLE
-- =====================================================
CREATE TABLE public.daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  applications_sent INTEGER DEFAULT 0,
  applications_successful INTEGER DEFAULT 0,
  applications_failed INTEGER DEFAULT 0,
  interviews_received INTEGER DEFAULT 0,
  rejections_received INTEGER DEFAULT 0,
  jobs_discovered INTEGER DEFAULT 0,
  jobs_matched INTEGER DEFAULT 0,
  average_match_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stats" ON public.daily_stats
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- PLATFORM BLACKLIST TABLE
-- =====================================================
CREATE TABLE public.platform_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blacklist" ON public.platform_blacklist
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('interview', 'rejection', 'offer', 'error', 'daily_summary', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- =====================================================
-- TRIGGER: Auto-create profile on user signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_cv_profiles_updated_at
  BEFORE UPDATE ON public.cv_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_daily_stats_updated_at
  BEFORE UPDATE ON public.daily_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- FUNCTION: Get today's application count
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_today_application_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.applications
  WHERE user_id = p_user_id
    AND applied_at >= CURRENT_DATE
    AND applied_at < CURRENT_DATE + INTERVAL '1 day'
    AND status IN ('submitted', 'interview', 'offer');
$$;

-- =====================================================
-- FUNCTION: Update daily stats
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_daily_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_stats (user_id, date, applications_sent)
  VALUES (NEW.user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET 
    applications_sent = daily_stats.applications_sent + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_application_submitted
  AFTER INSERT ON public.applications
  FOR EACH ROW
  WHEN (NEW.status = 'submitted')
  EXECUTE FUNCTION public.update_daily_stats();