import {
  NoopMessagingAdapter,
  createImapInboundAdapter,
  createMessagingAdapter,
  imapConfigured,
  isMessagingConfigured,
} from '@hub/adapters';
import { Cron } from 'croner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sql } from 'postgres';

import { runDeadlineSweep, todayInSaoPaulo } from '../jobs/deadlines.js';
import { runImapPoll } from '../jobs/imap-poll.js';
import { currentPeriod, generateRecurringTasks } from '../jobs/recurrences.js';
import { runRequestReminderSweep } from '../jobs/request-reminders.js';

// Worker-side crons (PLANEJAMENTO §3). recurrences-monthly is wired to real
// generation (T11); the others remain logging stubs until their feature task.
// NOTE: in-process scheduling assumes a SINGLE worker instance (one Railway
// worker service per firm). If scaled horizontally, croner has no leader election
// and every instance would fire — move to pg_cron or add a lock then.

export interface CronJob {
  name: string;
  /** Production schedule (5-field cron). */
  pattern: string;
  run: () => void | Promise<void>;
}

export function buildCronJobs(sql: Sql, storage?: SupabaseClient): CronJob[] {
  // Deadline alerts go to a firm placeholder recipient (not a real inbox yet), so
  // they stay on the no-op. Request reminders go to real client e-mails, so they
  // use the configured adapter (Resend when RESEND_API_KEY is set, else no-op).
  const messaging = new NoopMessagingAdapter();
  const clientMessaging = createMessagingAdapter();
  const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const jobs: CronJob[] = [
    {
      name: 'deadlines-daily',
      pattern: '0 6 * * *',
      run: async () => {
        const r = await runDeadlineSweep(sql, todayInSaoPaulo(), { messaging });
        console.log(
          `[cron] deadlines-daily: ${r.transitions} transition(s), ${r.alerts} alert(s), ${r.tasksCreated} renewal task(s) from ${r.scanned} scanned`,
        );
      },
    },
    {
      name: 'recurrences-monthly',
      pattern: '0 0 1 * *',
      run: async () => {
        const period = currentPeriod(new Date());
        const r = await generateRecurringTasks(sql, period);
        console.log(
          `[cron] recurrences-monthly ${period}: created ${r.created} task(s) from ${r.templates} template(s), ${r.skipped} skipped`,
        );
      },
    },
    {
      name: 'alerts',
      pattern: '0 * * * *',
      run: async () => {
        // T26: with no provider configured the no-op adapter would fake
        // deliveries and write 'reminded' events for e-mails that never left.
        if (!isMessagingConfigured()) {
          console.log('[cron] alerts: skipped — messaging not configured');
          return;
        }
        const r = await runRequestReminderSweep(sql, new Date(), {
          messaging: clientMessaging,
          baseUrl: appBaseUrl,
        });
        console.log(
          `[cron] alerts: ${r.reminded} reminder(s), ${r.exceptions} exception(s) from ${r.scanned} scanned`,
        );
      },
    },
  ];

  // E-mail inbound (entrada por IMAP). Only scheduled when an inbox is configured
  // and Storage is available (it stores attachments) — off by default, like the
  // other adapter-gated features.
  if (storage && imapConfigured()) {
    const imap = createImapInboundAdapter();
    jobs.push({
      name: 'inbound-imap',
      pattern: '*/10 * * * *',
      run: async () => {
        const r = await runImapPoll(sql, storage, imap);
        console.log(
          `[cron] inbound-imap: ${r.routed} routed, ${r.skipped} skipped from ${r.scanned} scanned`,
        );
      },
    });
  }

  return jobs;
}

// Every 10s (6-field, includes seconds) so crons are observable in dev.
const ACCELERATED_PATTERN = '*/10 * * * * *';

export function startCrons(accelerated: boolean, sql: Sql, storage?: SupabaseClient): Cron[] {
  return buildCronJobs(sql, storage).map(
    (job) =>
      new Cron(accelerated ? ACCELERATED_PATTERN : job.pattern, { name: job.name }, () => {
        void job.run();
      }),
  );
}
