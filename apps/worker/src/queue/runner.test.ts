import { Cron } from 'croner';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { basePayloadSchema } from './payloads';
import { processQueueOnce } from './runner';

const DATABASE_URL = process.env.DATABASE_URL;
const hasEnv = Boolean(DATABASE_URL);

const TEST_QUEUE = 't5_test';
const TEST_DLQ = 't5_test_dlq';
const testSchema = z.object({ firm_id: z.string().uuid(), n: z.number() });
const FIRM = '11111111-1111-4111-8111-111111111111';

describe('cron scheduler', () => {
  it('fires on schedule (accelerated 1s tick)', async () => {
    let count = 0;
    const job = new Cron('*/1 * * * * *', () => {
      count += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    job.stop();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

describe('base payload schema', () => {
  it('rejects a payload without firm_id (golden rule #1, enforced structurally)', () => {
    expect(basePayloadSchema.safeParse({}).success).toBe(false);
    expect(basePayloadSchema.safeParse({ firm_id: FIRM }).success).toBe(true);
  });
});

describe.skipIf(!hasEnv)('pgmq job runner (cloud dev)', () => {
  let sql: Sql;

  async function recreate(queue: string): Promise<void> {
    const existing = await sql`select 1 from pgmq.list_queues() where queue_name = ${queue}`;
    if (existing.length > 0) {
      await sql`select pgmq.drop_queue(${queue}::text)`;
    }
    await sql`select pgmq.create(${queue}::text)`;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error('missing DATABASE_URL');
    sql = postgres(DATABASE_URL, { prepare: false });
    await recreate(TEST_QUEUE);
    await recreate(TEST_DLQ);
  });

  afterAll(async () => {
    if (sql) {
      for (const queue of [TEST_QUEUE, TEST_DLQ]) {
        const existing = await sql`select 1 from pgmq.list_queues() where queue_name = ${queue}`;
        if (existing.length > 0) {
          await sql`select pgmq.drop_queue(${queue}::text)`;
        }
      }
      await sql.end();
    }
  });

  it('processes an enqueued job and removes it from the queue', async () => {
    await sql`select pgmq.send(${TEST_QUEUE}::text, ${JSON.stringify({ firm_id: FIRM, n: 7 })}::jsonb)`;
    const seen: number[] = [];
    const result = await processQueueOnce(sql, TEST_QUEUE, testSchema, (p) => {
      seen.push(p.n);
    });
    expect(result.processed).toBe(1);
    expect(seen).toEqual([7]);
    // queue now empty
    const left = await sql`select msg_id from pgmq.read(${TEST_QUEUE}::text, 0, 10)`;
    expect(left.length).toBe(0);
  });

  it('dead-letters a job after 3 failed attempts', async () => {
    await sql`select pgmq.send(${TEST_QUEUE}::text, ${JSON.stringify({ firm_id: FIRM, n: 99 })}::jsonb)`;
    const failing = () => {
      throw new Error('boom');
    };
    // baseBackoff 0 → immediate re-read, no timers needed.
    let last = { processed: 0, retried: 0, deadLettered: 0 };
    for (let i = 0; i < 3; i += 1) {
      last = await processQueueOnce(sql, TEST_QUEUE, testSchema, failing, {
        baseBackoff: 0,
        vt: 5,
      });
    }
    expect(last.deadLettered).toBe(1);

    // original queue is empty, DLQ holds the enriched envelope
    const left = await sql`select msg_id from pgmq.read(${TEST_QUEUE}::text, 0, 10)`;
    expect(left.length).toBe(0);

    const dlq = await sql<{ message: unknown }[]>`
      select message from pgmq.read(${TEST_DLQ}::text, 0, 10)
    `;
    expect(dlq.length).toBe(1);
    const rawMessage = dlq[0]?.message;
    const envelope = (typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage) as {
      error: string;
      read_ct: number;
      payload: { n: number };
    };
    expect(envelope.error).toBe('boom');
    expect(envelope.read_ct).toBe(3);
    expect(envelope.payload.n).toBe(99);
  });
});
