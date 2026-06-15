-- T7 · CNPJ enrichment infrastructure. A pgmq `enrichment` queue (+ DLQ) that the
-- worker consumes via the CnpjEnrichmentAdapter, plus request_enrichment(): the
-- RLS-safe way for the web (anon key) to enqueue a job. Enrichment runs in the
-- worker so throttling is centralized and an API failure never blocks creation
-- (golden rule #6 — it lands in the DLQ → exception queue in T9). Idempotent.

create extension if not exists pgmq;

do $$
declare
  q text;
  queues text[] := array['enrichment', 'enrichment_dlq'];
begin
  foreach q in array queues loop
    if not exists (select 1 from pgmq.list_queues() where queue_name = q) then
      perform pgmq.create(q);
    end if;
  end loop;
end
$$;

-- request_enrichment: validates the company belongs to the caller's firm, marks
-- it pending, and enqueues {firm_id, company_id}. SECURITY DEFINER so it can reach
-- pgmq (authenticated has no direct access) while firm_id is derived server-side,
-- never trusted from input — a user can only enqueue for their own companies.
-- Empty search_path: everything is schema-qualified (standard hardening).
create or replace function public.request_enrichment(p_company_id uuid)
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

  -- Scope the company to the caller's firm; unknown/foreign id → no-op error.
  update public.companies
  set enrichment_data = coalesce(enrichment_data, '{}'::jsonb)
    || jsonb_build_object('status', 'pending', 'requested_at', now())
  where id = p_company_id and firm_id = v_firm;
  if not found then
    raise exception 'company not found in firm';
  end if;

  perform pgmq.send(
    'enrichment',
    jsonb_build_object('firm_id', v_firm, 'company_id', p_company_id)
  );

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'company.enrichment_requested', 'company', p_company_id, '{}'::jsonb);
end;
$$;

revoke execute on function public.request_enrichment(uuid) from public, anon;
grant execute on function public.request_enrichment(uuid) to authenticated;
