-- T20 · AI triage classifications (PLANEJAMENTO §M10). One row per document the
-- triage pipeline processed: the suggested type, extracted CNPJ, confidence, model,
-- and who decided (ai | human). Written by the worker (service role); humans only
-- read (the "classificado por IA" badge, T21). classification_examples stores the
-- few-shot examples a human correction produces (T21). Idempotent.

create table if not exists public.classifications (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  suggested_type text not null,
  extracted_cnpj text,
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1),
  model text not null default '',
  decided_by text not null default 'ai' check (decided_by in ('ai', 'human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one classification per document (re-triage overwrites via the worker upsert).
  unique (firm_id, document_id)
);
create index if not exists classifications_firm_document_idx
  on public.classifications (firm_id, document_id);

drop trigger if exists set_updated_at on public.classifications;
create trigger set_updated_at before update on public.classifications
  for each row execute function public.set_updated_at();

create table if not exists public.classification_examples (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  doc_type text not null, -- the corrected type a human chose
  extracted_cnpj text,
  context jsonb not null default '{}'::jsonb, -- snippet/features for future few-shot
  created_at timestamptz not null default now()
);
create index if not exists classification_examples_firm_type_idx
  on public.classification_examples (firm_id, doc_type);

-- RLS: read-only for authenticated (own firm). The worker (service role) writes
-- classifications; corrections (T21) write examples via a privileged RPC.
alter table public.classifications enable row level security;
alter table public.classification_examples enable row level security;
grant select on public.classifications to authenticated;
grant select on public.classification_examples to authenticated;

drop policy if exists classifications_select on public.classifications;
create policy classifications_select on public.classifications
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists classification_examples_select on public.classification_examples;
create policy classification_examples_select on public.classification_examples
  for select to authenticated
  using (firm_id = public.current_firm_id());
