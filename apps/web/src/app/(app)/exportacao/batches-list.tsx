'use client';

import type { ExportBatch } from '@hub/db';
import { DataList, DataListRow, DetailDrawer, EmptyState, StatusBadge, type StatusTone } from '@hub/ui';
import { Download, PackageOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { downloadBatchAction } from './actions';
import { copy, primaryButtonClass } from './copy';

const TONE: Record<string, StatusTone> = {
  building: 'warning',
  ready: 'success',
  failed: 'danger',
  downloaded: 'neutral',
};

interface IncludedEntry {
  exportName?: string;
  originalName?: string;
  companyCnpj?: string;
  entryCfops?: string[];
}
interface ExcludedEntry {
  fileName?: string;
  companyCnpj?: string;
}

function manifestCounts(manifest: Record<string, unknown>) {
  const included = Array.isArray(manifest.included) ? (manifest.included as IncludedEntry[]) : [];
  const excluded = Array.isArray(manifest.excluded) ? (manifest.excluded as ExcludedEntry[]) : [];
  const count = typeof manifest.count === 'number' ? manifest.count : included.length;
  const excludedCount =
    typeof manifest.excludedCount === 'number' ? manifest.excludedCount : excluded.length;
  return { included, excluded, count, excludedCount };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function BatchesList({ batches }: { batches: ExportBatch[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ExportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function download(batch: ExportBatch) {
    setError(null);
    startTransition(async () => {
      const res = await downloadBatchAction(batch.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      window.open(res.url, '_blank', 'noopener');
      router.refresh();
    });
  }

  if (batches.length === 0) {
    return <EmptyState icon={PackageOpen} title={copy.list.empty} description={copy.list.emptyHint} />;
  }

  const detail = selected ? manifestCounts(selected.manifest) : null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">{copy.list.title}</h2>
      {error ? <p className="text-danger-text text-sm">{error}</p> : null}

      <DataList>
        {batches.map((batch) => {
          const { count, excludedCount } = manifestCounts(batch.manifest);
          const facts = [
            formatDate(batch.createdAt),
            batch.period ?? null,
            batch.status === 'ready' || batch.status === 'downloaded'
              ? copy.list.files(count)
              : null,
            excludedCount > 0 ? copy.list.excluded(excludedCount) : null,
          ].filter(Boolean) as string[];
          return (
            <DataListRow
              key={batch.id}
              onClick={() => setSelected(batch)}
              leading={
                <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                  <PackageOpen className="size-4" aria-hidden />
                </span>
              }
              title={`Lote ${formatDate(batch.createdAt)}`}
              facts={facts}
              trailing={
                <StatusBadge
                  tone={TONE[batch.status] ?? 'muted'}
                  label={copy.status[batch.status] ?? batch.status}
                />
              }
            />
          );
        })}
      </DataList>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? `Lote ${formatDate(selected.createdAt)}` : copy.drawer.title}
        closeLabel={copy.drawer.close}
        className="max-w-xl"
        footer={
          selected?.status === 'ready' || selected?.status === 'downloaded' ? (
            <button
              type="button"
              onClick={() => selected && download(selected)}
              disabled={pending}
              className={primaryButtonClass}
            >
              <Download className="size-4" aria-hidden />
              {copy.list.download}
            </button>
          ) : null
        }
      >
        {selected && detail ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge
                tone={TONE[selected.status] ?? 'muted'}
                label={copy.status[selected.status] ?? selected.status}
              />
            </div>

            {selected.status === 'failed' && selected.error ? (
              <div>
                <p className="text-muted-foreground text-xs">{copy.drawer.error}</p>
                <p className="text-danger-text mt-0.5">{selected.error}</p>
              </div>
            ) : null}

            <div>
              <p className="text-muted-foreground text-xs">
                {copy.drawer.included} ({detail.count})
              </p>
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto">
                {detail.included.length === 0 ? (
                  <li className="text-muted-foreground">{copy.drawer.none}</li>
                ) : (
                  detail.included.map((e, i) => (
                    <li key={i} className="truncate font-mono text-xs">
                      {e.exportName ?? e.originalName ?? '—'}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {detail.excludedCount > 0 ? (
              <div>
                <p className="text-warning-text text-xs">
                  {copy.drawer.excluded} ({detail.excludedCount})
                </p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                  {detail.excluded.map((e, i) => (
                    <li key={i} className="text-muted-foreground truncate text-xs">
                      {e.fileName ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailDrawer>
    </section>
  );
}
