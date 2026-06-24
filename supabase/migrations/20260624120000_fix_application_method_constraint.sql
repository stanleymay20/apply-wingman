-- Fix application_method check constraint to include ats_api and assisted
-- The original constraint only allowed: easy_apply, form_submit, email, manual
-- The application code uses: email, ats_api, assisted
-- This migration drops the old constraint and adds a new one with all valid values

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_application_method_check;

  ALTER TABLE public.applications
    ADD CONSTRAINT applications_application_method_check
      CHECK (application_method IN (
          'easy_apply',
              'form_submit',
                  'email',
                      'manual',
                          'ats_api',
                              'assisted'
                                ));
