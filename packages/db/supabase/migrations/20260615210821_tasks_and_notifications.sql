-- T10 · Tasks (per company/period/department, with handoff) + in-app notifications.
-- Staff are scoped to their departments (PLANEJAMENTO §2): owner/manager see all,
-- staff see only tasks in departments they belong to. Handoff creates the next
-- department's task — a cross-department write that can't go through the staff
-- user's RLS, so it lives in the SECURITY DEFINER handoff_task RPC. Idempotent.

-- Caller is an owner/manager (reads the JWT role; not a table lookup).
create or replace function public.is_firm_manager()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('owner', 'manager');
$$;

-- The caller's departments. SECURITY DEFINER so it reads user_departments without
-- recursing through that table's RLS (cf. the current_firm_id note in T3 RLS).
create or replace function public.auth_user_departments()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(department), '{}')
  from public.user_departments
  where user_id = auth.uid() and firm_id = public.current_firm_id();
$$;
revoke execute on function public.auth_user_departments() from public, anon;
grant execute on function public.auth_user_departments() to authenticated;

-- tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid not null,
  period text, -- competência 'YYYY-MM' (null for ad-hoc tasks)
  department text not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'canceled')),
  assignee_id uuid references public.users(id) on delete set null,
  recurring_task_id uuid, -- set by the recurrence engine (T11); no FK yet
  handoff_to text, -- department this task hands off to on completion
  source_task_id uuid references public.tasks(id) on delete set null, -- task that handed off into this one
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- firm-consistent company link (golden rule #1): can't point at another firm's company.
  foreign key (firm_id, company_id) references public.companies(firm_id, id) on delete cascade
);
create index if not exists tasks_firm_status_idx on public.tasks (firm_id, status);
create index if not exists tasks_firm_assignee_idx on public.tasks (firm_id, assignee_id);
create index if not exists tasks_firm_department_idx on public.tasks (firm_id, department);
create index if not exists tasks_firm_company_idx on public.tasks (firm_id, company_id);

-- notifications (in-app). Targeted to a user, or to a department (user_id null).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  department text,
  kind text not null,
  title text not null,
  body text,
  entity text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notifications_firm_created_idx on public.notifications (firm_id, created_at desc);

drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.notifications;
create trigger set_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();

-- RLS
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
grant select, insert, update on public.tasks to authenticated;
grant select on public.notifications to authenticated;

-- tasks: firm + (manager OR the task's department is one of mine).
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    and (public.is_firm_manager() or department = any (public.auth_user_departments()))
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and (public.is_firm_manager() or department = any (public.auth_user_departments()))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and (public.is_firm_manager() or department = any (public.auth_user_departments()))
  )
  with check (
    firm_id = public.current_firm_id()
    and (public.is_firm_manager() or department = any (public.auth_user_departments()))
  );

-- notifications: addressed to me, or to my department (manager sees all firm-wide).
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    and (
      user_id = auth.uid()
      or (
        user_id is null
        and (public.is_firm_manager() or department = any (public.auth_user_departments()))
      )
    )
  );

-- handoff_task: complete a task and create the next department's task. SECURITY
-- DEFINER so the cross-department insert + notification bypass the per-department
-- write RLS, while the caller is still confined to tasks they can act on.
create or replace function public.handoff_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_task public.tasks%rowtype;
  v_new_id uuid;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
    and firm_id = v_firm
    and (public.is_firm_manager() or department = any (public.auth_user_departments()))
    and status in ('pending', 'in_progress')
    and handoff_to is not null;
  if not found then
    raise exception 'task not found, not open, or has no handoff target';
  end if;

  update public.tasks set status = 'done' where id = p_task_id;

  insert into public.tasks (firm_id, company_id, period, department, title, status, source_task_id)
  values (v_firm, v_task.company_id, v_task.period, v_task.handoff_to, v_task.title, 'pending', p_task_id)
  returning id into v_new_id;

  insert into public.notifications (firm_id, department, kind, title, body, entity, entity_id)
  values (v_firm, v_task.handoff_to, 'handoff', 'Nova tarefa recebida', v_task.title, 'task', v_new_id);

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'task.handed_off', 'task', p_task_id,
          jsonb_build_object('to_department', v_task.handoff_to, 'new_task_id', v_new_id));

  return v_new_id;
end;
$$;
revoke execute on function public.handoff_task(uuid) from public, anon;
grant execute on function public.handoff_task(uuid) to authenticated;

-- mark_notification_read: scoped to a notification the caller can see.
create or replace function public.mark_notification_read(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  update public.notifications
  set read_at = now()
  where id = p_id
    and firm_id = v_firm
    and read_at is null
    and (
      user_id = auth.uid()
      or (
        user_id is null
        and (public.is_firm_manager() or department = any (public.auth_user_departments()))
      )
    );
end;
$$;
revoke execute on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
