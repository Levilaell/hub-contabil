import type { Sql } from 'postgres';

import type { DeadLetterInfo } from '../queue/runner.js';

// DLQ → exception queue (T9). When a job dead-letters, the worker (service role)
// records it in exception_queue so it surfaces on the exception screen instead of
// dying silently in the DLQ (golden rule #6). source = the queue name (all worker
// queues are valid sources per the exception_queue CHECK).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firmIdOf(payload: unknown): string | null {
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>).firm_id;
    if (typeof value === 'string' && UUID.test(value)) return value;
  }
  return null;
}

export async function recordException(sql: Sql, info: DeadLetterInfo): Promise<void> {
  const firmId = firmIdOf(info.payload);
  if (!firmId) {
    // No firm_id (malformed payload) → can't create a firm-scoped exception. The
    // message stays in the DLQ for manual inspection. Loud, never silent.
    console.error(
      `[exception] cannot record ${info.queue} dead-letter — no firm_id in payload:`,
      info.payload,
    );
    return;
  }
  const context = { payload: info.payload, error: info.error, read_ct: info.readCt };
  // sql.json stores a real jsonb object; `${JSON.stringify(x)}::jsonb` would
  // double-encode it into a jsonb *string* (breaks ->> / jsonb_typeof queries).
  await sql`
    insert into public.exception_queue (firm_id, source, context)
    values (${firmId}, ${info.queue}, ${sql.json(context as Parameters<typeof sql.json>[0])})
  `;
}
