-- T22 · Export batches (PLANEJAMENTO §M11). A batch packages a firm's documents
-- (filtered by company/period/type) into a renamed .zip + manifest for manual ERP
-- import. Building is a worker job on the `export` queue (service role): it reads the
-- files, zips them via the ErpAdapter, uploads the zip, and records what went in.
-- The web only READS batches and creates one through create_export_batch (which
-- enqueues), so firm_id is always derived server-side. Idempotent.

create table if not exists public.export_batches (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  period text, -- the requested period filter (display convenience; full filter in filters)
  filters jsonb not null default '{}'::jsonb, -- { companyIds[], period, docTypes[] }
  manifest jsonb not null default '{}'::jsonb, -- core ExportManifest output (counts, included, excluded)
  zip_path text, -- storage path of the built zip; null until ready
  status text not null default 'building'
    check (status in ('building', 'ready', 'failed', 'downloaded')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists export_batches_firm_created_idx
  on public.export_batches (firm_id, created_at desc);

drop trigger if exists set_updated_at on public.export_batches;
create trigger set_updated_at before update on public.export_batches
  for each row execute function public.set_updated_at();

-- Which documents went into which batch — powers the re-export warning and the
-- batch detail. Written by the worker (service role).
create table if not exists public.export_batch_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  batch_id uuid not null references public.export_batches(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  export_name text not null,
  created_at timestamptz not null default now(),
  unique (batch_id, document_id)
);
create index if not exists export_batch_documents_firm_document_idx
  on public.export_batch_documents (firm_id, document_id);

-- RLS: read-only for authenticated (own firm). Writes come from the service role
-- (worker) or the privileged RPCs below — humans never insert/update directly.
alter table public.export_batches enable row level security;
alter table public.export_batch_documents enable row level security;
grant select on public.export_batches to authenticated;
grant select on public.export_batch_documents to authenticated;

drop policy if exists export_batches_select on public.export_batches;
create policy export_batches_select on public.export_batches
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists export_batch_documents_select on public.export_batch_documents;
create policy export_batch_documents_select on public.export_batch_documents
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- create_export_batch: the RLS-safe way for the web (anon key) to start a batch.
-- Inserts the row (status building, scoped to the caller's firm) and enqueues the
-- build job. firm_id is derived from the session, never trusted from input.
create or replace function public.create_export_batch(p_filters jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_id uuid;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;

  insert into public.export_batches (firm_id, period, filters)
  values (v_firm, nullif(p_filters ->> 'period', ''), coalesce(p_filters, '{}'::jsonb))
  returning id into v_id;

  perform pgmq.send('export', jsonb_build_object('firm_id', v_firm, 'batch_id', v_id));

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'export_batch.requested', 'export_batch', v_id,
          coalesce(p_filters, '{}'::jsonb));

  return v_id;
end;
$$;

revoke execute on function public.create_export_batch(jsonb) from public, anon;
grant execute on function public.create_export_batch(jsonb) to authenticated;

-- mark_export_downloaded: flips a ready batch to downloaded when the user grabs the
-- zip (audit trail of who exported what). Scoped to the caller's firm.
create or replace function public.mark_export_downloaded(p_id uuid)
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

  update public.export_batches
  set status = 'downloaded'
  where id = p_id and firm_id = v_firm and status = 'ready';

  if found then
    insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
    values (v_firm, auth.uid(), 'export_batch.downloaded', 'export_batch', p_id, '{}'::jsonb);
  end if;
end;
$$;

revoke execute on function public.mark_export_downloaded(uuid) from public, anon;
grant execute on function public.mark_export_downloaded(uuid) to authenticated;
