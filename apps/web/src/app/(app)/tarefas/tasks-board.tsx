'use client';

import { TASK_STATUSES, allowedTaskTransitions, canHandoffTask, type TaskStatus } from '@hub/core';
import type { Task } from '@hub/db';
import { DetailDrawer, EmptyState, StatusBadge, type StatusTone } from '@hub/ui';
import { ListChecks } from 'lucide-react';
import { useState, useTransition } from 'react';

import { assignAction, handoffAction, updateStatusAction, type TaskActionState } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

const TONE: Record<TaskStatus, StatusTone> = {
  pending: 'neutral',
  in_progress: 'warning',
  done: 'success',
  canceled: 'muted',
};

interface BoardProps {
  tasks: Task[];
  view: 'mine' | 'all' | 'unassigned';
  me: string;
  companyNames: Record<string, string>;
  departmentLabels: Record<string, string>;
  userNames: Record<string, string>;
  userOptions: { id: string; name: string }[];
  /** Recurring template titles, for the drawer's origin line (T32). */
  recurringTitles?: Record<string, string>;
}

export function TasksBoard({
  tasks,
  view,
  me,
  companyNames,
  departmentLabels,
  userNames,
  userOptions,
  recurringTitles = {},
}: BoardProps) {
  const [selected, setSelected] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<TaskActionState>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && !res.ok) setError(res.message);
      else setSelected(null);
    });
  }

  function assigneeText(task: Task): string {
    if (!task.assigneeId) return copy.unassigned;
    if (task.assigneeId === me) return copy.you;
    return userNames[task.assigneeId] ?? '';
  }

  // Where the task came from (T32) — every creation path is nameable.
  function originText(task: Task): string {
    if (task.recurringTaskId) {
      const template = recurringTitles[task.recurringTaskId];
      return template ? copy.drawer.originRecurring(template) : copy.drawer.originRecurringGeneric;
    }
    if (task.monitoredDocumentId) return copy.drawer.originDeadline;
    if (task.sourceTaskId) return copy.drawer.originHandoff;
    return copy.drawer.originManual;
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={
          view === 'mine'
            ? copy.emptyMine
            : view === 'unassigned'
              ? copy.emptyUnassigned
              : copy.emptyAll
        }
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const column = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {copy.columns[status]} · {column.length}
              </h3>
              <div className="space-y-2">
                {column.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setSelected(task);
                      setError(null);
                    }}
                    className="bg-card hover:bg-accent focus-visible:ring-ring w-full rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-2"
                  >
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="text-muted-foreground mt-1 block truncate text-xs">
                      {companyNames[task.companyId] ?? '—'} ·{' '}
                      {departmentLabels[task.department] ?? task.department}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {assigneeText(task)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.title ?? ''}
        closeLabel={copy.drawer.close}
        footer={
          selected ? (
            <div className="space-y-3">
              {error ? <p className="text-danger-text text-sm">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                {allowedTaskTransitions(selected.status).map((to) =>
                  // Completing a task that has a handoff target performs the handoff
                  // (creates the next department's task) instead of a plain "done".
                  to === 'done' && selected.handoffTo && canHandoffTask(selected.status) ? (
                    <button
                      key="handoff"
                      type="button"
                      disabled={pending}
                      onClick={() => act(() => handoffAction(selected.id))}
                      className={primaryButtonClass}
                    >
                      {copy.handoff}
                    </button>
                  ) : (
                    <button
                      key={to}
                      type="button"
                      disabled={pending}
                      onClick={() => act(() => updateStatusAction(selected.id, to))}
                      className={to === 'done' ? primaryButtonClass : secondaryButtonClass}
                    >
                      {copy.transition[to]}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{copy.drawer.company}</dt>
              <dd className="mt-0.5">{companyNames[selected.companyId] ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{copy.drawer.department}</dt>
              <dd className="mt-0.5">
                {departmentLabels[selected.department] ?? selected.department}
              </dd>
            </div>
            {selected.period ? (
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.period}</dt>
                <dd className="mt-0.5">{selected.period}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground text-xs">{copy.drawer.assignee}</dt>
              <dd className="mt-0.5">
                {selected.status === 'done' || selected.status === 'canceled' ? (
                  assigneeText(selected)
                ) : (
                  // Assign/reassign in place (T28) — saves on change, audited.
                  <select
                    aria-label={copy.drawer.assignee}
                    value={selected.assigneeId ?? ''}
                    disabled={pending}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      setError(null);
                      startTransition(async () => {
                        const res = await assignAction(selected.id, value);
                        if (res && !res.ok) setError(res.message);
                        else setSelected({ ...selected, assigneeId: value });
                      });
                    }}
                    className={inputClass}
                  >
                    <option value="">{copy.unassigned}</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.id === me ? copy.you : u.name}
                      </option>
                    ))}
                  </select>
                )}
              </dd>
            </div>
            {selected.handoffTo ? (
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.handoffTo}</dt>
                <dd className="mt-0.5">
                  {departmentLabels[selected.handoffTo] ?? selected.handoffTo}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground text-xs">{copy.drawer.origin}</dt>
              <dd className="mt-0.5">
                {originText(selected)}
                <span className="text-muted-foreground block text-xs">
                  {copy.drawer.createdAt(
                    new Date(selected.createdAt).toLocaleDateString('pt-BR'),
                  )}
                </span>
              </dd>
            </div>
            <div>
              <StatusBadge tone={TONE[selected.status]} label={copy.badge[selected.status]} />
            </div>
          </dl>
        ) : null}
      </DetailDrawer>
    </>
  );
}
