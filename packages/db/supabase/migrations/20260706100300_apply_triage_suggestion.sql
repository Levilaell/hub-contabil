-- Fase 1.1 §3 · Close the triage loop: resolving a triage exception can now APPLY
-- the (possibly corrected) suggestion to the document instead of only marking the
-- exception resolved — before this, an exception-ed document stayed 'other' with no
-- company forever and the AI never learned. One privileged RPC does the whole unit:
-- update the document (type/company/department), flip the classification to
-- human-decided, store a few-shot example (golden rule #5 — human resolution feeds
-- back examples), resolve the exception, audit. documents has no authenticated
-- UPDATE grant, hence SECURITY DEFINER (same stance as correct_classification).
-- Idempotent.

create or replace function public.apply_triage_suggestion(
  p_exception_id uuid,
  p_doc_type text,
  p_company_id uuid default null,
  p_department text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_exception public.exception_queue%rowtype;
  v_document_id uuid;
  v_cnpj text;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  if p_doc_type is null or length(p_doc_type) = 0 then
    raise exception 'doc type required';
  end if;

  select * into v_exception from public.exception_queue
  where id = p_exception_id and firm_id = v_firm and source = 'triage' and status = 'open';
  if not found then
    raise exception 'exception not found or already resolved';
  end if;

  v_document_id := nullif(v_exception.context->>'documentId', '')::uuid;
  if v_document_id is null then
    raise exception 'exception has no document';
  end if;

  if p_company_id is not null then
    perform 1 from public.companies where id = p_company_id and firm_id = v_firm;
    if not found then
      raise exception 'company not found in firm';
    end if;
  end if;

  update public.documents
  set doc_type = p_doc_type,
      department = coalesce(p_department, department),
      company_id = coalesce(p_company_id, company_id)
  where id = v_document_id and firm_id = v_firm;
  if not found then
    raise exception 'document not found in firm';
  end if;

  update public.classifications
  set decided_by = 'human', suggested_type = p_doc_type
  where document_id = v_document_id and firm_id = v_firm
  returning extracted_cnpj into v_cnpj;

  insert into public.classification_examples (firm_id, document_id, doc_type, extracted_cnpj, context)
  values (v_firm, v_document_id, p_doc_type, v_cnpj,
          jsonb_build_object('source', 'exception_resolution',
                             'reason', v_exception.context->>'reason',
                             'fileName', v_exception.context->>'fileName'));

  update public.exception_queue
  set status = 'resolved',
      resolution = jsonb_build_object(
        'resolvedBy', auth.uid(),
        'resolvedAt', now(),
        'note', coalesce(p_note, ''),
        'applied', jsonb_build_object(
          'docType', p_doc_type, 'companyId', p_company_id, 'department', p_department)
      )
  where id = p_exception_id;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'triage.suggestion_applied', 'document', v_document_id,
          jsonb_build_object('exceptionId', p_exception_id, 'docType', p_doc_type,
                             'companyId', p_company_id, 'department', p_department));
end;
$$;

revoke execute on function public.apply_triage_suggestion(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.apply_triage_suggestion(uuid, text, uuid, text, text) to authenticated;
