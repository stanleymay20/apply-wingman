
-- Notification rules
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  status text,
  channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','both')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  enabled boolean NOT NULL DEFAULT true,
  template_title text NOT NULL,
  template_body text NOT NULL,
  cooldown_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, status)
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rules" ON public.notification_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write rules" ON public.notification_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER notification_rules_updated_at
  BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification events (ledger / cooldown source-of-truth)
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid,
  run_id uuid,
  event_type text NOT NULL,
  status text,
  severity text NOT NULL DEFAULT 'info',
  channel text NOT NULL DEFAULT 'in_app',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamptz,
  read_at timestamptz,
  delivery_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_events_user_created ON public.notification_events(user_id, created_at DESC);
CREATE INDEX idx_notif_events_dedup
  ON public.notification_events(user_id, event_type, application_id, created_at DESC);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own events" ON public.notification_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all events" ON public.notification_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Seed default rules
INSERT INTO public.notification_rules
  (event_type, status, channel, severity, template_title, template_body, cooldown_minutes)
VALUES
  ('lifecycle','delivered','in_app','success',
    'Application delivered',
    'Your application to {{company}} for {{job_title}} was delivered successfully.', 60),
  ('lifecycle','manual_action_required','in_app','warning',
    'Action needed',
    'Finish your application to {{company}} for {{job_title}} — manual step required.', 240),
  ('lifecycle','failed','in_app','error',
    'Application failed',
    'We could not submit your application to {{company}} for {{job_title}}. {{error_message}}', 30),
  ('lifecycle','retrying','in_app','warning',
    'Retrying application',
    'Retrying application to {{company}} for {{job_title}}. {{error_message}}', 120),
  ('lifecycle','responded','in_app','success',
    'Response received',
    '{{company}} responded to your application for {{job_title}}.', 0)
ON CONFLICT (event_type, status) DO NOTHING;
