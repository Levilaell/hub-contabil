-- Entrada de documentos (WhatsApp/IMAP) + Atendimento (support tickets).
--
-- Inbound channels feed the SAME AI triage that uploads already use: a WhatsApp
-- message or an e-mail with an attachment becomes a document → pgmq 'triage'; a
-- text-only message becomes a support ticket → pgmq 'support'; an empty/unknown
-- message → exception queue (golden rule #6, nothing dropped). Channel credentials
-- live in env vars (the adapter factory picks real vs no-op, golden rule #3); only
-- inbound_messages (idempotency log) and the support tables live here.
--
-- Tables follow the house rules: firm_id everywhere (#1), RLS select-only for
-- authenticated, writes via the service role (worker) or SECURITY DEFINER RPCs that
-- stamp firm/actor server-side. Idempotent.

-- 1) Inbound now counts as a document source (alongside upload/triage/request)
-- and as an exception origin (a message we couldn't route falls to a human).
alter table public.documents drop constraint if exists documents_source_check;
alter table public.documents add constraint documents_source_check
  check (source in ('upload', 'triage', 'request', 'inbound'));

alter table public.exception_queue drop constraint if exists exception_queue_source_check;
alter table public.exception_queue add constraint exception_queue_source_check
  check (source in (
    'triage', 'export', 'rules', 'deadlines', 'requests', 'enrichment', 'notifications', 'inbound'
  ));

-- 2) Queues for the inbound pipeline and the support assistant (+ one DLQ each).
do $$
declare
  q text;
  queues text[] := array['inbound', 'inbound_dlq', 'support', 'support_dlq'];
begin
  foreach q in array queues loop
    if not exists (select 1 from pgmq.list_queues() where queue_name = q) then
      perform pgmq.create(q);
    end if;
  end loop;
end
$$;

-- 3) inbound_messages — one row per received message, the idempotency anchor. The
-- unique (firm_id, channel, external_id) makes re-delivery (WhatsApp retries, an
-- IMAP re-poll) a no-op. Created by the service role / the webhook RPC; humans only
-- read (debug/visibility).
create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'imap')),
  external_id text not null,
  sender text not null default '',
  subject text,
  kind text not null default 'unknown' check (kind in ('document', 'question', 'unknown')),
  status text not null default 'received' check (status in ('received', 'routed', 'exception')),
  raw jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, channel, external_id)
);
create index if not exists inbound_messages_firm_created_idx
  on public.inbound_messages (firm_id, created_at desc);

drop trigger if exists set_updated_at on public.inbound_messages;
create trigger set_updated_at before update on public.inbound_messages
  for each row execute function public.set_updated_at();

alter table public.inbound_messages enable row level security;
grant select on public.inbound_messages to authenticated;
drop policy if exists inbound_messages_select on public.inbound_messages;
create policy inbound_messages_select on public.inbound_messages
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- 4) support_tickets — one open conversation per (firm, channel, contact). Reused
-- and reopened on each new client message (the state machine lives in @hub/core).
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'imap')),
  contact_identifier text not null,
  contact_name text,
  subject text not null default '',
  status text not null default 'open'
    check (status in ('open', 'pending', 'escalated', 'resolved')),
  assignee_id uuid references auth.users(id) on delete set null,
  ai_handled boolean not null default false,
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, id),
  unique (firm_id, channel, contact_identifier)
);
create index if not exists support_tickets_firm_status_idx
  on public.support_tickets (firm_id, status, last_message_at desc);

drop trigger if exists set_updated_at on public.support_tickets;
create trigger set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

-- 5) support_messages — the conversation. Composite FK (firm_id, ticket_id) blocks
-- pointing at another firm's ticket. Inbound (from the client) lands delivered;
-- outbound (AI/human) starts queued and the worker flips it to delivered/failed.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  ticket_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  author text not null check (author in ('client', 'ai', 'user')),
  body text not null default '',
  external_id text,
  delivery text not null default 'delivered' check (delivery in ('queued', 'delivered', 'failed')),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (firm_id, ticket_id) references public.support_tickets (firm_id, id) on delete cascade
);
create index if not exists support_messages_ticket_idx
  on public.support_messages (firm_id, ticket_id, created_at);

