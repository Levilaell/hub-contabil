-- T21 · Triage ↔ product integration. An "inbox" upload chooses no company: the
-- document lands with company_id NULL under firm/{firm}/inbox/ and AI triage resolves
-- the company + type, then files it. So company_id becomes nullable and the storage
-- path CHECK relaxes to firm-scope only (the company segment is organizational, not a
-- security boundary — the firm prefix is). enqueue_triage lets the web kick off triage;
-- correct_classification turns a human "corrigir" into a stored few-shot example;
-- record_request_upload now also routes public-page uploads (T16) through triage.

alter table public.documents alter column company_id drop not null;
alter table public.documents drop constraint if exists documents_path_matches_owner;
alter table public.documents add constraint documents_path_in_firm
  check (storage_path like 'firm/' || firm_id::text || '/%');

-- enqueue_triage: RLS-safe way for the web to enqueue a triage job (pgmq access is
-- service-only). firm_id derived server-side; only the caller's own documents.
create or replace function public.enqueue_triage(p_document_id uuid)
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
  perform 1 from public.documents where id = p_document_id and firm_id = v_firm;
  if not found then
    raise exception 'document not found in firm';
  end if;
  perform pgmq.send('triage', jsonb_build_object('firm_id', v_firm, 'document_id', p_document_id));
end;
$$;
revoke execute on function public.enqueue_triage(uuid) from public, anon;
grant execute on function public.enqueue_triage(uuid) to authenticated;

-- correct_classification: a human overrides the AI's type. Updates the document
-- (documents has no authenticated UPDATE — this definer is the path), flips the
-- classification to human-decided, and stores a few-shot example for future triage.
create or replace function public.correct_classification(p_document_id uuid, p_doc_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_cnpj text;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  if p_doc_type is null or length(p_doc_type) = 0 then
    raise exception 'doc type required';
  end if;

  update public.documents set doc_type = p_doc_type
  where id = p_document_id and firm_id = v_firm;
  if not found then
    raise exception 'document not found in firm';
  end if;

  update public.classifications
  set decided_by = 'human', suggested_type = p_doc_type
  where document_id = p_document_id and firm_id = v_firm
  returning extracted_cnpj into v_cnpj;

  insert into public.classification_examples (firm_id, document_id, doc_type, extracted_cnpj, context)
  values (v_firm, p_document_id, p_doc_type, v_cnpj, jsonb_build_object('source', 'correction'));

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'classification.corrected', 'document', p_document_id,
          jsonb_build_object('docType', p_doc_type));
end;
$$;
revoke execute on function public.correct_classification(uuid, text) from public, anon;
grant execute on function public.correct_classification(uuid, text) to authenticated;

-- Route public-page uploads (T16) through AI triage too (T21): re-create the upload
-- RPC with one added pgmq.send. (Body identical to 20260616021000 plus the enqueue.)
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
    select id into v_doc_id from public.documents
    where firm_id = r.firm_id and company_id = r.company_id and hash = p_hash;
  end if;

  update public.document_requests set status = 'received' where id = r.id;
  insert into public.document_request_events
    (firm_id, request_id, event_type, ip, user_agent, context)
  values
    (r.firm_id, r.id, 'received', p_ip, p_user_agent,
     jsonb_build_object('documentId', v_doc_id, 'fileName', p_file_name));

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (r.firm_id, null, 'document.created', 'document', v_doc_id,
          jsonb_build_object('source', 'request', 'requestId', r.id, 'fileName', p_file_name));

  -- T21: public-page uploads flow through AI triage too.
  perform pgmq.send('triage', jsonb_build_object('firm_id', r.firm_id, 'document_id', v_doc_id));

  return v_doc_id;
end;
$$;
