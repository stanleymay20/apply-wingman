-- Resolve the Supabase security advisor warning "extension_in_public".
-- Earlier migrations ran CREATE EXTENSION without an explicit schema
-- (uuid-ossp in 20260112061550, pg_cron/pg_net in 20260204084536), which
-- installs them into public. Relocate every extension currently in public
-- into the standard `extensions` schema. Non-relocatable extensions (pg_net
-- does not support SET SCHEMA) are logged and left in place rather than
-- failing the migration.
--
-- Safe for existing objects: column defaults and policies reference
-- extension functions by OID, not by schema-qualified name, and Supabase's
-- default search_path already includes the extensions schema.

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
