import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { currentPeriod, generateRecurringTasks } from './recurrences';

// Generation test against Supabase Cloud dev. Proves idempotency (run twice = no
// dup), correct period, firm-scoping (a foreign company id in a selection is
// ignored, not an error), and no-resurrect (a completed task isn't regenerated).
// Skipped without env. Uses a far-future period to avoid touching real data.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM_A = '11111111-1111-4111-8111-111111111111';
const FIRM_B = '99999999-9999-4999-8999-999999999999';
const PERIOD = '2099-01';

describe.skipIf(!hasEnv)('generateRecurringTasks (cloud dev)', () => {
  let sql: Sql;
  let templateId = '';
  const companyIds: string[] = [];
  let foreignCompanyId = '';

  async function insertCompany(firmId: string, cnpj: string): Promise<string> {
    const [row] = await sql<{ id: string }[]>`
      insert into public.companies (firm_id, cnpj, legal_name)
      values (${firmId}, ${cnpj}, ${'Rec ' + cnpj})
      on conflict (firm_id, cnpj) do update set legal_name = excluded.legal_name
      returning id
    `;
    if (!row) throw new Error('insert company failed');
    return row.id;
  }

  async function countForTemplate(): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int n from public.tasks
      where recurring_task_id = ${templateId} and period = ${PERIOD}
    `;
    return row?.n ?? 0;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
    await sql`insert into public.firms (id, name) values (${FIRM_B}, 'Foreign B') on conflict (id) do nothing`;
    companyIds.push(await insertCompany(FIRM_A, '90000000000001'));
    companyIds.push(await insertCompany(FIRM_A, '90000000000002'));
    companyIds.push(await insertCompany(FIRM_A, '90000000000003'));
    foreignCompanyId = await insertCompany(FIRM_B, '90000000000099');

    // Selection template for firm A whose list ALSO contains a firm-B company id.
    const [tpl] = await sql<{ id: string }[]>`
      insert into public.recurring_tasks (firm_id, title, department, target_kind, target_value)
      values (${FIRM_A}, 'Rotina mensal', 'fiscal', 'selection',
              ${sql.json({ companyIds: [...companyIds, foreignCompanyId] })})
      returning id
    `;
    if (!tpl) throw new Error('insert template failed');
    templateId = tpl.id;
  });

  afterAll(async () => {
    if (sql) {
      await sql`delete from public.tasks where recurring_task_id = ${templateId}`;
      await sql`delete from public.recurring_tasks where id = ${templateId}`;
      await sql`delete from public.companies where id = any(${companyIds}::uuid[])`;
      await sql`delete from public.firms where id = ${FIRM_B}`; // cascades the foreign company
      await sql.end();
    }
  });

  it('generates one task per in-firm company, ignoring the foreign id', async () => {
    const result = await generateRecurringTasks(sql, PERIOD);
    expect(result.created).toBeGreaterThanOrEqual(3);
    expect(await countForTemplate()).toBe(3); // 3 firm-A companies; foreign id ignored, no error

    const rows = await sql<{ company_id: string; period: string }[]>`
      select company_id, period from public.tasks where recurring_task_id = ${templateId}
    `;
    expect(rows.every((r) => r.period === PERIOD)).toBe(true);
    expect(rows.some((r) => r.company_id === foreignCompanyId)).toBe(false);
  });

  it('is idempotent on a second run', async () => {
    await generateRecurringTasks(sql, PERIOD);
    expect(await countForTemplate()).toBe(3); // no duplicates
  });

  it('does not resurrect a completed generated task', async () => {
    await sql`
      update public.tasks set status = 'done'
      where recurring_task_id = ${templateId} and company_id = ${companyIds[0]!} and period = ${PERIOD}
    `;
    await generateRecurringTasks(sql, PERIOD);
    expect(await countForTemplate()).toBe(3); // the completed one is not recreated
  });

  it('computes the competência from a date', () => {
    expect(currentPeriod(new Date('2026-06-15T00:00:00Z'))).toBe('2026-06');
  });

  it('stamps the template default assignee on generated tasks (T28)', async () => {
    // Any seeded firm-A user works as the assignee (users FK auth.users, so the
    // test reuses one instead of inserting).
    const [user] = await sql<{ id: string }[]>`
      select id from public.users where firm_id = ${FIRM_A} limit 1
    `;
    if (!user) throw new Error('no seeded firm-A user available');

    const [tpl] = await sql<{ id: string }[]>`
      insert into public.recurring_tasks
        (firm_id, title, department, target_kind, target_value, default_assignee_id)
      values (${FIRM_A}, 'Rotina com dono', 'fiscal', 'selection',
              ${sql.json({ companyIds: [companyIds[0]!] })}, ${user.id})
      returning id
    `;
    if (!tpl) throw new Error('insert template failed');

    try {
      await generateRecurringTasks(sql, PERIOD);
      const [task] = await sql<{ assignee_id: string | null }[]>`
        select assignee_id from public.tasks
        where recurring_task_id = ${tpl.id} and period = ${PERIOD}
      `;
      expect(task?.assignee_id).toBe(user.id);
    } finally {
      await sql`delete from public.tasks where recurring_task_id = ${tpl.id}`;
      await sql`delete from public.recurring_tasks where id = ${tpl.id}`;
    }
  });
});
