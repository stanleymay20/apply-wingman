UPDATE public.applications
SET status = 'manual_action_required',
    notes = COALESCE(NULLIF(notes, ''), '') ||
      CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
      '[cleanup ' || to_char(now(), 'YYYY-MM-DD') || '] Orphaned in "preparing" (no auto-submitter for ATS job); moved to manual_action_required.',
    error_message = COALESCE(error_message, 'Stalled in preparing: ATS job requires manual submission'),
    updated_at = now()
WHERE status = 'preparing';