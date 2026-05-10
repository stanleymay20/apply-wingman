
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'test',
  ADD COLUMN IF NOT EXISTS test_email_override text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_delivery_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_delivery_mode_check
  CHECK (delivery_mode IN ('test','production','disabled'));

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS original_recipient text,
  ADD COLUMN IF NOT EXISTS actual_recipient text,
  ADD COLUMN IF NOT EXISTS delivery_mode text;
