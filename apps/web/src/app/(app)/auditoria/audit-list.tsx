'use client';

import type { AuditEvent } from '@hub/db';
import { EmptyState } from '@hub/ui';
import { ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { copy, inputClass } from './copy';

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

function actionLabel(action: string): string {
  return copy.actions[action] ?? action;
}

function entityLabel(entity: string): string {
  return copy.entities[entity] ?? entity;
}

// Colour the event by the nature of the action, so the timeline reads at a glance.
type Tone = 'success' | 'warning' | 'danger' | 'neutral';
function toneFor(action: string): Tone {
  if (/(deleted|removed|cancelled|ignored)/.test(action)) return 'danger';
  if (/(exception|escalated|pending)/.test(action)) return 'warning';
  if (/(created|imported|activated|built|sent|requested|resolved|replied|enriched)/.test(action))
    return 'success';
  return 'neutral';
}
const dotClass: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-neutral',
};

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function AuditList({ events, entity }: { events: AuditEvent[]; entity: string }) {
  const router = useRouter();

  function onFilter(value: string) {
    router.push(value === 'all' ? '/auditoria' : `/auditoria?entity=${value}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label htmlFor="entity" className="text-muted-foreground text-xs font-medium">
          {copy.filterLabel}
        </label>
        <select
          id="entity"
          value={entity}
          onChange={(e) => onFilter(e.target.value)}
          className={`${inputClass} max-w-xs`}
        >
          <option value="all">{copy.filterAll}</option>
          {Object.entries(copy.entities).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {events.length === 0 ? (
        <EmptyState icon={ScrollText} title={copy.empty} />
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const tone = toneFor(ev.action);
            const entries = Object.entries(ev.context);
            return (
              <li key={ev.id} className="bg-card flex items-start gap-3 rounded-xl border p-4">
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dotClass[tone]}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{actionLabel(ev.action)}</p>
                    <time
                      dateTime={ev.createdAt}
                      title={new Date(ev.createdAt).toLocaleString('pt-BR')}
                      className="text-muted-foreground shrink-0 text-xs"
                    >
                      {timeAgo(ev.createdAt)}
                    </time>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {ev.actorName ?? copy.system} · {entityLabel(ev.entity)}
                  </p>
                  {entries.length > 0 ? (
                    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1 text-xs">
                      {entries.map(([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <dt className="text-muted-foreground font-mono">{key}:</dt>
                          <dd className="break-all">{renderValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
