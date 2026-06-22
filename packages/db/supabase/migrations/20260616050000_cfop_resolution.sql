-- T19 · CFOP resolution side-channel. The authorized fiscal XML is immutable (golden
-- rule #4): the entry CFOP a rule resolves is DERIVED data, written to
-- documents.metadata.entry_cfop — never back into the file. The documents table grants
-- no UPDATE to authenticated (path/hash/file are write-once), so this SECURITY DEFINER
-- RPC is the one way to set the derived metadata: scoped to the caller's firm, it
-- touches only the metadata column. Idempotent — re-applying overwrites entry_cfop.

create or replace function public.apply_cfop_metadata(
  p_document_id uuid,
  p_entries jsonb
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

  update public.documents
  set metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('entry_cfop', coalesce(p_entries, '[]'::jsonb))
  where id = p_document_id and firm_id = v_firm;
  if not found then
    raise exception 'document not found';
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'document.cfop_applied', 'document', p_document_id,
          jsonb_build_object('entries', coalesce(p_entries, '[]'::jsonb)));
end;
$$;

revoke execute on function public.apply_cfop_metadata(uuid, jsonb) from public, anon;
grant execute on function public.apply_cfop_metadata(uuid, jsonb) to authenticated;
