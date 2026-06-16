// Deadline status derivation (T14, PLANEJAMENTO §5). Pure: takes calendar-date
// STRINGS (YYYY-MM-DD) and never reads a clock — `today` is always a parameter, so
// the result is deterministic across web SSR, the deadline cron, and tests.
// 'needs_update' is NOT a date status: it's set by the exception flow and must be
// preserved by callers. This function only ever returns the four date statuses.

export type MonitoredStatus = 'no_date' | 'valid' | 'due_soon' | 'overdue' | 'needs_update';
export type MonitoredDateStatus = Exclude<MonitoredStatus, 'needs_update'>;

/** A due date's contribution to a traffic light (null = no data, excluded). */
export type DeadlineSignal = 'overdue' | 'upcoming' | 'ok' | null;

// YYYY-MM-DD minus `days`, as a string. Deterministic UTC arithmetic on the input
// (no clock) — only used to find the start of the alert window.
function subtractDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function deriveMonitoredStatus(
  dueDate: string | null,
  triggerDays: number,
  today: string,
): MonitoredDateStatus {
  if (!dueDate) return 'no_date';
  if (dueDate < today) return 'overdue'; // strictly past
  // dueDate >= today: due_soon once today is inside the alert window [due-trigger, due].
  const windowStart = subtractDays(dueDate, Math.max(0, Math.trunc(triggerDays)));
  if (today >= windowStart) return 'due_soon';
  return 'valid'; // still far out
}

/** Map a stored/derived status to its traffic-light signal (T13 aggregation). */
export function monitoredToDeadlineSignal(status: MonitoredStatus): DeadlineSignal {
  switch (status) {
    case 'overdue':
    case 'needs_update':
      return 'overdue';
    case 'due_soon':
      return 'upcoming';
    case 'valid':
      return 'ok';
    case 'no_date':
      return null;
  }
}
