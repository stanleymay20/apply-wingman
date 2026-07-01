-- Adds server-side tailored-CV storage to applications.
-- tailor-cv-for-job edge function writes tailored text + PDF URL here after generation.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS tailored_cv_text        TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tailored_cv_pdf_url     TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tailored_cv_generated_at TIMESTAMPTZ  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tailored_cv_keywords    TEXT[]        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tailored_cv_changes     TEXT[]        DEFAULT NULL;

-- Index for quickly finding applications that still need tailoring
CREATE INDEX IF NOT EXISTS idx_applications_tailored_cv
  ON public.applications (user_id, tailored_cv_generated_at)
  WHERE tailored_cv_generated_at IS NULL AND status = 'pending';

COMMENT ON COLUMN public.applications.tailored_cv_text IS
  'Full tailored resume text produced by tailor-cv-for-job edge function';
COMMENT ON COLUMN public.applications.tailored_cv_pdf_url IS
  'Supabase Storage URL of the generated PDF for this application';
COMMENT ON COLUMN public.applications.tailored_cv_generated_at IS
  'Timestamp when the tailored CV was last generated; NULL = not yet generated';
