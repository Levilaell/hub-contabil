-- Fase 1.1 §1.1 · Extended company registry: optional cadastral fields the firm
-- asked to centralize (natureza jurídica, enquadramento/porte, inscrições, NIRE,
-- start dates, full address, capital social, CNAE) + company_partners (sócios).
-- Every new column is nullable — none is required to save (spec: "nenhum destes
-- é obrigatório"). Enrichment (T7) backfills what the public CNPJ APIs provide;
-- inscrições/NIRE/service start stay manual. Idempotent.

alter table public.companies
  add column if not exists legal_nature text,            -- natureza jurídica
  add column if not exists company_size text,            -- enquadramento/porte (ME, EPP, DEMAIS)
  add column if not exists state_registration text,      -- inscrição estadual
  add column if not exists municipal_registration text,  -- inscrição municipal
  add column if not exists nire text,
  add column if not exists nire_issued_on date,          -- data do NIRE
  add column if not exists activities_started_on date,   -- data de início das atividades
  add column if not exists service_started_on date,      -- início da prestação de serviço (relação com o escritório)
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_district text,
  add column if not exists address_zip text,
  add column if not exists share_capital numeric(14, 2)  -- capital social
    check (share_capital is null or share_capital >= 0),
  add column if not exists cnae_code text,               -- CNAE principal
  add column if not exists cnae_description text;

-- company_partners — sócios of a client company. Simple registry (spec: "cadastro
-- simples de cada sócio, sem obrigatoriedade"): only the name is required. Cascade
-- with the company; firm_id duplicated for the uniform RLS predicate + indexing.
create table if not exists public.company_partners (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  cpf_cnpj text,
  qualification text, -- qualificação (Sócio-Administrador, Sócio…)
  ownership_percent numeric(5, 2) -- participação societária (%)
    check (ownership_percent is null or (ownership_percent >= 0 and ownership_percent <= 100)),
  joined_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_partners_firm_company_idx
  on public.company_partners (firm_id, company_id);

drop trigger if exists set_updated_at on public.company_partners;
create trigger set_updated_at before update on public.company_partners
  for each row execute function public.set_updated_at();

-- RLS: same stance as contacts — full CRUD within the caller's own firm. The worker
-- (service role, enrichment backfill) bypasses RLS and always filters firm_id.
alter table public.company_partners enable row level security;
grant select, insert, update, delete on public.company_partners to authenticated;

drop policy if exists company_partners_select on public.company_partners;
create policy company_partners_select on public.company_partners
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists company_partners_insert on public.company_partners;
create policy company_partners_insert on public.company_partners
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

drop policy if exists company_partners_update on public.company_partners;
create policy company_partners_update on public.company_partners
  for update to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

drop policy if exists company_partners_delete on public.company_partners;
create policy company_partners_delete on public.company_partners
  for delete to authenticated
  using (firm_id = public.current_firm_id());
