-- Fix notifications check constraint to include all notification types used by the system
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'application_status', 
  'interview_scheduled', 
  'job_match', 
  'system', 
  'high_match_job', 
  'jobs_discovered',
  'application_sent',
  'application_failed'
));