import type { Sql } from 'postgres';
import type { z } from 'zod';

// Generic pgmq job runner. pgmq has no native DLQ, so we count attempts via
// read_ct and move exhausted messages to a sibling "<queue>_dlq" (golden rule
// #6: errors never block the batch, never fail silently). DLQ contents feed the
// exception queue in T9 — logged until then.

export type JobHandler<T> = (payload: T) => Promise<void> | void;

export interface QueueRegistration {
  queue: string;
  schema: z.ZodType<unknown>;
  handler: JobHandler<unknown>;
  options?: ProcessOptions;
}

/** Type-safe registration: schema and handler are paired at the call site. */
export function defineQueueJob<T>(reg: {
  queue: string;
  schema: z.ZodType<T>;
  handler: JobHandler<T>;
  options?: ProcessOptions;
}): QueueRegistration {
  return {
    queue: reg.queue,
    schema: reg.schema as z.ZodType<unknown>,
    handler: reg.handler as JobHandler<unknown>,
    options: reg.options,
  };
}

/** Info handed to the dead-letter sink (T9): feeds the exception queue. */
export interface DeadLetterInfo {
  queue: string;
  /** The raw message (may be an invalid payload — that's why it failed). */
  payload: unknown;
  error: string;
  readCt: number;
}
export type DeadLetterSink = (info: DeadLetterInfo) => Promise<void> | void;

export interface ProcessOptions {
  /** Visibility timeout while a message is being processed (seconds). In prod
   *  this MUST exceed the max handler runtime or a slow job is read twice. */
  vt?: number;
  /** Batch size per poll. */
  qty?: number;
  /** Exponential backoff base in seconds; 0 = retry immediately (used in tests). */
  baseBackoff?: number;
  /** Attempts before a message is dead-lettered. */
  maxAttempts?: number;
  /** Called after a message lands in the DLQ (T9: record it in the exception
   *  queue). Best-effort — the message is already safe in the DLQ. */
  onDeadLetter?: DeadLetterSink;
}

export interface ProcessResult {
  processed: number;
  retried: number;
  deadLettered: number;
}

interface PgmqRow {
  msg_id: string | number;
  read_ct: number;
  message: unknown;
}

// pgmq's jsonb `message` arrives as a parsed object or a JSON string depending on
// the driver/protocol (postgres.js returns a string under the pooler's simple
// protocol). Normalize before validating.
function toMessageObject(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Read and process one batch from a queue. Returns per-outcome counts. */
export async function processQueueOnce<T>(
  sql: Sql,
  queue: string,
  schema: z.ZodType<T>,
  handler: JobHandler<T>,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const { vt = 30, qty = 10, baseBackoff = 2, maxAttempts = 3, onDeadLetter } = options;
  const rows = await sql<PgmqRow[]>`
    select msg_id, read_ct, message from pgmq.read(${queue}::text, ${vt}, ${qty})
  `;
  const result: ProcessResult = { processed: 0, retried: 0, deadLettered: 0 };

  for (const row of rows) {
    const msgId = row.msg_id;
    const readCt = Number(row.read_ct);
    const raw = toMessageObject(row.message);
    try {
      const payload = schema.parse(raw);
      await handler(payload);
      await sql`select pgmq.delete(${queue}::text, ${msgId}::bigint)`;
      result.processed += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (readCt >= maxAttempts) {
        const envelope = {
          payload: raw,
          error: reason,
          read_ct: readCt,
          failed_at: new Date().toISOString(),
        };
        await sql`select pgmq.send(${`${queue}_dlq`}::text, ${JSON.stringify(envelope)}::jsonb)`;
        await sql`select pgmq.delete(${queue}::text, ${msgId}::bigint)`;
        result.deadLettered += 1;
        console.error(
          `[queue:${queue}] msg ${String(msgId)} → DLQ after ${readCt} attempts: ${reason}`,
        );
        if (onDeadLetter) {
          try {
            await onDeadLetter({ queue, payload: raw, error: reason, readCt });
          } catch (sinkError) {
            // The message is already safe in the DLQ — never let the sink hide it.
            console.error(
              `[queue:${queue}] dead-letter sink failed (message preserved in the DLQ):`,
              sinkError,
            );
          }
        }
      } else {
        const delaySeconds = Math.round(baseBackoff * 2 ** (readCt - 1));
        await sql`select pgmq.set_vt(${queue}::text, ${msgId}::bigint, ${delaySeconds})`;
        result.retried += 1;
        console.warn(
          `[queue:${queue}] msg ${String(msgId)} attempt ${readCt} failed; retry in ${delaySeconds}s: ${reason}`,
        );
      }
    }
  }

  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls registered queues in a loop until stopped. */
export class JobRunner {
  private running = false;

  constructor(
    private readonly sql: Sql,
    private readonly registrations: QueueRegistration[],
    private readonly pollIntervalMs = 2000,
    /** Shared dead-letter sink applied to every queue (overridable per options). */
    private readonly onDeadLetter?: DeadLetterSink,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      for (const reg of this.registrations) {
        try {
          await processQueueOnce(this.sql, reg.queue, reg.schema, reg.handler, {
            ...reg.options,
            onDeadLetter: reg.options?.onDeadLetter ?? this.onDeadLetter,
          });
        } catch (error) {
          // A queue-level failure (transient DB error, etc.) must not kill the loop.
          console.error(`[queue:${reg.queue}] poll error:`, error);
        }
      }
      await delay(this.pollIntervalMs);
    }
  }
}
