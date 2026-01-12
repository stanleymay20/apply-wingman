-- Add email tracking fields to applications table
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS company_email_received boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS company_email_received_at timestamptz,
ADD COLUMN IF NOT EXISTS company_email_subject text,
ADD COLUMN IF NOT EXISTS company_email_snippet text,
ADD COLUMN IF NOT EXISTS application_contract jsonb;

-- Create table to track email responses
CREATE TABLE IF NOT EXISTS public.application_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  from_email text NOT NULL,
  subject text NOT NULL,
  snippet text,
  email_type text NOT NULL DEFAULT 'response', -- response, interview, rejection, offer
  is_automated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for application_emails
CREATE POLICY "Users can view their own application emails"
  ON public.application_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own application emails"
  ON public.application_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own application emails"
  ON public.application_emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own application emails"
  ON public.application_emails FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_application_emails_application_id 
  ON public.application_emails(application_id);
CREATE INDEX IF NOT EXISTS idx_application_emails_user_id 
  ON public.application_emails(user_id);