-- T3 · Base schema: firms, users (profile over auth.users), user_departments,
-- audit_events. Multi-tenant-ready — firm_id on every domain table (golden rule
-- #1). RLS is enabled in the next migration. Idempotent.

-- Touch updated_at on every UPDATE. Shared by all domain tables.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- firms — the tenant root. firms.id IS the firm_id referenced everywhere else.
create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- users — profile over auth.users. id deliberately mirrors auth.users(id)
-- (1:1 profile), not gen_random_uuid() like other tables.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists users_firm_id_idx on public.users (firm_id);

-- user_departments — staff are scoped to their departments; owner/manager access
-- all departments (no rows required for them). department is a config-driven key.
create table if not exists public.user_departments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  department text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, user_id, department)
);
create index if not exists user_departments_firm_user_idx
  on public.user_departments (firm_id, user_id);

-- audit_events — every relevant action (human or robot). actor_id null = robot/system.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists audit_events_firm_created_idx
  on public.audit_events (firm_id, created_at desc);
create index if not exists audit_events_firm_entity_idx
  on public.audit_events (firm_id, entity, entity_id);

-- updated_at triggers
drop trigger if exists set_updated_at on public.firms;
create trigger set_updated_at before update on public.firms
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.user_departments;
create trigger set_updated_at before update on public.user_departments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.audit_events;
create trigger set_updated_at before update on public.audit_events
  for each row execute function public.set_updated_at();
