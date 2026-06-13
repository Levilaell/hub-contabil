import type { Cron } from 'croner';
import postgres from 'postgres';

import { startCrons } from './cron/scheduler.js';
import { loadEnv } from './env.js';
import {
  exportPayloadSchema,
  notificationPayloadSchema,
  triagePayloadSchema,
} from './queue/payloads.js';
import { JobRunner, type QueueRegistration, defineQueueJob } from './queue/runner.js';

// Worker: pgmq consumers + crons against Supabase Cloud. Handlers are stubs in
// T5 (real work arrives with each feature task); the runner, retry/DLQ, and the
// cron schedule are the deliverables.
async function main(): Promise<void> {
  const env = loadEnv();
  // prepare: false — required on the connection pooler.
  const sql = postgres(env.DATABASE_URL, { prepare: false });

  const [row] = await sql<{ now: Date; version: string }[]>`
    select now() as now, version() as version
  `;
  if (!row) {
    throw new Error('Connectivity probe returned no rows');
  }
  console.log(`[worker] connected to Supabase Cloud — db time ${row.now.toISOString()}`);

  const registrations: QueueRegistration[] = [
    defineQueueJob({
      queue: 'triage',
      schema: triagePayloadSchema,
      handler: (payload) => console.log(`[triage] stub received document ${payload.document_id}`),
    }),
    defineQueueJob({
      queue: 'export',
      schema: exportPayloadSchema,
      handler: (payload) => console.log(`[export] stub received batch ${payload.batch_id}`),
    }),
    defineQueueJob({
      queue: 'notifications',
      schema: notificationPayloadSchema,
      handler: (payload) =>
        console.log(`[notifications] stub received ${payload.template} for ${payload.to}`),
    }),
  ];

  const runner = new JobRunner(sql, registrations);
  runner.start();
  console.log(`[worker] job runner polling: ${registrations.map((r) => r.queue).join(', ')}`);

  const crons: Cron[] = startCrons(env.CRON_ACCELERATED);
  console.log(
    `[worker] crons scheduled (${env.CRON_ACCELERATED ? 'accelerated' : 'production'}): ${crons
      .map((c) => c.name)
      .join(', ')}`,
  );

  const heartbeat = setInterval(() => {
    console.log(`[worker] heartbeat ${new Date().toISOString()}`);
  }, 30_000);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal} received, closing`);
    clearInterval(heartbeat);
    runner.stop();
    for (const cron of crons) {
      cron.stop();
    }
    await sql.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error('[worker] fatal during startup:', error);
  process.exit(1);
});
