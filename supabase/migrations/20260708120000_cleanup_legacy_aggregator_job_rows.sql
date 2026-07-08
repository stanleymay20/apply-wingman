-- Remove legacy aggregator/search-result rows that were saved as "jobs"
-- before the aggregator filter shipped (e.g. title "Data Engineer jobs in
-- Remote", company "Unknown Company", source_url pointing at a listing page
-- that cannot be applied to). They inflate job counts and clutter the UI.
--
-- Note: these rows do NOT interfere with dedup of newly discovered jobs —
-- both insert paths (useJobDiscovery.ts and scheduled-automation) dedup on
-- source_url only, never on title/company — so this is purely data hygiene.
--
-- The URL/title patterns mirror isAggregatorPage() in
-- supabase/functions/discover-jobs/index.ts (JS \b becomes Postgres \y).
--
-- Safety guards:
--   * never touch a job with any application row: applications.job_id is
--     ON DELETE CASCADE, so deleting those jobs would erase application
--     history (application_logs for deleted junk rows cascade too, which is
--     intended);
--   * only 'discovered'/'queued' rows — statuses a user has progressed
--     (applied/interview/offer/...) are always kept;
--   * URL shapes of individual postings are exempted first, exactly like
--     the runtime filter.

DELETE FROM public.jobs j
WHERE j.status IN ('discovered', 'queued')
  AND NOT EXISTS (
    SELECT 1 FROM public.applications a WHERE a.job_id = j.id
  )
  -- keep anything shaped like an individual posting URL
  AND NOT (
       lower(j.source_url) ~ 'linkedin\.com/jobs/view/'
    OR lower(j.source_url) ~ 'indeed\.com/(viewjob|rc/clk|pagead/clk)'
    OR lower(j.source_url) ~ 'greenhouse\.io/[^/]+/jobs/\d+'
    OR lower(j.source_url) ~ 'jobs\.lever\.co/[^/]+/[0-9a-f][0-9a-f-]{7,}'
    OR lower(j.source_url) ~ 'myworkdayjobs\.com/.+/job/'
    OR lower(j.source_url) ~ 'jobs\.smartrecruiters\.com/[^/]+/\d+'
  )
  AND (
       lower(j.source_url) ~ 'linkedin\.com/jobs/?(\?|$)'
    OR lower(j.source_url) ~ 'linkedin\.com/jobs/search'
    OR lower(j.source_url) ~ 'linkedin\.com/jobs/[a-z0-9%+-]*-jobs[a-z0-9%+-]*/?(\?|$)'
    OR lower(j.source_url) ~ 'indeed\.com/(m/)?jobs(\.html)?(\?|$)'
    OR lower(j.source_url) ~ 'indeed\.com/q-[^/]*-jobs'
    OR lower(j.source_url) ~ 'indeed\.com/(browsejobs|career(/|\?|$)|cmp/[^/]+/jobs)'
    OR lower(j.source_url) ~ 'greenhouse\.io/[^/]+/?(\?|$)'
    OR lower(j.source_url) ~ 'jobs\.lever\.co/[^/]+/?(\?|$)'
    OR lower(j.source_url) ~ '/jobs/search(/|\?|$)'
    OR lower(j.source_url) ~ '/(search|browse|find)-?jobs?(/|\?|$)'
    OR j.title ~* '\d[\d,.]*\+?\s*(open\s+)?(jobs|positions|openings|vacancies)\y'
    OR j.title ~* '\yjobs\s+(in|near)\s+'
    OR j.title ~* '\yjobs?,\s*(employment|vacancies|careers)\y'
    OR j.title ~* '^\s*(top|best|latest|newest|browse|search|find)\y.*\y(jobs|openings|vacancies)\y'
  );
