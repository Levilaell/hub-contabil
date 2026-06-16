'use client';

import { createDocumentSignedUrl, deleteDocument, type DocumentItem } from '@hub/db';
import { DataList, DataListRow, DetailDrawer } from '@hub/ui';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';

import { copy, primaryButtonClass, secondaryButtonClass } from './copy';

function fileKind(name: string): 'pdf' | 'image' | 'xml' | 'other' {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (ext === 'xml') return 'xml';
  return 'other';
}

function humanSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentList({
  documents,
  departmentLabels,
}: {
  documents: DocumentItem[];
  departmentLabels: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [pending, startTransition] = useTransition();

  async function open(doc: DocumentItem) {
    setSelected(doc);
    setUrl(null);
    setLoadingUrl(true);
    setUrl(await createDocumentSignedUrl(supabase, doc.storagePath, 300));
    setLoadingUrl(false);
  }

  function remove(doc: DocumentItem) {
    if (!window.confirm(copy.list.removeConfirm)) return;
    startTransition(async () => {
      await deleteDocument(supabase, doc.id);
      setSelected(null);
      router.refresh();
    });
  }

  const kind = selected ? fileKind(selected.fileName) : 'other';

  return (
    <>
      <DataList>
        {documents.map((doc) => {
          const place = [doc.period, departmentLabels[doc.department ?? ''] ?? doc.department]
            .filter(Boolean)
            .join(' · ');
          return (
            <DataListRow
              key={doc.id}
              onClick={() => void open(doc)}
              leading={
                <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                  <FileText className="size-4" aria-hidden />
                </span>
              }
              title={doc.fileName}
              facts={[doc.docType, place].filter(Boolean) as string[]}
              trailing={
                <span className="text-muted-foreground text-xs">{humanSize(doc.sizeBytes)}</span>
              }
            />
          );
        })}
      </DataList>

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.fileName ?? copy.preview.title}
        closeLabel={copy.preview.close}
        className="max-w-2xl"
        footer={
          selected ? (
            <div className="flex gap-2">
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className={primaryButtonClass}>
                  {copy.list.download}
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => remove(selected)}
                disabled={pending}
                className={secondaryButtonClass}
              >
                {copy.list.remove}
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          loadingUrl ? (
            <p className="text-muted-foreground text-sm">{copy.preview.loading}</p>
          ) : !url ? (
            <p className="text-muted-foreground text-sm">{copy.preview.unsupported}</p>
          ) : kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL preview
            <img
              src={url}
              alt={selected.fileName}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : kind === 'pdf' || kind === 'xml' ? (
            <iframe
              src={url}
              title={selected.fileName}
              className="h-[70vh] w-full rounded-lg border"
            />
          ) : (
            <p className="text-muted-foreground text-sm">{copy.preview.unsupported}</p>
          )
        ) : null}
      </DetailDrawer>
    </>
  );
}
