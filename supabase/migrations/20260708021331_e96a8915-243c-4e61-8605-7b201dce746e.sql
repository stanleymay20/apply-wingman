-- 20260708060000_fix_saved_search_keyword_typo.sql
UPDATE public.saved_searches
SET keywords = array_replace(keywords, 'AI Enginner', 'AI Engineer')
WHERE 'AI Enginner' = ANY(keywords)
  AND NOT ('AI Engineer' = ANY(keywords));

UPDATE public.saved_searches
SET keywords = array_remove(keywords, 'AI Enginner')
WHERE 'AI Enginner' = ANY(keywords);

-- 20260708060100_move_extensions_out_of_public.sql
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  ext RECORD;
BEGIN
  FOR ext IN
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext.extname);
      RAISE NOTICE 'Moved extension % to schema extensions', ext.extname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Extension % could not be relocated: %', ext.extname, SQLERRM;
    END;
  END LOOP;
END $$;