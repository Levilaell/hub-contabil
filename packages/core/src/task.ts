// Task state machine (T10, PLANEJAMENTO §5). Pure — the single source of truth
// for valid transitions; the web UI and @hub/db both call canTransitionTask so
// they never disagree (an invalid transition is rejected in core, db, and UI).

export const TASK_STATUSES = ['pending', 'in_progress', 'done', 'canceled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// pending → in_progress → done; cancel from either open state. done/canceled terminal.
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'canceled'],
  in_progress: ['done', 'canceled'],
  done: [],
  canceled: [],
};

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

/** The statuses a task can move to from `from` (empty for terminal states). */
export function allowedTaskTransitions(from: TaskStatus): TaskStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// A task can be handed off while still open. MUST mirror the status guard in the
// SQL handoff_task RPC — if these drift, handoff and the rest of the app disagree.
export const HANDOFFABLE_STATUSES: TaskStatus[] = ['pending', 'in_progress'];

export function canHandoffTask(status: TaskStatus): boolean {
  return HANDOFFABLE_STATUSES.includes(status);
}
