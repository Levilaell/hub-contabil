-- T3 · Row Level Security: tenant isolation by firm_id (golden rule #1).
-- Idempotent. The worker uses the service role (BYPASSRLS) and MUST still filter
-- by firm_id in every query — RLS here protects the anon/authenticated path only.

-- The firm_id for the current request, read ONLY from the JWT (never a table
-- lookup — that would recurse through the users policy). app_metadata.firm_id is
-- set at user creation; the top-level fallback keeps a future custom-claim hook
-- compatible without rewriting policies.
create or replace function public.current_firm_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'firm_id', ''),
    nullif(auth.jwt() ->> 'firm_id', '')
  )::uuid;
$$;

alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.user_departments enable row level security;
alter table public.audit_events enable row level security;

-- Table privileges: RLS only gates rows AFTER the role has table access.
grant usage on schema public to authenticated;
grant select on public.firms to authenticated;
grant select on public.users to authenticated;
grant select on public.user_departments to authenticated;
grant select, insert on public.audit_events to authenticated;

-- firms — a user sees only their own firm.
drop policy if exists firms_select on public.firms;
create policy firms_select on public.firms
  for select to authenticated
  using (id = public.current_firm_id());

-- users — only profiles within the caller's firm.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- user_departments — only within the caller's firm.
drop policy if exists user_departments_select on public.user_departments;
create policy user_departments_select on public.user_departments
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- audit_events — read own firm; human actions from the web insert into own firm.
drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists audit_events_insert on public.audit_events;
create policy audit_events_insert on public.audit_events
  for insert to authenticated
  with check (firm_id = public.current_firm_id());
