-- Add high_match_job to allowed notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['interview'::text, 'rejection'::text, 'offer'::text, 'error'::text, 'daily_summary'::text, 'system'::text, 'high_match_job'::text]));