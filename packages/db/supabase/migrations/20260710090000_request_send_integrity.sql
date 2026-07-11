-- T26 · Request send integrity. rotate_request_token used to advance
-- requested → sent, stamp sent_at and write the 'sent' timeline/audit events
-- BEFORE — and regardless of — any e-mail actually going out; and the copy-link
-- action shares it, so merely copying a link also read as "sent". Rotation
-- becomes pure (fresh token + expiry only) and sent-marking moves to
-- mark_request_sent, which the web action calls only after the messaging
-- adapter confirms the provider accepted the e-mail. Copying a link is
-- recorded as its own timeline event ('link_copied'). Idempotent.

-- Timeline: allow the copy event.
alter table public.document_request_events
  drop constraint if exists document_request_events_event_type_check;
alter table public.document_request_events
  add constraint document_request_events_event_type_check
  check (event_type in ('viewed', 'received', 'downloaded', 'sent', 'reminded', 'link_copied'));

-- Pure rotation: fresh token + expiry, status/sent_at untouched (delivery facts
-- are never invented or erased here). p_record_copy=true logs the copy-link
-- path on the timeline; the send path passes false and lets mark_request_sent
-- write 'sent' once delivery is confirmed. The audit row records the rotation
-- either way — rotating invalidates the client's previous link even when the
-- follow-up e-mail fails, and that must stay traceable.
drop function if exists public.rotate_request_token(uuid, int);
create or replace function public.rotate_request_token(
  p_id uuid,
  p_expiry_days int default 7,
  p_record_copy boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_status text;
  v_token text;
  v_days int := greatest(1, least(coalesce(p_expiry_days, 7), 90));
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;

  select status into v_status from public.document_requests
  where id = p_id and firm_id = v_firm;
  if not found then
    raise exception 'request not found';
  end if;
  if v_status not in ('requested', 'sent', 'viewed') then
    raise exception 'request is not resendable';
  end if;

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  update public.document_requests set
    token_hash = public.hash_request_token(v_token),
    expires_at = now() + make_interval(days => v_days)
  where id = p_id;

  if p_record_copy then
    insert into public.document_request_events (firm_id, request_id, event_type, context)
    values (v_firm, p_id, 'link_copied', '{}'::jsonb);
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(),
          case when p_record_copy then 'request.link_copied' else 'request.link_rotated' end,
          'document_request', p_id, '{}'::jsonb);

  return v_token;
end;
$$;
revoke execute on function public.rotate_request_token(uuid, int, boolean) from public, anon;
grant execute on function public.rotate_request_token(uuid, int, boolean) to authenticated;

-- Mark a request sent — callers may only invoke this AFTER the provider accepted
-- the e-mail. Mirrors core statusAfterResend (requested → sent, sent/viewed
-- preserved), stamps sent_at and resets the reminder throttle so the next
-- reminder counts from this delivery.
create or replace function public.mark_request_sent(p_id uuid, p_to text default null)
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

  select status into v_status from public.document_requests
  where id = p_id and firm_id = v_firm;
  if not found then
    raise exception 'request not found';
  end if;
  if v_status not in ('requested', 'sent', 'viewed') then
    raise exception 'request is not open';
  end if;

  update public.document_requests set
    status = case when status = 'requested' then 'sent' else status end,
    sent_at = now(),
    last_reminded_at = null
  where id = p_id;

  insert into public.document_request_events (firm_id, request_id, event_type, context)
  values (v_firm, p_id, 'sent', jsonb_build_object('to', p_to));

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'request.sent', 'document_request', p_id,
          jsonb_build_object('to', p_to));
end;
$$;
revoke execute on function public.mark_request_sent(uuid, text) from public, anon;
grant execute on function public.mark_request_sent(uuid, text) to authenticated;
