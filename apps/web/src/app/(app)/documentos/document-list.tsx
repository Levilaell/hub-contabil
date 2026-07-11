'use client';

import {
  correctClassification,
  createDocumentSignedUrl,
  deleteDocument,
  type Classification,
  type DocumentItem,
} from '@hub/db';
import { docTypeLabel } from '@hub/config';
import { ConfirmDialog, DataList, DataListRow, DetailDrawer, toast } from '@hub/ui';
import { FileText, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';

import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

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
  classifications,
  docTypes,
  companyNames,
}: {
  documents: DocumentItem[];
  departmentLabels: Record<string, string>;
  classifications: Record<string, Classification>;
  docTypes: string[];
  /** When set (firm-wide search), each row also shows its company. */
  companyNames?: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [correctType, setCorrectType] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  async function open(doc: DocumentItem) {
    setSelected(doc);
    setCorrectType(doc.docType);
    setUrl(null);
    setLoadingUrl(true);
    setUrl(await createDocumentSignedUrl(supabase, doc.storagePath, 300));
    setLoadingUrl(false);
  }

  function remove(doc: DocumentItem) {
    startTransition(async () => {
      await deleteDocument(supabase, doc.id);
      setConfirmRemove(false);
      setSelected(null);
      toast.success(copy.list.removed);
      router.refresh();
    });
  }

  function saveCorrection(doc: DocumentItem) {
    startTransition(async () => {
      const res = await correctClassification(supabase, doc.id, correctType);
      if (res.ok) {
        setSelected(null);
        router.refresh();
      }
    });
  }

  const kind = selected ? fileKind(selected.fileName) : 'other';
  const selectedAi = selected ? classifications[selected.id]?.decidedBy === 'ai' : false;

  return (
    <>
      <DataList>
        {documents.map((doc) => {
          const place = [doc.period, departmentLabels[doc.department ?? ''] ?? doc.department]
            .filter(Boolean)
            .join(' · ');
          const companyName = companyNames?.[doc.companyId ?? ''];
          const isAi = classifications[doc.id]?.decidedBy === 'ai';
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
              facts={[companyName, docTypeLabel(doc.docType), place].filter(Boolean) as string[]}
              trailing={
                <span className="flex items-center gap-1.5">
                  {isAi ? (
                    <Sparkles className="text-primary size-3.5" aria-label={copy.list.aiBadge} />
                  ) : null}
                  <span className="text-muted-foreground text-xs">{humanSize(doc.sizeBytes)}</span>
                </span>
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
                onClick={() => setConfirmRemove(true)}
                disabled={pending}
                className={secondaryButtonClass}
              >
                {copy.list.remove}
              </button>
              <ConfirmDialog
                open={confirmRemove}
                onOpenChange={setConfirmRemove}
                title={copy.list.removeTitle}
                description={copy.list.removeConfirm}
                confirmLabel={copy.list.remove}
                cancelLabel={copy.dialogBack}
                tone="danger"
                pending={pending}
                onConfirm={() => remove(selected)}
              />
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            {/* Correct the AI's type and feed back a few-shot example (T21). */}
            <div className="bg-card space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-1.5">
                {selectedAi ? <Sparkles className="text-primary size-3.5" aria-hidden /> : null}
                <span className="text-xs font-medium">{copy.correct.title}</span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label htmlFor="correct-type" className="text-muted-foreground text-xs">
                    {copy.correct.label}
                  </label>
                  <select
                    id="correct-type"
                    value={correctType}
                    onChange={(e) => setCorrectType(e.target.value)}
                    className={inputClass}
                  >
                    {(docTypes.includes(selected.docType)
                      ? docTypes
                      : [selected.docType, ...docTypes]
                    ).map((t) => (
                      <option key={t} value={t}>
                        {docTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => saveCorrection(selected)}
                  disabled={pending || correctType === selected.docType}
                  className={secondaryButtonClass}
                >
                  {pending ? copy.correct.saving : copy.correct.save}
                </button>
              </div>
            </div>

            {loadingUrl ? (
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
            )}
          </div>
        ) : null}
      </DetailDrawer>
    </>
  );
}
