// Ops utility: run the deadline sweep once, on demand (the same job the
// `deadlines-daily` cron runs on schedule). Useful to force a recompute/alert pass
// outside the 06:00 window, and used by the deadline E2E. Reads apps/worker/.env.
//   node --env-file=.env --import tsx ops-deadline-sweep.mjs
import { NoopMessagingAdapter, createMessagingAdapter } from '@hub/adapters';
import postgres from 'postgres';

import { runDeadlineSweep, todayInSaoPaulo } from './src/jobs/deadlines.ts';

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15 });
// Real Resend adapter if configured, else no-op (alerts are skipped, sweep still runs).
const messaging = process.env.RESEND_API_KEY ? createMessagingAdapter(process.env) : new NoopMessagingAdapter();

try {
  const result = await runDeadlineSweep(sql, todayInSaoPaulo(), { messaging });
  console.log(`[ops] deadline sweep: ${JSON.stringify(result)}`);
} catch (e) {
  console.error('[ops] deadline sweep failed:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
