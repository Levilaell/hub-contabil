-- T16 · Document requests + public access page. A request either asks a client
-- to upload a document (kind 'upload_request') or makes one available to download
-- (kind 'document_offer'). Access is via an opaque bearer token in the URL
-- (/s/{token}); only its sha256 hash is stored, so a DB read can't replay the
-- live link. The public surface carries no firm JWT — the token IS the tenant
-- boundary, enforced inside SECURITY DEFINER RPCs that take the RAW token and
-- hash it internally, and that NEVER trust a caller-supplied firm/company/path
-- (all of those are derived server-side from the token lookup). EXECUTE on those
-- RPCs is the entire wall, so it is granted to anon on exactly those functions.
-- document_request_events is the public-interaction timeline (viewed/received/
-- downloaded) with ip/user-agent; firm-side actions go to audit_events. Idempotent.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  company_id uuid not null,
  kind text not null check (kind in ('upload_request', 'document_offer')),
  title text not null,
  description text not null default '',
  -- document_offer: the shared document (download). Null for upload_request.
  document_id uuid references public.documents(id) on delete set null,
  -- upload_request: a hint of the document wanted (taxonomy key or free text).
  requested_doc_type text,
  token_hash text not null unique, -- sha256 hex of the raw token; raw token never stored
  expires_at timestamptz not null,
  status text not null default 'requested' check (
    status in ('requested', 'sent', 'viewed', 'received', 'downloaded', 'expired', 'cancelled')
  ),
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- firm-consistent company link (golden rule #1).
  foreign key (firm_id, company_id) references public.companies(firm_id, id) on delete cascade
);
create index if not exists document_requests_firm_company_idx
  on public.document_requests (firm_id, company_id, created_at desc);
create index if not exists document_requests_firm_status_idx
  on public.document_requests (firm_id, status);

drop trigger if exists set_updated_at on public.document_requests;
create trigger set_updated_at before update on public.document_requests
  for each row execute function public.set_updated_at();

create table if not exists public.document_request_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  request_id uuid not null references public.document_requests(id) on delete cascade,
  event_type text not null check (event_type in ('viewed', 'received', 'downloaded')),
  ip text,
  user_agent text,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists document_request_events_request_idx
  on public.document_request_events (request_id, occurred_at desc);

-- RLS: firm reads its own requests and the public-interaction timeline. There is
-- NO insert/update grant for the events table and NO update/delete grant for
-- requests — every mutation flows through the RPCs below (firm cancel, or the
-- token-keyed public RPCs running as definer), so state can't be forged.
alter table public.document_requests enable row level security;
grant select, insert on public.document_requests to authenticated;

drop policy if exists document_requests_select on public.document_requests;
create policy document_requests_select on public.document_requests
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists document_requests_insert on public.document_requests;
create policy document_requests_insert on public.document_requests
  for insert to authenticated
  with check (firm_id = public.current_firm_id());

alter table public.document_request_events enable row level security;
grant select on public.document_request_events to authenticated;

drop policy if exists document_request_events_select on public.document_request_events;
create policy document_request_events_select on public.document_request_events
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- Canonical token hashing — one place so the JS create path and the SQL lookups
-- never disagree. Not granted to clients; only the definer RPCs (run as owner) call it.
create or replace function public.hash_request_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke execute on function public.hash_request_token(text) from public, anon, authenticated;

