import type { EmailMessage, MessagingAdapter, SendResult } from '@hub/adapters';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runRequestReminderSweep } from './request-reminders';

// Reminder sweep test against Supabase Cloud dev. Proves: a 'sent' request past
// the window is re-sent to the resolved contact (with a rotated link), the request
// stays 'sent' (state machine respected), a 'reminded' event is logged, the sweep
// is idempotent (sent_at bumped → not re-picked), and a request with no contact
// e-mail goes to the exception queue (rule #6). Skipped without env.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM_A = '11111111-1111-4111-8111-111111111111';

class FakeMessaging implements MessagingAdapter {
  sent: EmailMessage[] = [];
  sendEmail(message: EmailMessage): Promise<SendResult> {
    this.sent.push(message);
    return Promise.resolve({ ok: true });
  }
}

describe.skipIf(!hasEnv)('runRequestReminderSweep (cloud dev)', () => {
  let sql: Sql;
  let withEmailCo = '';
  let noEmailCo = '';
  let reqWithEmail = '';
  let reqNoEmail = '';
  const messaging = new FakeMessaging();
  const now = new Date();
  const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000);
  const future = new Date(now.getTime() + 7 * 86_400_000);

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });

    const [a] = await sql<{ id: string }[]>`
      insert into public.companies (firm_id, cnpj, legal_name)
      values (${FIRM_A}, '67000000000011', 'Reminder Co A')
      on conflict (firm_id, cnpj) do update set legal_name = excluded.legal_name
      returning id`;
    withEmailCo = a!.id;
    await sql`
      insert into public.contacts (firm_id, company_id, name, email, is_primary)
      values (${FIRM_A}, ${withEmailCo}, 'Contato', 'cliente@empresa.test', true)`;

    const [b] = await sql<{ id: string }[]>`
      insert into public.companies (firm_id, cnpj, legal_name)
      values (${FIRM_A}, '67000000000022', 'Reminder Co B')
      on conflict (firm_id, cnpj) do update set legal_name = excluded.legal_name
      returning id`;
    noEmailCo = b!.id;

    const [r1] = await sql<{ id: string }[]>`
      insert into public.document_requests
        (firm_id, company_id, kind, title, token_hash, expires_at, status, sent_at)
      values (${FIRM_A}, ${withEmailCo}, 'upload_request', 'Lembrar A',
              'rem-hash-a', ${future}, 'sent', ${sixDaysAgo})
      returning id`;
    reqWithEmail = r1!.id;

    const [r2] = await sql<{ id: string }[]>`
      insert into public.document_requests
        (firm_id, company_id, kind, title, token_hash, expires_at, status, sent_at)
      values (${FIRM_A}, ${noEmailCo}, 'upload_request', 'Lembrar B',
              'rem-hash-b', ${future}, 'sent', ${sixDaysAgo})
      returning id`;
    reqNoEmail = r2!.id;
  });

  afterAll(async () => {
    if (!sql) return;
    for (const id of [reqWithEmail, reqNoEmail]) {
      await sql`delete from public.document_request_events where request_id = ${id}`;
      await sql`delete from public.document_requests where id = ${id}`;
    }
    await sql`delete from public.exception_queue where source = 'requests'
              and context->>'requestId' in (${reqWithEmail}, ${reqNoEmail})`;
    await sql`delete from public.audit_events where action = 'request.reminded'
              and entity_id in (${reqWithEmail}, ${reqNoEmail})`;
    await sql`delete from public.contacts where company_id = ${withEmailCo}`;
    await sql`delete from public.companies where id in (${withEmailCo}, ${noEmailCo})`;
    await sql.end();
  });

  it('reminds a due request, logs it, stays sent, and is idempotent; no e-mail → exception', async () => {
    const r1 = await runRequestReminderSweep(sql, now, {
      messaging,
      baseUrl: 'https://app.test',
    });
    expect(r1.reminded).toBeGreaterThanOrEqual(1);
    expect(r1.exceptions).toBeGreaterThanOrEqual(1);

    // A real e-mail went to the resolved contact, with a /s/ link.
    const toClient = messaging.sent.find((m) => m.to === 'cliente@empresa.test');
    expect(toClient).toBeTruthy();
    expect(toClient!.body).toContain('https://app.test/s/');

    // End-to-end: the worker-stored hash (node:crypto) must match what the public
    // RPC computes — i.e. the rotated link actually resolves.
    const match = toClient!.body.match(/\/s\/(\S+)/);
    expect(match).not.toBeNull();
    const [resolved] = await sql<{ status: string }[]>`
      select status from public.get_request_by_token(${match![1]!})`;
    expect(resolved?.status).toBe('sent');

    // Request stays 'sent' (state machine respected); reminded event logged.
    const [req] = await sql<{ status: string; last_reminded_at: string | null }[]>`
      select status, last_reminded_at from public.document_requests where id = ${reqWithEmail}`;
    expect(req!.status).toBe('sent');
    expect(req!.last_reminded_at).not.toBeNull();
    const [remindedEvents] = await sql<{ n: number }[]>`
      select count(*)::int n from public.document_request_events
      where request_id = ${reqWithEmail} and event_type = 'reminded'`;
    expect(remindedEvents?.n).toBe(1);

    // No-contact request went to the exception queue (rule #6).
    const [exceptions] = await sql<{ e: number }[]>`
      select count(*)::int e from public.exception_queue
      where source = 'requests' and context->>'requestId' = ${reqNoEmail}`;
    expect(exceptions?.e).toBeGreaterThanOrEqual(1);

    // Idempotent: last_reminded_at was stamped → the second sweep re-picks nothing
    // (no duplicate reminder AND no duplicate exception).
    const before = messaging.sent.length;
    const r2 = await runRequestReminderSweep(sql, now, { messaging, baseUrl: 'https://app.test' });
    expect(r2.reminded).toBe(0);
    expect(r2.exceptions).toBe(0);
    expect(messaging.sent.length).toBe(before);
  });
});
