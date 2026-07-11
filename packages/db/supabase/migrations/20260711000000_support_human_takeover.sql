-- T27 · Human-takeover gate for atendimento. Once a conversation escalates — or a
-- human replies — the AI (and the reception menu) must stay SILENT until the
-- ticket is explicitly handed back ("Devolver para IA"). Before this, the
-- assistant kept answering escalated tickets and even flipped them back out of
-- 'escalated'. handled_by records who owns the conversation; resolving resets it
-- to 'ai' so a fresh conversation later is AI-first again. Mirrors
-- assistantMayEngage in @hub/core. Idempotent.

alter table public.support_tickets
  add column if not exists handled_by text not null default 'ai'
  check (handled_by in ('ai', 'human'));

-- Backfill: anything already escalated (or visibly taken by a human and still
-- open) is human-owned; resolved conversations reset to 'ai' by design.
update public.support_tickets
set handled_by = 'human'
where handled_by = 'ai'
  and (status = 'escalated' or (assignee_id is not null and status in ('open', 'pending')));

-- reply_support_ticket: a human answering now also takes ownership (handled_by).
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
  set status = 'pending', handled_by = 'human',
      assignee_id = coalesce(assignee_id, auth.uid()), last_message_at = now()
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

-- set_support_status: escalating hands the ticket to a human; resolving hands it
-- back to the AI (a future, fresh conversation gets AI treatment again).
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
      handled_by = case
        when p_status = 'escalated' then 'human'
        when p_status = 'resolved' then 'ai'
        else handled_by
      end,
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

-- return_ticket_to_ai ("Devolver para IA"): explicit hand-back. Re-enables the
-- assistant for the NEXT client message; an escalated ticket moves to 'pending'
-- (valid transition — the conversation goes back to awaiting the client).
create or replace function public.return_ticket_to_ai(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_status text;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;

  select status into v_status from public.support_tickets
  where id = p_ticket_id and firm_id = v_firm;
  if not found then
    raise exception 'ticket not found in firm';
  end if;
  if v_status = 'resolved' then
    raise exception 'ticket is resolved';
  end if;

  update public.support_tickets
  set handled_by = 'ai',
      status = case when status = 'escalated' then 'pending' else status end
  where id = p_ticket_id and firm_id = v_firm;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'support.returned_to_ai', 'support_ticket', p_ticket_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.return_ticket_to_ai(uuid) from public, anon;
grant execute on function public.return_ticket_to_ai(uuid) to authenticated;
