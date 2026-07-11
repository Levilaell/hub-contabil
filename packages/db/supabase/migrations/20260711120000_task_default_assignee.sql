-- T28 · Task assignment. Recurring templates gain an optional default assignee so
-- auto-generated tasks stop being born ownerless; both generators (this RPC at
-- registration + the worker's monthly cron) carry it into tasks.assignee_id.
-- Assignment/reassignment from the drawer is a plain RLS-scoped UPDATE (managers
-- or department members) audited via log_audit — no new RPC needed. Idempotent.

alter table public.recurring_tasks
  add column if not exists default_assignee_id uuid references public.users(id) on delete set null;

-- Regenerate the registration-time generator including the default assignee.
create or replace function public.generate_recurring_tasks_for_company(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_firm uuid := public.current_firm_id();
  v_period text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  v_created integer := 0;
begin
  if v_firm is null then
    raise exception 'no firm in session';
  end if;
  perform 1 from public.companies
  where id = p_company_id and firm_id = v_firm and status = 'active';
  if not found then
    raise exception 'company not found in firm';
  end if;

  with matching as (
    select t.id, t.firm_id, t.title, t.department, t.handoff_to, t.default_assignee_id
    from public.recurring_tasks t
    join public.companies c on c.id = p_company_id and c.firm_id = t.firm_id
    where t.firm_id = v_firm
      and t.active = true
      and (
        t.target_kind = 'all'
        or (t.target_kind = 'selection'
            and t.target_value ? 'companyIds'
            and t.target_value->'companyIds' @> to_jsonb(p_company_id::text))
        or (t.target_kind = 'by_regime'
            and c.tax_regime is not null
            and t.target_value ? 'regimes'
            and t.target_value->'regimes' @> to_jsonb(c.tax_regime))
      )
  ),
  inserted as (
    insert into public.tasks
      (firm_id, company_id, period, department, title, handoff_to, recurring_task_id, status, assignee_id)
    select m.firm_id, p_company_id, v_period, m.department, m.title, m.handoff_to, m.id, 'pending',
           m.default_assignee_id
    from matching m
    where not exists (
      select 1 from public.tasks x
      where x.recurring_task_id = m.id and x.company_id = p_company_id and x.period = v_period
    )
    returning id
  )
  select count(*) into v_created from inserted;

  if v_created > 0 then
    insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
    values (v_firm, auth.uid(), 'tasks.generated_on_registration', 'company', p_company_id,
            jsonb_build_object('period', v_period, 'created', v_created));
  end if;

  return v_created;
end;
$$;

revoke execute on function public.generate_recurring_tasks_for_company(uuid) from public, anon;
grant execute on function public.generate_recurring_tasks_for_company(uuid) to authenticated;
