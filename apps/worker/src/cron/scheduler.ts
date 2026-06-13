import { Cron } from 'croner';

// Worker-side crons (PLANEJAMENTO §3). v1 ships logging stubs; real work lands
// with each feature task. NOTE: in-process scheduling assumes a SINGLE worker
// instance (one Railway worker service per firm). If the worker is ever scaled
// horizontally, croner has no leader election and every instance would fire —
// move to pg_cron or add a lock then.

export interface CronStub {
  name: string;
  /** Production schedule (5-field cron). */
  pattern: string;
  run: () => void | Promise<void>;
}

export const CRON_STUBS: CronStub[] = [
  {
    name: 'deadlines-daily',
    pattern: '0 6 * * *',
    run: () => console.log('[cron] deadlines-daily — stub (T15 recomputes deadline statuses)'),
  },
  {
    name: 'recurrences-monthly',
    pattern: '0 0 1 * *',
    run: () => console.log('[cron] recurrences-monthly — stub (T11 generates the period tasks)'),
  },
  {
    name: 'alerts',
    pattern: '0 * * * *',
    run: () => console.log('[cron] alerts — stub (T17 reminder sweep)'),
  },
];

// Every 10s (6-field, includes seconds) so crons are observable in dev.
const ACCELERATED_PATTERN = '*/10 * * * * *';

export function startCrons(accelerated: boolean): Cron[] {
  return CRON_STUBS.map(
    (stub) =>
      new Cron(accelerated ? ACCELERATED_PATTERN : stub.pattern, { name: stub.name }, () => {
        void stub.run();
      }),
  );
}
