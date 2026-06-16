-- T14 · Monitored documents (deadline engine, PLANEJAMENTO §7/M7). Each row is a
-- dated obligation per company (CND, alvará, certificate…). status is a denormalized
-- cache (set on write, recomputed by the T15 daily cron); readers recompute from
-- due_date so panels are never stale. doc_kind is a config vocabulary key. Firm-wide
-- access (like documents). Idempotent.

create table if not exists public.monitored_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid not null,
  doc_kind text not null, -- config monitoredKinds key
  due_date date, -- null = no_date
  trigger_days int not null default 30 check (trigger_days between 0 and 365),
  status text not null default 'no_date'
    check (status in ('no_date', 'valid', 'due_soon', 'overdue', 'needs_update')),
  document_id uuid references public.documents(id) on delete set null, -- optional repo link
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (firm_id, company_id) references public.companies(firm_id, id) on delete cascade
);
create index if not exists monitored_documents_firm_company_idx
  on public.monitored_documents (firm_id, company_id);
create index if not exists monitored_documents_firm_status_idx
  on public.monitored_documents (firm_id, status);
create index if not exists monitored_documents_firm_due_idx
  on public.monitored_documents (firm_id, due_date);

drop trigger if exists set_updated_at on public.monitored_documents;
create trigger set_updated_at before update on public.monitored_documents
  for each row execute function public.set_updated_at();

-- RLS: firm-wide read/write (deadlines are navigated by company, v1 like documents).
alter table public.monitored_documents enable row level security;
grant select, insert, update, delete on public.monitored_documents to authenticated;

drop policy if exists monitored_documents_select on public.monitored_documents;
create policy monitored_documents_select on public.monitored_documents
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists monitored_documents_insert on public.monitored_documents;
create policy monitored_documents_insert on public.monitored_documents
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

drop policy if exists monitored_documents_update on public.monitored_documents;
create policy monitored_documents_update on public.monitored_documents
  for update to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

drop policy if exists monitored_documents_delete on public.monitored_documents;
create policy monitored_documents_delete on public.monitored_documents
  for delete to authenticated
  using (firm_id = public.current_firm_id());
