-- Create saved_searches table
CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  locations TEXT[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own saved searches"
ON public.saved_searches
FOR ALL
USING (auth.uid() = user_id);

-- Add new settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS saved_search_frequency TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS bulk_apply_mode TEXT DEFAULT 'queue_links',
ADD COLUMN IF NOT EXISTS job_details_view TEXT DEFAULT 'drawer';

-- Trigger for updated_at
CREATE TRIGGER update_saved_searches_updated_at
BEFORE UPDATE ON public.saved_searches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();