-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for applications table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;

-- Set full replica identity for complete row data
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;

-- Create storage bucket for CV files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cv-files',
  'cv-files', 
  false,
  5242880, -- 5MB limit
  ARRAY['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for cv-files bucket
CREATE POLICY "Users can upload their own CV files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cv-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own CV files"
ON storage.objects FOR SELECT
USING (bucket_id = 'cv-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own CV files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'cv-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own CV files"
ON storage.objects FOR DELETE
USING (bucket_id = 'cv-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add documents_required column to applications for document requests
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS documents_required text[] DEFAULT ARRAY[]::text[];

-- Add documents_uploaded column
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS documents_uploaded text[] DEFAULT ARRAY[]::text[];