drop trigger if exists set_updated_at on public.support_messages;
create trigger set_updated_at before update on public.support_messages
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
grant select on public.support_tickets to authenticated;
grant select on public.support_messages to authenticated;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- 6) record_inbound_message: durable capture + enqueue for the WhatsApp webhook
-- (which has no firm session — firm_id is resolved by the route and passed in).
-- Idempotent: a duplicate (firm, channel, external_id) returns the existing id and
-- does NOT re-enqueue. Service-role only.
create or replace function public.record_inbound_message(
  p_firm_id uuid,
  p_channel text,
  p_external_id text,
  p_sender text,
  p_kind text,
  p_subject text default null,
  p_raw jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.inbound_messages (firm_id, channel, external_id, sender, kind, subject, raw)
  values (p_firm_id, p_channel, p_external_id, coalesce(p_sender, ''), p_kind, p_subject,
          coalesce(p_raw, '{}'::jsonb))
  on conflict (firm_id, channel, external_id) do nothing
  returning id into v_id;

  if v_id is null then
    -- Already seen — return the existing id, no second enqueue.
    select id into v_id from public.inbound_messages
    where firm_id = p_firm_id and channel = p_channel and external_id = p_external_id;
    return v_id;
  end if;

  perform pgmq.send('inbound', jsonb_build_object('firm_id', p_firm_id, 'inbound_id', v_id));
  return v_id;
end;
$$;
revoke execute on function public.record_inbound_message(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_inbound_message(uuid, text, text, text, text, text, jsonb)
  to service_role;

-- 7) reply_support_ticket: a human answers from /atendimento. Inserts a queued
-- outbound message and enqueues delivery (the worker sends it over WhatsApp), moves
-- the ticket to 'pending', audits. documents-style: the table has no authenticated
-- INSERT — this definer is the only write path.
create or replace function public.reply_support_ticket(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_msg_id uuid;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'empty reply';
  end if;
  perform 1 from public.support_tickets where id = p_ticket_id and firm_id = v_firm;
  if not found then
    raise exception 'ticket not found in firm';
  end if;

  insert into public.support_messages
    (firm_id, ticket_id, direction, author, body, delivery)
  values (v_firm, p_ticket_id, 'outbound', 'user', p_body, 'queued')
  returning id into v_msg_id;

  update public.support_tickets
  set status = 'pending', assignee_id = coalesce(assignee_id, auth.uid()), last_message_at = now()
  where id = p_ticket_id and firm_id = v_firm;

  perform pgmq.send('support', jsonb_build_object(
    'firm_id', v_firm, 'ticket_id', p_ticket_id, 'message_id', v_msg_id, 'kind', 'deliver'));

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'support.replied', 'support_ticket', p_ticket_id,
          jsonb_build_object('messageId', v_msg_id));
  return v_msg_id;
end;
$$;
revoke execute on function public.reply_support_ticket(uuid, text) from public, anon;
grant execute on function public.reply_support_ticket(uuid, text) to authenticated;

-- 8) set_support_status: escalate (hand to a human) or resolve (close). The state
-- machine in @hub/core mirrors the allowed targets; here we just guard the firm.
create or replace function public.set_support_status(p_ticket_id uuid, p_status text, p_note text default null)
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
  if p_status not in ('open', 'pending', 'escalated', 'resolved') then
    raise exception 'invalid status';
  end if;

  update public.support_tickets
  set status = p_status,
      assignee_id = case when p_status = 'escalated' then coalesce(assignee_id, auth.uid()) else assignee_id end
  where id = p_ticket_id and firm_id = v_firm;
  if not found then
    raise exception 'ticket not found in firm';
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'support.' || p_status, 'support_ticket', p_ticket_id,
          jsonb_build_object('note', coalesce(p_note, '')));
end;
$$;
revoke execute on function public.set_support_status(uuid, text, text) from public, anon;
grant execute on function public.set_support_status(uuid, text, text) to authenticated;
