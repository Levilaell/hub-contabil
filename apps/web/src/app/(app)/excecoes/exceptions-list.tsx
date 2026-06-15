'use client';

import type { ExceptionItem } from '@hub/db';
import { DataList, DataListRow, DetailDrawer, StatusBadge, type StatusTone } from '@hub/ui';
import { AlertTriangle } from 'lucide-react';
import { useState, useTransition } from 'react';

import { resolveExceptionAction } from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  open: { tone: 'warning', label: copy.badge.open },
  resolved: { tone: 'success', label: copy.badge.resolved },
  ignored: { tone: 'muted', label: copy.badge.ignored },
};

function sourceLabel(source: string): string {
  return copy.sources[source] ?? source;
}

function ctxValue(ctx: Record<string, unknown>, key: string): string | null {
  const v = ctx[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

export function ExceptionsList({ exceptions }: { exceptions: ExceptionItem[] }) {
  const [selected, setSelected] = useState<ExceptionItem | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(item: ExceptionItem) {
    setSelected(item);
    setNote('');
    setError(null);
  }

  function resolve(status: 'resolved' | 'ignored') {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = await resolveExceptionAction(selected.id, status, note);
      if (res && !res.ok) setError(res.message);
      else setSelected(null);
    });
  }

  const errorText = selected ? ctxValue(selected.context, 'error') : null;
  const attempts = selected ? ctxValue(selected.context, 'read_ct') : null;
  const payload = selected?.context.payload;
  const hasSuggestion = selected ? Object.keys(selected.suggestion).length > 0 : false;
  const resolvedBy = selected ? ctxValue(selected.resolution, 'resolvedBy') : null;

  return (
    <>
      <DataList>
        {exceptions.map((item) => (
          <DataListRow
            key={item.id}
            onClick={() => open(item)}
            leading={
              <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
            }
            title={ctxValue(item.context, 'error') ?? sourceLabel(item.source)}
            facts={[sourceLabel(item.source), timeAgo(item.createdAt)]}
            trailing={
              <StatusBadge tone={STATUS[item.status].tone} label={STATUS[item.status].label} />
            }
          />
        ))}
      </DataList>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? sourceLabel(selected.source) : copy.drawer.title}
        description={copy.drawer.title}
        closeLabel={copy.drawer.close}
        footer={
          selected?.status === 'open' ? (
            <div className="space-y-3">
              {error ? <p className="text-danger-text text-sm">{error}</p> : null}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.drawer.notePlaceholder}
                rows={2}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resolve('resolved')}
                  disabled={pending}
                  className={primaryButtonClass}
                >
                  {pending ? copy.drawer.working : copy.drawer.resolve}
                </button>
                <button
                  type="button"
                  onClick={() => resolve('ignored')}
                  disabled={pending}
                  className={secondaryButtonClass}
                >
                  {copy.drawer.ignore}
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{copy.drawer.error}</dt>
              <dd className="mt-0.5 font-medium">{errorText ?? copy.noError}</dd>
            </div>
            <div className="flex gap-6">
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.origin}</dt>
                <dd className="mt-0.5">{sourceLabel(selected.source)}</dd>
              </div>
              {attempts ? (
                <div>
                  <dt className="text-muted-foreground text-xs">{copy.drawer.attempts}</dt>
                  <dd className="mt-0.5">{attempts}</dd>
                </div>
              ) : null}
            </div>

            {hasSuggestion ? (
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.suggestion}</dt>
                <dd className="mt-0.5">{JSON.stringify(selected.suggestion)}</dd>
              </div>
            ) : null}

            {selected.status !== 'open' && resolvedBy ? (
              <div>
                <dt className="text-muted-foreground text-xs">{copy.drawer.resolvedBy}</dt>
                <dd className="mt-0.5">
                  {STATUS[selected.status].label}
                  {ctxValue(selected.resolution, 'note')
                    ? ` — ${ctxValue(selected.resolution, 'note')}`
                    : ''}
                </dd>
              </div>
            ) : null}

            {payload !== undefined ? (
              <details className="rounded-lg border p-3">
                <summary className="text-muted-foreground cursor-pointer text-xs">
                  {copy.drawer.technical}
                </summary>
                <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </details>
            ) : null}
          </dl>
        ) : null}
      </DetailDrawer>
    </>
  );
}
