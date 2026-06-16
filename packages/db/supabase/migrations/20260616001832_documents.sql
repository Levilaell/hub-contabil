-- T12 · Document repository: documents table + a private Storage bucket. Files
-- are uploaded client-side directly to Storage (bulk + progress), so storage.objects
-- RLS — keyed on the firm segment of the path — is the load-bearing tenant boundary.
-- Path convention: firm/{firm_id}/company/{company_id}/{period}/{department}/{file}.
-- Access is firm-wide in v1. Dedup is per (firm, company, content hash). Idempotent.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid not null,
  period text, -- competência 'YYYY-MM'
  department text,
  doc_type text not null default 'other', -- config taxonomy key
  storage_path text not null,
  source text not null default 'upload' check (source in ('upload', 'triage', 'request')),
  hash text not null, -- sha256 hex of file content
  file_name text not null,
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- firm-consistent company link (golden rule #1).
  foreign key (firm_id, company_id) references public.companies(firm_id, id) on delete cascade,
  -- the stored path MUST belong to this row's firm/company (can't store a path we
  -- never validated — pairs with the storage RLS that gates the write itself).
  constraint documents_path_matches_owner check (
    storage_path like 'firm/' || firm_id::text || '/company/' || company_id::text || '/%'
  ),
  -- dedup: same content in the same company is one document.
  unique (firm_id, company_id, hash)
);
create index if not exists documents_firm_company_period_idx
  on public.documents (firm_id, company_id, period);
create index if not exists documents_firm_type_idx on public.documents (firm_id, doc_type);

drop trigger if exists set_updated_at on public.documents;
create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- RLS: firm-wide read/write (v1 decision — the repository is navigated by company).
alter table public.documents enable row level security;
grant select, insert, delete on public.documents to authenticated;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete to authenticated
  using (firm_id = public.current_firm_id());

-- Private bucket for the files (50 MiB cap, mirrors config.toml).
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

-- Storage RLS: an authenticated user may read/write/delete objects only under
-- their own firm's path. Path is firm/{firm_id}/... → foldername(name)[1] = 'firm',
-- [2] = firm_id. (Verified by a cross-firm round-trip after applying.)
drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = public.current_firm_id()::text
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = public.current_firm_id()::text
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[2] = public.current_firm_id()::text
  );
