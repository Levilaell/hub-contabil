-- T6 · Company registry: companies + contacts. Multi-tenant-ready — firm_id on
-- every table (golden rule #1), RLS by firm_id. In v1 writes are open to any
-- authenticated user of the firm: which roles may manage the registry / onboard
-- clients is an unvalidated business policy (still open for T7 enrichment and T8
-- onboarding), so per rules #2/#8 it is NOT hardcoded here — role-gating, if the
-- firm wants it, lands as a later explicit migration (tightening RLS is trivial).
-- Companies are archived via status, never hard-deleted; contacts are removable.
-- Idempotent.

-- companies — the firm's clients. cnpj is the natural key, stored normalized
-- (14 digits, no mask); check-digit validation lives in @hub/core. tax_regime
-- holds a key from the firm config `taxRegimes` vocabulary (validated in @hub/db).
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  legal_name text not null,
  trade_name text,
  tax_regime text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  enrichment_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, cnpj)
);
create index if not exists companies_firm_status_idx on public.companies (firm_id, status);

-- contacts — people at a company. Cascade with the company; firm_id is duplicated
-- to keep the standard firm_id RLS predicate and (firm_id, …) indexing uniform.
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  preferred_channel text not null default 'email'
    check (preferred_channel in ('email', 'phone', 'whatsapp')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_firm_company_idx on public.contacts (firm_id, company_id);

-- updated_at triggers (shared set_updated_at from the base schema).
drop trigger if exists set_updated_at on public.companies;
create trigger set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.contacts;
create trigger set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Row Level Security: tenant isolation by firm_id (golden rule #1). The worker
-- uses the service role (BYPASSRLS) and MUST still filter by firm_id in every
-- query — these policies protect the anon/authenticated path only.
alter table public.companies enable row level security;
alter table public.contacts enable row level security;

-- Table privileges: RLS only gates rows AFTER the role has table access. Companies
-- have no DELETE grant (archive via status); contacts can be removed.
grant select, insert, update on public.companies to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;

-- companies — read/create/update within the caller's own firm.
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- contacts — full CRUD within the caller's own firm.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete to authenticated
  using (firm_id = public.current_firm_id());
