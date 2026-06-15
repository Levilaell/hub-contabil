import { Cron } from 'croner';
import type { Sql } from 'postgres';

import { currentPeriod, generateRecurringTasks } from '../jobs/recurrences.js';

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

export function buildCronJobs(sql: Sql): CronJob[] {
  return [
    {
      name: 'deadlines-daily',
      pattern: '0 6 * * *',
      run: () => console.log('[cron] deadlines-daily — stub (T15 recomputes deadline statuses)'),
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
      run: () => console.log('[cron] alerts — stub (T17 reminder sweep)'),
    },
  ];
}

// Every 10s (6-field, includes seconds) so crons are observable in dev.
const ACCELERATED_PATTERN = '*/10 * * * * *';

export function startCrons(accelerated: boolean, sql: Sql): Cron[] {
  return buildCronJobs(sql).map(
    (job) =>
      new Cron(accelerated ? ACCELERATED_PATTERN : job.pattern, { name: job.name }, () => {
        void job.run();
      }),
  );
}
