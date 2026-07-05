
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS tailored_cv_text text,
  ADD COLUMN IF NOT EXISTS tailored_cv_pdf_url text,
  ADD COLUMN IF NOT EXISTS tailored_cv_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS tailored_cv_keywords text[],
  ADD COLUMN IF NOT EXISTS tailored_cv_changes text[];
