-- Fix notifications check constraint to include jobs_discovered type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('application_status', 'interview_scheduled', 'job_match', 'system', 'high_match_job', 'jobs_discovered'));