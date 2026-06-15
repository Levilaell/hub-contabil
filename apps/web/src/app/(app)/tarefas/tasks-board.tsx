'use client';

import { TASK_STATUSES, allowedTaskTransitions, canHandoffTask, type TaskStatus } from '@hub/core';
import type { Task } from '@hub/db';
import { DetailDrawer, EmptyState, StatusBadge, type StatusTone } from '@hub/ui';
import { ListChecks } from 'lucide-react';
import { useState, useTransition } from 'react';

import { handoffAction, updateStatusAction, type TaskActionState } from './actions';
import { copy, primaryButtonClass, secondaryButtonClass } from './copy';

const TONE: Record<TaskStatus, StatusTone> = {
  pending: 'neutral',
  in_progress: 'warning',
  done: 'success',
  canceled: 'muted',
};

interface BoardProps {
  tasks: Task[];
  view: 'mine' | 'all';
  me: string;
  companyNames: Record<string, string>;
  departmentLabels: Record<string, string>;
  userNames: Record<string, string>;
}

export function TasksBoard({
  tasks,
  view,
  me,
  companyNames,
  departmentLabels,
  userNames,
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

  if (tasks.length === 0) {
    return (
      <EmptyState icon={ListChecks} title={view === 'mine' ? copy.emptyMine : copy.emptyAll} />
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
              <dd className="mt-0.5">{assigneeText(selected)}</dd>
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
              <StatusBadge tone={TONE[selected.status]} label={copy.badge[selected.status]} />
            </div>
          </dl>
        ) : null}
      </DetailDrawer>
    </>
  );
}
