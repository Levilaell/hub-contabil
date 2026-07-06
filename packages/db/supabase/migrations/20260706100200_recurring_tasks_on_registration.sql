-- Fase 1.1 §2 · Recurring tasks at registration: when a company is created, its
-- current-month recurring tasks are generated immediately instead of waiting for
-- the monthly cron (the accountant expects "cadastrou → tarefas do mês já existem",
-- e.g. Simples Nacional → apuração/PGDAS). Same matching + idempotency rules as the
-- worker generator (apps/worker recurrences.ts): active templates targeting 'all',
-- a selection containing the company, or the company's tax regime; NOT EXISTS on
-- (template, company, period) regardless of status so nothing is resurrected; the
-- partial unique index tasks_recurrence_period_uniq is the hard backstop.
-- SECURITY DEFINER because tasks INSERT is RLS-gated by department membership and
-- the registrar may not belong to every department. Idempotent.

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
    select t.id, t.firm_id, t.title, t.department, t.handoff_to
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
      (firm_id, company_id, period, department, title, handoff_to, recurring_task_id, status)
    select m.firm_id, p_company_id, v_period, m.department, m.title, m.handoff_to, m.id, 'pending'
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
