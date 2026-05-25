
CREATE OR REPLACE FUNCTION public.ensure_auto_apply_schedule_on_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.automation_status = 'running'
     AND (OLD.automation_status IS DISTINCT FROM 'running')
     AND NOT EXISTS (
       SELECT 1 FROM public.auto_apply_schedules
       WHERE user_id = NEW.id AND enabled = true
     )
  THEN
    INSERT INTO public.auto_apply_schedules
      (user_id, frequency, time_of_day, timezone, days_of_week, enabled)
    VALUES
      (NEW.id, 'daily', '09:00'::time, 'UTC',
       ARRAY[1,2,3,4,5]::integer[], true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_auto_apply_schedule ON public.profiles;
CREATE TRIGGER trg_ensure_auto_apply_schedule
AFTER UPDATE OF automation_status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_auto_apply_schedule_on_run();

INSERT INTO public.auto_apply_schedules
  (user_id, frequency, time_of_day, timezone, days_of_week, enabled)
SELECT p.id, 'daily', '09:00'::time, 'UTC',
       ARRAY[1,2,3,4,5]::integer[], true
FROM public.profiles p
WHERE p.automation_status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM public.auto_apply_schedules s
    WHERE s.user_id = p.id AND s.enabled = true
  );
