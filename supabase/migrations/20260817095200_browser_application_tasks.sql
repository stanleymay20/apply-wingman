-- Browser worker queue for ATS applications that cannot be submitted from
-- Supabase Edge Functions. The existing auto-apply function truthfully marks
-- these as manual_action_required; this trigger upgrades supported public ATS
-- handoffs into leased background work without changing that truth until a
-- browser worker can verify submission.

create table if not exists public.browser_application_tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  adapter text not null check (adapter in ('greenhouse', 'lever')),
  source_url text not null,
  source_platform text,
  status text not null default 'pending'
    check (status in ('pending', 'leased', 'succeeded', 'manual_action_required', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  worker_id text,
  leased_at timestamptz,
  lease_expires_at timestamptz,
  last_error text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists browser_application_tasks_claim_idx
  on public.browser_application_tasks(status, lease_expires_at, created_at)
  where status in ('pending', 'leased');

create index if not exists browser_application_tasks_user_idx
  on public.browser_application_tasks(user_id, created_at desc);

alter table public.browser_application_tasks enable row level security;

-- Users may inspect their own worker state from the app, but only the service
-- role is allowed to mutate queue rows.
drop policy if exists "Users can view own browser application tasks" on public.browser_application_tasks;
create policy "Users can view own browser application tasks"
  on public.browser_application_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.enqueue_browser_application_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_url text;
  v_source_platform text;
  v_adapter text;
begin
  -- Only consume ATS handoffs produced by auto-apply. Email delivery and truly
  -- manual applications are deliberately excluded.
  if new.status is distinct from 'manual_action_required'
     or coalesce(new.application_method, '') <> 'form_submit' then
    return new;
  end if;

  select j.source_url, j.source_platform
    into v_source_url, v_source_platform
  from public.jobs j
  where j.id = new.job_id;

  if v_source_url is null then
    return new;
  end if;

  if lower(v_source_url) ~ '(greenhouse\.io|boards\.greenhouse)' then
    v_adapter := 'greenhouse';
  elsif lower(v_source_url) ~ 'lever\.co/' then
    v_adapter := 'lever';
  else
    -- Workday, LinkedIn and unknown systems remain manual until a dedicated,
    -- compliant adapter exists.
    return new;
  end if;

  insert into public.browser_application_tasks (
    application_id,
    user_id,
    job_id,
    adapter,
    source_url,
    source_platform,
    status
  ) values (
    new.id,
    new.user_id,
    new.job_id,
    v_adapter,
    v_source_url,
    v_source_platform,
    'pending'
  )
  on conflict (application_id) do update
    set adapter = excluded.adapter,
        source_url = excluded.source_url,
        source_platform = excluded.source_platform,
        status = case
          when public.browser_application_tasks.status = 'succeeded' then 'succeeded'
          when public.browser_application_tasks.status = 'leased'
               and public.browser_application_tasks.lease_expires_at > now() then 'leased'
          else 'pending'
        end,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.enqueue_browser_application_task() from public;

drop trigger if exists applications_enqueue_browser_worker on public.applications;
create trigger applications_enqueue_browser_worker
after insert or update of status, application_method
on public.applications
for each row
execute function public.enqueue_browser_application_task();

-- Atomic lease acquisition. FOR UPDATE SKIP LOCKED prevents two scheduled
-- workers from claiming the same application.
create or replace function public.claim_browser_application_task(
  p_worker_id text,
  p_lease_minutes integer default 10
)
returns setof public.browser_application_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select t.id
    into v_id
  from public.browser_application_tasks t
  where (
      t.status = 'pending'
      or (t.status = 'leased' and t.lease_expires_at < now())
    )
    and t.attempts < t.max_attempts
  order by t.created_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
  update public.browser_application_tasks t
     set status = 'leased',
         attempts = t.attempts + 1,
         worker_id = p_worker_id,
         leased_at = now(),
         lease_expires_at = now() + make_interval(mins => greatest(1, least(coalesce(p_lease_minutes, 10), 60))),
         updated_at = now()
   where t.id = v_id
  returning t.*;
end;
$$;

revoke all on function public.claim_browser_application_task(text, integer) from public, anon, authenticated;
grant execute on function public.claim_browser_application_task(text, integer) to service_role;
