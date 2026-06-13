-- T4 · Let owner/manager edit firms.config, and give authenticated (human)
-- actions a safe audit path. Idempotent.

-- firms.config is editable by owner/manager of the caller's own firm. The column
-- grant (config only) is what prevents name/id edits; the policy adds row + role.
grant update (config) on public.firms to authenticated;

drop policy if exists firms_update on public.firms;
create policy firms_update on public.firms
  for update to authenticated
  using (
    id = public.current_firm_id()
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('owner', 'manager')
  )
  with check (id = public.current_firm_id());

-- log_audit: the ONLY way an authenticated (human) user can write the audit
-- trail. firm_id and actor_id are stamped server-side, never parameters, so an
-- entry cannot be forged. Robot/worker actions write directly via the service
-- role instead (they have no auth.uid()). SECURITY DEFINER with an empty
-- search_path (everything schema-qualified) — the standard hardening against
-- privilege escalation.
create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_id uuid;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_context, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.log_audit(text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;
