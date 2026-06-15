-- T9 · Generic exception queue: one place for errors from any automation (golden
-- rule #6 — automations never fail silently). Rows are created by the worker /
-- automations (service role); humans only READ and resolve via resolve_exception,
-- so a human can't forge an exception (same stance as audit_events). `source`
-- records the origin: domain sources (triage/rules/deadlines/requests) plus the
-- worker queues that can dead-letter here (export/enrichment/notifications).
-- Idempotent.

create table if not exists public.exception_queue (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  source text not null check (
    source in ('triage', 'export', 'rules', 'deadlines', 'requests', 'enrichment', 'notifications')
  ),
  context jsonb not null default '{}'::jsonb,
  suggestion jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  resolution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exception_queue_firm_status_idx
  on public.exception_queue (firm_id, status, created_at desc);

drop trigger if exists set_updated_at on public.exception_queue;
create trigger set_updated_at before update on public.exception_queue
  for each row execute function public.set_updated_at();

-- RLS: read own firm only. No INSERT/UPDATE grant to authenticated — inserts come
-- from the service role (worker), resolution goes through the privileged RPC below.
alter table public.exception_queue enable row level security;
grant select on public.exception_queue to authenticated;

drop policy if exists exception_queue_select on public.exception_queue;
create policy exception_queue_select on public.exception_queue
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- resolve_exception: the only way an authenticated user changes an exception.
-- Stamps the resolver + timestamp server-side, scopes to the caller's firm, and
-- only acts on an OPEN row so a double-resolve can't overwrite the first author.
create or replace function public.resolve_exception(
  p_id uuid,
  p_status text,
  p_note text default null
)
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
  if p_status not in ('resolved', 'ignored') then
    raise exception 'invalid status';
  end if;

  update public.exception_queue
  set status = p_status,
      resolution = jsonb_build_object(
        'resolvedBy', auth.uid(),
        'resolvedAt', now(),
        'note', coalesce(p_note, '')
      )
  where id = p_id and firm_id = v_firm and status = 'open';
  if not found then
    raise exception 'exception not found or already resolved';
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'exception.' || p_status, 'exception', p_id,
          jsonb_build_object('note', coalesce(p_note, '')));
end;
$$;

revoke execute on function public.resolve_exception(uuid, text, text) from public, anon;
grant execute on function public.resolve_exception(uuid, text, text) to authenticated;
