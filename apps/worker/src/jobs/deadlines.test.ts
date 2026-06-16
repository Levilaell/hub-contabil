import type { EmailMessage, MessagingAdapter, SendResult } from '@hub/adapters';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runDeadlineSweep } from './deadlines';

// Deadline sweep test against Supabase Cloud dev. Proves the rollover transitions
// (valid → due_soon → overdue), the alert on each, and the renewal-task idempotency
// — including the advisor's "force stored back, still one task" case (the open-task
// guard is the real idempotency, not the transition). Skipped without env.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM_A = '11111111-1111-4111-8111-111111111111';
const CNPJ = '66000000000011';

// due 2026-07-01, trigger 30 → window opens 2026-06-01.
const DUE = '2026-07-01';
const BEFORE = '2026-05-01';
const IN_WINDOW = '2026-06-10';
const PAST_DUE = '2026-07-05';

class FakeMessaging implements MessagingAdapter {
  sent: EmailMessage[] = [];
  sendEmail(message: EmailMessage): Promise<SendResult> {
    this.sent.push(message);
    return Promise.resolve({ ok: true });
  }
}

describe.skipIf(!hasEnv)('runDeadlineSweep (cloud dev)', () => {
  let sql: Sql;
  let companyId = '';
  let docId = '';
  const messaging = new FakeMessaging();

  async function storedStatus(): Promise<string> {
    const [row] = await sql<{ status: string }[]>`
      select status from public.monitored_documents where id = ${docId}
    `;
    return row?.status ?? '';
  }
  async function renewalTaskCount(): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int n from public.tasks where monitored_document_id = ${docId}
    `;
    return row?.n ?? 0;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
    const [company] = await sql<{ id: string }[]>`
      insert into public.companies (firm_id, cnpj, legal_name)
      values (${FIRM_A}, ${CNPJ}, 'Prazos T15 Co')
      on conflict (firm_id, cnpj) do update set legal_name = excluded.legal_name
      returning id
    `;
    companyId = company!.id;
    const [doc] = await sql<{ id: string }[]>`
      insert into public.monitored_documents (firm_id, company_id, doc_kind, due_date, trigger_days, status)
      values (${FIRM_A}, ${companyId}, 'cnd_federal', ${DUE}, 30, 'valid')
      returning id
    `;
    docId = doc!.id;
  });

  afterAll(async () => {
    if (sql) {
      await sql`delete from public.audit_events where entity_id in (select id from public.tasks where monitored_document_id = ${docId})`;
      await sql`delete from public.tasks where monitored_document_id = ${docId}`;
      await sql`delete from public.notifications where entity_id = ${companyId} and kind = 'deadline'`;
      await sql`delete from public.monitored_documents where id = ${docId}`;
      await sql`delete from public.companies where id = ${companyId}`;
      await sql.end();
    }
  });

  it('no transition before the alert window', async () => {
    await runDeadlineSweep(sql, BEFORE, { messaging });
    expect(await storedStatus()).toBe('valid');
    expect(await renewalTaskCount()).toBe(0);
  });

  it('transitions to due_soon inside the window and alerts (no task)', async () => {
    await runDeadlineSweep(sql, IN_WINDOW, { messaging });
    expect(await storedStatus()).toBe('due_soon');
    expect(await renewalTaskCount()).toBe(0);
    const [note] = await sql`
      select 1 from public.notifications where entity_id = ${companyId} and kind = 'deadline'
    `;
    expect(note).toBeTruthy();
  });

  it('transitions to overdue and creates exactly one renewal task', async () => {
    await runDeadlineSweep(sql, PAST_DUE, { messaging });
    expect(await storedStatus()).toBe('overdue');
    expect(await renewalTaskCount()).toBe(1);
    const [task] = await sql<{ title: string }[]>`
      select title from public.tasks where monitored_document_id = ${docId}
    `;
    expect(task?.title).toMatch(/^Renovar /);
  });

  it('is idempotent on re-run (no second task)', async () => {
    await runDeadlineSweep(sql, PAST_DUE, { messaging });
    expect(await renewalTaskCount()).toBe(1);
  });

  it('the open-task guard holds even if the stored status is reset', async () => {
    // Force a re-transition; the guard (open task exists), not the transition, is
    // what keeps it to one task.
    await sql`update public.monitored_documents set status = 'valid' where id = ${docId}`;
    await runDeadlineSweep(sql, PAST_DUE, { messaging });
    expect(await renewalTaskCount()).toBe(1);
  });
});
