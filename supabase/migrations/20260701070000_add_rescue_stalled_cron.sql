-- Adds the missing rescue-stalled-applications cron job.
-- The other automation jobs already run (scheduled-automation-15m, drain-pending-applications-5m,
-- process-retries-2m) with faster cadences than originally planned — leave them untouched.
-- This migration only schedules the one that was never created.

select cron.unschedule('rescue-stalled-applications')
  where exists (select 1 from cron.job where jobname = 'rescue-stalled-applications');

select cron.schedule(
  'rescue-stalled-applications',
  '3-59/10 * * * *',   -- every 10 min, offset +3 min from drain so they don't overlap
  $cron$
  select net.http_post(
    url     := 'https://jlsoiujwcjgmvijcmvas.supabase.co/functions/v1/rescue-stalled-applications',
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
