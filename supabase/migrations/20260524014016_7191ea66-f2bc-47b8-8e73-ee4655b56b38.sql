UPDATE public.applications
SET status = 'failed',
    error_code = 'stale_pending_backlog',
    error_message = 'Application sat in pending before the drain worker was scheduled; cleared during Phase 3 cleanup.',
    last_failure_at = now(),
    first_failure_at = COALESCE(first_failure_at, now()),
    dead_lettered_at = now(),
    next_retry_at = NULL,
    updated_at = now()
WHERE status = 'pending'
  AND created_at < now() - interval '7 days';