import type { Sql } from 'postgres';

// Recurrence generation (T11). For each active template (all firms — service role),
// generate the period's tasks idempotently: one per matching company, skipping any
// that already exist for (template, company, period) REGARDLESS of status, so a
// completed task is never resurrected. firm_id is carried on both sides and the
// company join is firm-scoped (golden rule #1) — a stray foreign company id in a
// selection can't generate a cross-firm task and can't abort the template's run.

export interface GenerateResult {
  templates: number;
  created: number;
  skipped: number;
}

interface TemplateRow {
  id: string;
  firm_id: string;
  title: string;
  department: string;
  target_kind: string;
  target_value: unknown;
  handoff_to: string | null;
  default_assignee_id: string | null;
}

function asObject(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

/** Current competência (YYYY-MM). Takes `now` so the generator stays deterministic. */
export function currentPeriod(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function generateRecurringTasks(sql: Sql, period: string): Promise<GenerateResult> {
  const templates = await sql<TemplateRow[]>`
    select id, firm_id, title, department, target_kind, target_value, handoff_to,
           default_assignee_id
    from public.recurring_tasks
    where active = true
  `;
  const result: GenerateResult = { templates: templates.length, created: 0, skipped: 0 };

  for (const t of templates) {
    // Default is the 'all' filter; selection/by_regime override it.
    let companyFilter = sql`c.status = 'active'`;
    if (t.target_kind === 'selection') {
      const ids = stringArray(asObject(t.target_value).companyIds);
      if (ids.length === 0) {
        result.skipped += 1;
        console.warn(`[recurrences] template ${t.id} has an empty selection; skipping`);
        continue;
      }
      companyFilter = sql`c.id = any(${ids}::uuid[])`;
    } else if (t.target_kind === 'by_regime') {
      const regimes = stringArray(asObject(t.target_value).regimes);
      if (regimes.length === 0) {
        result.skipped += 1;
        console.warn(`[recurrences] template ${t.id} has an empty regime list; skipping`);
        continue;
      }
      companyFilter = sql`c.tax_regime = any(${regimes}::text[])`;
    } else if (t.target_kind !== 'all') {
      result.skipped += 1;
      console.warn(
        `[recurrences] template ${t.id} has unknown target_kind ${t.target_kind}; skipping`,
      );
      continue;
    }

    // firm-scoped company join; NOT EXISTS has no status filter (don't resurrect
    // completed tasks). The partial unique index is the hard backstop.
    const inserted = await sql<{ id: string }[]>`
      insert into public.tasks
        (firm_id, company_id, period, department, title, handoff_to, recurring_task_id, status, assignee_id)
      select ${t.firm_id}, c.id, ${period}, ${t.department}, ${t.title}, ${t.handoff_to}, ${t.id}, 'pending',
             ${t.default_assignee_id}
      from public.companies c
      where c.firm_id = ${t.firm_id}
        and ${companyFilter}
        and not exists (
          select 1 from public.tasks x
          where x.recurring_task_id = ${t.id} and x.company_id = c.id and x.period = ${period}
        )
      returning id
    `;
    result.created += inserted.length;
  }

  return result;
}
