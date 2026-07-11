-- T33 · Manual department on support tickets. Until now only the reception menu
-- could tag a ticket's department — a human couldn't set or correct it, so
-- unrouted tickets stayed unroutable. Firm-scoped SECURITY DEFINER, audited.
-- The department vocabulary lives in firms.config; the UI offers only those
-- keys, here we just guard shape. Idempotent.

create or replace function public.set_ticket_department(p_ticket_id uuid, p_department text)
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
  if p_department is null or length(btrim(p_department)) = 0 then
    raise exception 'empty department';
  end if;

  update public.support_tickets
  set department = btrim(p_department)
  where id = p_ticket_id and firm_id = v_firm;
  if not found then
    raise exception 'ticket not found in firm';
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'support.department_set', 'support_ticket', p_ticket_id,
          jsonb_build_object('department', btrim(p_department)));
end;
$$;
revoke execute on function public.set_ticket_department(uuid, text) from public, anon;
grant execute on function public.set_ticket_department(uuid, text) to authenticated;
