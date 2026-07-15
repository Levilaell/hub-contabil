-- T39 (decision #2, 2026-07-14): deactivating a recurring template may ALSO
-- cancel its still-open instances (pending/in_progress, any period), at the
-- user's choice. One RPC keeps the whole operation atomic and audited per task.
-- Note the generators' idempotency index ignores status on purpose, so a
-- canceled instance is NOT regenerated for the same period if the template is
-- reactivated. SECURITY DEFINER, firm-scoped, owner/manager only. Idempotent.

create or replace function public.deactivate_recurring_task(
  p_template_id uuid,
  p_cancel_open boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_cancelled integer := 0;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  if not public.is_firm_manager() then
    raise exception 'only owners/managers manage recurring templates';
  end if;

  update public.recurring_tasks
  set active = false
  where id = p_template_id and firm_id = v_firm;
  if not found then
    raise exception 'recurring task not found in firm';
  end if;

  if p_cancel_open then
    with open_tasks as (
      select id, status from public.tasks
      where firm_id = v_firm
        and recurring_task_id = p_template_id
        and status in ('pending', 'in_progress')
      for update
    ), cancelled as (
      update public.tasks t
      set status = 'canceled'
      from open_tasks o
      where t.id = o.id and t.firm_id = v_firm
      returning t.id, o.status as old_status
    )
    insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
    select v_firm, auth.uid(), 'task.status_changed', 'task', c.id,
           jsonb_build_object(
             'from', c.old_status,
             'to', 'canceled',
             'source', 'recurring_deactivation',
             'recurringTaskId', p_template_id
           )
    from cancelled c;
    get diagnostics v_cancelled = row_count;
  end if;

  insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
  values (v_firm, auth.uid(), 'recurring_task.deactivated', 'recurring_task', p_template_id,
          jsonb_build_object('cancelOpen', p_cancel_open, 'cancelledCount', v_cancelled));

  return v_cancelled;
end;
$$;
revoke execute on function public.deactivate_recurring_task(uuid, boolean) from public, anon;
grant execute on function public.deactivate_recurring_task(uuid, boolean) to authenticated;
