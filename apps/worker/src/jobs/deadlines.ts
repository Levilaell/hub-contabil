import type { MessagingAdapter } from '@hub/adapters';
import { parseFirmConfig } from '@hub/config';
import { deriveMonitoredStatus } from '@hub/core';
import type { Sql } from 'postgres';

// Deadline sweep (T15, deadlines-daily cron). Recomputes each monitored document's
// status (the stored column is a cache; skip needs_update), and on a TRANSITION to
// due_soon/overdue emits an in-app notification + e-mail (via the adapter). On a
// transition to overdue it creates a "Renovar …" task — idempotent via the
// monitored_document_id link (no duplicate while an open one exists). Runs as the
// service role across ALL firms, so every query carries firm_id and reads THAT
// firm's config (golden rule #1). `today` is a parameter so a rollover is testable.

export interface SweepResult {
  scanned: number;
  transitions: number;
  alerts: number;
  tasksCreated: number;
}

interface SweepRow {
  id: string;
  firm_id: string;
  company_id: string;
  doc_kind: string;
  due_date: string;
  trigger_days: number;
  status: string;
  legal_name: string;
  trade_name: string | null;
}

/** Firm-local "today" (Brazil, v1) as YYYY-MM-DD. */
export function todayInSaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function resolveRenewalDepartment(config: ReturnType<typeof parseFirmConfig>): string {
  const configured = config.deadlineTriggers.renewalDepartment;
  if (config.departments.some((d) => d.key === configured)) return configured;
  const fallback = config.departments[0]?.key ?? 'fiscal';
  console.warn(
    `[deadlines] renewalDepartment '${configured}' is not a firm department; using '${fallback}'`,
  );
  return fallback;
}

export async function runDeadlineSweep(
  sql: Sql,
  today: string,
  deps: { messaging: MessagingAdapter },
): Promise<SweepResult> {
  const firms = await sql<{ id: string; config: unknown }[]>`select id, config from public.firms`;
  const configByFirm = new Map(firms.map((f) => [f.id, parseFirmConfig(f.config)]));

  const rows = await sql<SweepRow[]>`
    select md.id, md.firm_id, md.company_id, md.doc_kind,
           md.due_date::text as due_date, -- postgres.js parses date → Date; we need YYYY-MM-DD
           md.trigger_days, md.status, c.legal_name, c.trade_name
    from public.monitored_documents md
    join public.companies c on c.id = md.company_id
    where md.status <> 'needs_update' and md.due_date is not null
  `;
  console.log(`[deadlines] scanning ${rows.length} dated monitored document(s) for ${today}`);

  const result: SweepResult = { scanned: rows.length, transitions: 0, alerts: 0, tasksCreated: 0 };

  for (const row of rows) {
    const config = configByFirm.get(row.firm_id);
    if (!config) continue;

    const computed = deriveMonitoredStatus(row.due_date, row.trigger_days, today);
    if (computed === row.status) continue; // no transition
    result.transitions += 1;

    // Advance the stored cache FIRST, then alert — a missed alert beats a dup.
    await sql`
      update public.monitored_documents set status = ${computed}
      where id = ${row.id} and firm_id = ${row.firm_id}
    `;

    if (computed !== 'due_soon' && computed !== 'overdue') continue;

    const kindLabel =
      config.monitoredKinds.find((k) => k.key === row.doc_kind)?.label ?? row.doc_kind;
    const companyName = row.trade_name || row.legal_name;
    const dept = resolveRenewalDepartment(config);
    const title = `${kindLabel} — ${companyName}`;
    const body = computed === 'overdue' ? `Vencido em ${row.due_date}` : `Vence em ${row.due_date}`;

    await sql`
      insert into public.notifications (firm_id, department, kind, title, body, entity, entity_id)
      values (${row.firm_id}, ${dept}, 'deadline', ${title}, ${body}, 'company', ${row.company_id})
    `;
    await deps.messaging.sendEmail({ to: `firm:${row.firm_id}`, subject: `Prazo: ${title}`, body });
    result.alerts += 1;

    if (computed === 'overdue' && config.deadlineTriggers.autoRenewalTask) {
      // Idempotency guard: only create when no open task already links this doc.
      const [existing] = await sql`
        select 1 from public.tasks
        where monitored_document_id = ${row.id} and status in ('pending', 'in_progress')
        limit 1
      `;
      if (!existing) {
        const [task] = await sql<{ id: string }[]>`
          insert into public.tasks
            (firm_id, company_id, department, title, status, monitored_document_id)
          values (${row.firm_id}, ${row.company_id}, ${dept}, ${`Renovar ${title}`}, 'pending', ${row.id})
          returning id
        `;
        if (task) {
          await sql`
            insert into public.audit_events (firm_id, action, entity, entity_id, context)
            values (${row.firm_id}, 'task.created', 'task', ${task.id},
                    ${sql.json({ source: 'deadline', monitoredDocumentId: row.id })})
          `;
          result.tasksCreated += 1;
        }
      }
    }
  }

  return result;
}
