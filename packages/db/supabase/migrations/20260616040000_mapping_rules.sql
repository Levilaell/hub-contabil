-- T18 · Mapping-rules engine (PLANEJAMENTO §M9). A generic precedence resolver:
-- per (firm, domain), a structured `key` maps to a `value`. `level` encodes
-- precedence — 1 (specific) beats 2 (general); "level 3" is not a rule, it is the
-- exception queue (no match → pending, source 'rules'). The first domain is 'cfop'
-- (T19). origin records whether a rule was authored by hand or saved while resolving
-- a pending. Firm-wide CRUD (rules are firm policy, not department-scoped). Idempotent.

create table if not exists public.mapping_rules (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  domain text not null check (length(domain) > 0),
  level smallint not null check (level in (1, 2)),
  key jsonb not null,
  value jsonb not null,
  origin text not null default 'manual' check (origin in ('manual', 'resolution')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One rule per (domain, level, key): re-saving the same rule is rejected, never a
  -- silent duplicate. jsonb equality is order-independent, so {a,b} == {b,a}.
  unique (firm_id, domain, level, key)
);
create index if not exists mapping_rules_firm_domain_idx
  on public.mapping_rules (firm_id, domain);

drop trigger if exists set_updated_at on public.mapping_rules;
create trigger set_updated_at before update on public.mapping_rules
  for each row execute function public.set_updated_at();

-- RLS: firm-wide read/write.
alter table public.mapping_rules enable row level security;
grant select, insert, update, delete on public.mapping_rules to authenticated;

drop policy if exists mapping_rules_select on public.mapping_rules;
create policy mapping_rules_select on public.mapping_rules
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists mapping_rules_insert on public.mapping_rules;
create policy mapping_rules_insert on public.mapping_rules
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

drop policy if exists mapping_rules_update on public.mapping_rules;
create policy mapping_rules_update on public.mapping_rules
  for update to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

drop policy if exists mapping_rules_delete on public.mapping_rules;
create policy mapping_rules_delete on public.mapping_rules
  for delete to authenticated
  using (firm_id = public.current_firm_id());

-- queue_rules_exception: the engine's pending path. The exception queue is otherwise
-- insert-only by the service role (T9) so humans can't forge exceptions; this
-- SECURITY DEFINER RPC is the one authenticated entry point and is scoped to source
-- 'rules' only. Used when a deterministic resolution (e.g. CFOP on an NF-e upload,
-- T19) finds no rule. Identical OPEN pendings (same domain + key) collapse to one, so
-- a single unmapped CFOP can't flood the queue across many invoices. Returns the id.
create or replace function public.queue_rules_exception(
  p_context jsonb,
  p_suggestion jsonb default '{}'::jsonb
)
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

  select id into v_id
  from public.exception_queue
  where firm_id = v_firm
    and source = 'rules'
    and status = 'open'
    and context -> 'domain' = p_context -> 'domain'
    and context -> 'key' = p_context -> 'key'
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.exception_queue (firm_id, source, context, suggestion)
  values (v_firm, 'rules', coalesce(p_context, '{}'::jsonb), coalesce(p_suggestion, '{}'::jsonb))
  returning id into v_id;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'rules.pending', 'exception', v_id, coalesce(p_context, '{}'::jsonb));

  return v_id;
end;
$$;

revoke execute on function public.queue_rules_exception(jsonb, jsonb) from public, anon;
grant execute on function public.queue_rules_exception(jsonb, jsonb) to authenticated;
