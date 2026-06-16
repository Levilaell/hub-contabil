-- T17 · Request delivery + follow-up. Adds the timestamps the reminder cron needs
-- (sent_at = when the link was last delivered; last_reminded_at = throttle), lets
-- the event timeline record firm-side actions (sent / reminded), and rotates the
-- access token on (re)send. Since only the hash is stored, a fresh link can't be
-- "recovered" — it is regenerated, which invalidates the previous one. Rotation
-- mirrors the core guard (canResendRequest / statusAfterResend): it advances
-- requested → sent but never regresses viewed → sent. Idempotent.

alter table public.document_requests add column if not exists sent_at timestamptz;
alter table public.document_requests add column if not exists last_reminded_at timestamptz;

-- Reminder sweep reads 'sent' requests by sent_at; a partial index keeps it cheap.
create index if not exists document_requests_reminder_idx
  on public.document_requests (sent_at)
  where status = 'sent';

-- The timeline must show what the firm did, not only the client — allow sent/reminded.
alter table public.document_request_events
  drop constraint if exists document_request_events_event_type_check;
alter table public.document_request_events
  add constraint document_request_events_event_type_check
  check (event_type in ('viewed', 'received', 'downloaded', 'sent', 'reminded'));

-- Rotate the access token (resend / copy-new-link). Firm-scoped, open-only,
-- audited. Generates a fresh URL-safe token server-side, stores only its hash,
-- returns the raw token once. Resets the reminder throttle.
create or replace function public.rotate_request_token(p_id uuid, p_expiry_days int default 7)
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
    expires_at = now() + make_interval(days => v_days),
    -- requested → sent; sent/viewed preserved (mirror core statusAfterResend).
    status = case when status = 'requested' then 'sent' else status end,
    sent_at = now(),
    last_reminded_at = null
  where id = p_id;

  insert into public.document_request_events (firm_id, request_id, event_type, context)
  values (v_firm, p_id, 'sent', jsonb_build_object('rotated', true));

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'request.sent', 'document_request', p_id, '{}'::jsonb);

  return v_token;
end;
$$;
revoke execute on function public.rotate_request_token(uuid, int) from public, anon;
grant execute on function public.rotate_request_token(uuid, int) to authenticated;
