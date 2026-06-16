-- T16 · Golden rule #7: a document filed through the public link must be audited
-- like any other (T12's insertDocument emits document.created). record_request_upload
-- now writes an audit_events row too — actor_id null (client action, no firm user),
-- firm_id from the token-resolved request. document_request_events keeps the public
-- interaction timeline; audit_events keeps the canonical who/what/when. Idempotent
-- via create-or-replace; the rest of the function is unchanged.
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

  -- Canonical audit trail (golden rule #7) — same action a firm-side upload emits.
  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (r.firm_id, null, 'document.created', 'document', v_doc_id,
          jsonb_build_object('source', 'request', 'requestId', r.id, 'fileName', p_file_name));

  return v_doc_id;
end;
$$;
