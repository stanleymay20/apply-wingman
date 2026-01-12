-- Add profile_name field to cv_profiles to support multiple named profiles
ALTER TABLE public.cv_profiles 
ADD COLUMN IF NOT EXISTS profile_name TEXT DEFAULT 'Default';

-- Add resume_score and ats_suggestions to cv_profiles
ALTER TABLE public.cv_profiles
ADD COLUMN IF NOT EXISTS resume_score INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ats_suggestions JSONB DEFAULT NULL;

-- Create referral_emails table
CREATE TABLE IF NOT EXISTS public.referral_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_title TEXT,
  company TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on referral_emails
ALTER TABLE public.referral_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_emails
CREATE POLICY "Users can view their own referral emails"
ON public.referral_emails FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral emails"
ON public.referral_emails FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral emails"
ON public.referral_emails FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own referral emails"
ON public.referral_emails FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on referral_emails
CREATE TRIGGER update_referral_emails_updated_at
  BEFORE UPDATE ON public.referral_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();