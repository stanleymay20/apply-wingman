-- Auto-apply schedules
create table if not exists public.auto_apply_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  frequency text not null, -- 'daily' | 'weekly'
  time_of_day time not null,
  timezone text not null default 'UTC',
  days_of_week int[] null, -- 0 (Sun) .. 6 (Sat) used when frequency='weekly'
  enabled boolean not null default true,
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auto_apply_schedules_frequency_check check (frequency in ('daily','weekly'))
);

create index if not exists idx_auto_apply_schedules_user on public.auto_apply_schedules(user_id);
create index if not exists idx_auto_apply_schedules_enabled on public.auto_apply_schedules(enabled);

alter table public.auto_apply_schedules enable row level security;

create policy "Users can view their own auto-apply schedules"
on public.auto_apply_schedules
for select
using (auth.uid() = user_id);

create policy "Users can create their own auto-apply schedules"
on public.auto_apply_schedules
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own auto-apply schedules"
on public.auto_apply_schedules
for update
using (auth.uid() = user_id);

create policy "Users can delete their own auto-apply schedules"
on public.auto_apply_schedules
for delete
using (auth.uid() = user_id);

-- updated_at trigger helper
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_auto_apply_schedules_updated_at on public.auto_apply_schedules;
create trigger trg_auto_apply_schedules_updated_at
before update on public.auto_apply_schedules
for each row execute function public.update_updated_at_column();
