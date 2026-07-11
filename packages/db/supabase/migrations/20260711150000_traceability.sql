-- T32 · Traceability. Two gaps: (1) auto-imported partners (QSA from the CNPJ
-- lookup/enrichment) were indistinguishable from hand-entered ones — a `source`
-- column marks them; (2) the registration-time task generator audited only ONE
-- aggregate event on the company, so individual tasks had no per-item trail —
-- it now also writes a task.created audit row per generated task (the monthly
-- cron gains the same in the worker). Idempotent.

alter table public.company_partners
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'qsa'));

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
    returning id, recurring_task_id
  ),
  -- Per-item trail (T32): each generated task gets its own task.created event.
  audited as (
    insert into public.audit_events (firm_id, actor_id, action, entity, entity_id, context)
    select v_firm, auth.uid(), 'task.created', 'task', i.id,
           jsonb_build_object('source', 'recurrence', 'recurringTaskId', i.recurring_task_id,
                              'period', v_period, 'companyId', p_company_id)
    from inserted i
    returning 1
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