-- Read the request behind a token, for rendering the public page. No mutation.
-- Returns at most one row; absent row = invalid/unknown token. is_expired is
-- decided here from now() so the expiry page never depends on a cron.
create or replace function public.get_request_by_token(p_token text)
returns table (
  firm_name text,
  company_name text,
  kind text,
  title text,
  description text,
  status text,
  is_expired boolean,
  expires_at timestamptz,
  document_file_name text,
  requested_doc_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.name,
    coalesce(nullif(c.trade_name, ''), c.legal_name),
    r.kind,
    r.title,
    r.description,
    r.status,
    (r.expires_at < now()),
    r.expires_at,
    d.file_name,
    r.requested_doc_type
  from public.document_requests r
  join public.firms f on f.id = r.firm_id
  join public.companies c on c.id = r.company_id
  left join public.documents d on d.id = r.document_id
  where r.token_hash = public.hash_request_token(p_token);
$$;
revoke execute on function public.get_request_by_token(text) from public;
grant execute on function public.get_request_by_token(text) to anon, authenticated;

-- Log that the link was opened. First open of an open request → viewed (+ event).
-- Re-opens and terminal states are no-ops (idempotent). An expired-but-still-open
-- request is lazily flipped to expired. ip/user_agent come from the server headers,
-- not the browser form.
create or replace function public.log_request_view(
  p_token text,
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_firm uuid;
  v_status text;
  v_expired boolean;
begin
  select id, firm_id, status, (expires_at < now())
    into v_id, v_firm, v_status, v_expired
  from public.document_requests
  where token_hash = public.hash_request_token(p_token);
  if not found then
    return; -- unknown token: nothing to log
  end if;

  if v_expired then
    if v_status in ('requested', 'sent', 'viewed') then
      update public.document_requests set status = 'expired' where id = v_id;
    end if;
    return;
  end if;

  if v_status in ('requested', 'sent') then
    update public.document_requests set status = 'viewed' where id = v_id;
    insert into public.document_request_events (firm_id, request_id, event_type, ip, user_agent)
    values (v_firm, v_id, 'viewed', p_ip, p_user_agent);
  end if;
end;
$$;
revoke execute on function public.log_request_view(text, text, text) from public;
grant execute on function public.log_request_view(text, text, text) to anon, authenticated;

-- Record an upload made through the link: file the document (source 'request')
-- and move the request to received. The storage path is computed server-side from
-- the token→request; it is re-checked here to belong to this firm/company before
-- the row is written (defense in depth, pairs with the documents path CHECK).
create or replace function public.record_request_upload(
  p_token text,
  p_storage_path text,
  p_hash text,
  p_file_name text,
  p_size bigint,
  p_ip text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.document_requests%rowtype;
  v_doc_id uuid;
begin
  select * into r from public.document_requests
  where token_hash = public.hash_request_token(p_token);
  if not found then
    raise exception 'invalid token';
  end if;
  if r.expires_at < now() then
    raise exception 'link expired';
  end if;
  if r.kind <> 'upload_request' then
    raise exception 'not an upload request';
  end if;
  if r.status in ('received', 'cancelled', 'expired') then
    raise exception 'request already completed';
  end if;
  if p_storage_path not like
       'firm/' || r.firm_id::text || '/company/' || r.company_id::text || '/%' then
    raise exception 'storage path does not belong to this request';
  end if;

  insert into public.documents
    (firm_id, company_id, doc_type, storage_path, source, hash, file_name, size_bytes)
  values
    (r.firm_id, r.company_id, coalesce(nullif(r.requested_doc_type, ''), 'other'),
     p_storage_path, 'request', p_hash, p_file_name, p_size)
  on conflict (firm_id, company_id, hash) do nothing
  returning id into v_doc_id;

  if v_doc_id is null then
    -- same content already filed for this company (dedup): reuse it.
    select id into v_doc_id from public.documents
    where firm_id = r.firm_id and company_id = r.company_id and hash = p_hash;
  end if;

  update public.document_requests set status = 'received' where id = r.id;
  insert into public.document_request_events
    (firm_id, request_id, event_type, ip, user_agent, context)
  values
    (r.firm_id, r.id, 'received', p_ip, p_user_agent,
     jsonb_build_object('documentId', v_doc_id, 'fileName', p_file_name));

  return v_doc_id;
end;
$$;
revoke execute on function
  public.record_request_upload(text, text, text, text, bigint, text, text) from public;
grant execute on function
  public.record_request_upload(text, text, text, text, bigint, text, text)
  to anon, authenticated;

-- Record a download of an offered document and return its storage path (so the
-- caller can mint a signed URL with the service role). Logs every download; moves
-- an open request to downloaded the first time.
create or replace function public.record_request_download(
  p_token text,
  p_ip text default null,
  p_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.document_requests%rowtype;
  v_path text;
begin
  select * into r from public.document_requests
  where token_hash = public.hash_request_token(p_token);
  if not found then
    raise exception 'invalid token';
  end if;
  if r.expires_at < now() then
    raise exception 'link expired';
  end if;
  if r.kind <> 'document_offer' or r.document_id is null then
    raise exception 'no document to download';
  end if;

  select storage_path into v_path from public.documents
  where id = r.document_id and firm_id = r.firm_id;
  if v_path is null then
    raise exception 'document not found';
  end if;

  insert into public.document_request_events (firm_id, request_id, event_type, ip, user_agent)
  values (r.firm_id, r.id, 'downloaded', p_ip, p_user_agent);
  if r.status in ('requested', 'sent', 'viewed') then
    update public.document_requests set status = 'downloaded' where id = r.id;
  end if;

  return v_path;
end;
$$;
revoke execute on function public.record_request_download(text, text, text) from public;
grant execute on function public.record_request_download(text, text, text) to anon, authenticated;

-- Firm cancels an open request. Authenticated + firm-scoped; audited.
create or replace function public.cancel_document_request(p_id uuid)
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

  update public.document_requests
  set status = 'cancelled'
  where id = p_id and firm_id = v_firm and status in ('requested', 'sent', 'viewed');
  if not found then
    raise exception 'request not found or not cancellable';
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'request.cancelled', 'document_request', p_id, '{}'::jsonb);
end;
$$;
revoke execute on function public.cancel_document_request(uuid) from public, anon;
grant execute on function public.cancel_document_request(uuid) to authenticated;
