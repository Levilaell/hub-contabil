-- T11 · Recurring task templates. The recurrences-monthly cron generates each
-- period's tasks from active templates (PLANEJAMENTO §3 — monthly on day 1).
-- generation_day is stored but advisory in v1 (tasks have no due_date yet).
-- Idempotency for the generator is guarded by a partial unique index on tasks.
-- Idempotent.

create table if not exists public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  title text not null,
  department text not null,
  generation_day int not null default 1 check (generation_day between 1 and 28),
  target_kind text not null check (target_kind in ('all', 'selection', 'by_regime')),
  -- selection → { "companyIds": [uuid...] }; by_regime → { "regimes": [key...] }; all → {}
  target_value jsonb not null default '{}'::jsonb,
  handoff_to text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_tasks_firm_active_idx on public.recurring_tasks (firm_id, active);

drop trigger if exists set_updated_at on public.recurring_tasks;
create trigger set_updated_at before update on public.recurring_tasks
  for each row execute function public.set_updated_at();

-- Link generated tasks back to their template; null on template delete (keeps the
-- generated tasks, just unlinks them).
alter table public.tasks drop constraint if exists tasks_recurring_task_id_fkey;
alter table public.tasks
  add constraint tasks_recurring_task_id_fkey
  foreign key (recurring_task_id) references public.recurring_tasks(id) on delete set null;

-- Idempotency guard: one generated task per (template, company, period). Partial so
-- ad-hoc tasks (null recurring_task_id) are unconstrained.
create unique index if not exists tasks_recurrence_period_uniq
  on public.tasks (recurring_task_id, company_id, period)
  where recurring_task_id is not null;

-- RLS: read within the firm; only owner/manager manage templates (admin-ish).
alter table public.recurring_tasks enable row level security;
grant select, insert, update, delete on public.recurring_tasks to authenticated;

drop policy if exists recurring_tasks_select on public.recurring_tasks;
create policy recurring_tasks_select on public.recurring_tasks
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists recurring_tasks_write on public.recurring_tasks;
create policy recurring_tasks_write on public.recurring_tasks
  for all to authenticated
  using (firm_id = public.current_firm_id() and public.is_firm_manager())
  with check (firm_id = public.current_firm_id() and public.is_firm_manager());
