import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordException } from './exception-sink';

// Proves the DLQ → exception_queue insert actually works against the cloud:
// firm_id extraction, a real source value passing the CHECK, service-role insert,
// default status. Skipped without env.

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);
const FIRM = '11111111-1111-4111-8111-111111111111';

describe.skipIf(!hasEnv)('recordException (cloud dev)', () => {
  let sql: Sql;

  beforeAll(() => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
  });

  afterAll(async () => {
    if (sql) {
      await sql`delete from public.exception_queue where context->>'error' in ('boom-t9', 'boom-t9-nofirm')`;
      await sql.end();
    }
  });

  it('inserts a firm-scoped open exception from a dead-lettered job', async () => {
    await recordException(sql, {
      queue: 'enrichment',
      payload: { firm_id: FIRM, company_id: '00000000-0000-4000-8000-000000000000' },
      error: 'boom-t9',
      readCt: 3,
    });

    const rows = await sql<{ firm_id: string; source: string; status: string; context: unknown }[]>`
      select firm_id, source, status, context from public.exception_queue
      where firm_id = ${FIRM} and context->>'error' = 'boom-t9'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe('enrichment');
    expect(rows[0]?.status).toBe('open');
    const ctx = (
      typeof rows[0]?.context === 'string' ? JSON.parse(rows[0].context) : rows[0]?.context
    ) as { read_ct?: number };
    expect(ctx.read_ct).toBe(3);
  });

  it('skips (no row) when the payload has no firm_id', async () => {
    await recordException(sql, {
      queue: 'enrichment',
      payload: { nope: true },
      error: 'boom-t9-nofirm',
      readCt: 3,
    });
    const rows = await sql`
      select id from public.exception_queue where context->>'error' = 'boom-t9-nofirm'
    `;
    expect(rows).toHaveLength(0);
  });
});
