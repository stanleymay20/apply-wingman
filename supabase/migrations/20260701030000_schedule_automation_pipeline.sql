-- Schedule the three automation edge functions using pg_cron + pg_net.
--
-- PREREQUISITE (run once in Supabase SQL editor before applying this migration):
--   select vault.create_secret(
--     '<your service role key from Supabase → Project Settings → API>',
--     'service_role_key',
--     'Service role key for pg_cron → edge function calls'
--   );
--
-- The service role key is never stored in this file. It is read at runtime
-- from Supabase Vault via `vault.decrypted_secrets`.

-- Remove any stale schedules from previous attempts before re-creating
select cron.unschedule('scheduled-automation')     where exists (select 1 from cron.job where jobname = 'scheduled-automation');
select cron.unschedule('drain-pending-applications') where exists (select 1 from cron.job where jobname = 'drain-pending-applications');
select cron.unschedule('process-retries')           where exists (select 1 from cron.job where jobname = 'process-retries');

-- 1. Main pipeline: discover jobs + auto-apply (every 15 minutes)
select cron.schedule(
  'scheduled-automation',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://jlsoiujwcjgmvijcmvas.supabase.co/functions/v1/scheduled-automation',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from   vault.decrypted_secrets
        where  name = 'service_role_key'
        limit  1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- 2. Drain stuck pending applications (every 10 minutes)
select cron.schedule(
  'drain-pending-applications',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://jlsoiujwcjgmvijcmvas.supabase.co/functions/v1/drain-pending-applications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from   vault.decrypted_secrets
        where  name = 'service_role_key'
        limit  1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- 3. Retry transient failures (every 15 minutes, offset by 7 min so it runs between main pipeline ticks)
select cron.schedule(
  'process-retries',
  '7-59/15 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://jlsoiujwcjgmvijcmvas.supabase.co/functions/v1/process-retries',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from   vault.decrypted_secrets
        where  name = 'service_role_key'
        limit  1
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
