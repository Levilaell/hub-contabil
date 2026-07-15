'use client';

import {
  correctClassification,
  createDocumentSignedUrl,
  deleteDocument,
  type Classification,
  type DocumentItem,
  type DocumentOrigin,
  type ExceptionItem,
} from '@hub/db';
import { docTypeLabel } from '@hub/config';
import { formatBrazilPhone } from '@hub/core';
import { ConfirmDialog, DataList, DataListRow, DetailDrawer, toast } from '@hub/ui';
import { FileText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';

import { applyTriageSuggestionAction } from '../excecoes/actions';
import { copy as exceptionsCopy } from '../excecoes/copy';
import type { TriageApplyOptions } from '../excecoes/exceptions-list';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

/** In-place resolution on the pending-filing list (T37): per document, the same
 * form that lives in /excecoes, backed by the same RPC — resolving in either
 * place closes the other. */
export interface InboxTriageProps {
  options: TriageApplyOptions;
  exceptionByDoc: Record<string, ExceptionItem>;
}

function ctxValue(ctx: Record<string, unknown>, key: string): string | null {
  const v = ctx[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

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

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

/** pt-BR channel label: inbound docs use the message's channel, others their source. */
function channelLabel(doc: DocumentItem, origin?: DocumentOrigin): string {
  if (doc.source === 'inbound') {
    return copy.origin.channels[origin?.channel ?? 'inbound'] ?? copy.origin.channels.inbound;
  }
  return copy.origin.channels[doc.source] ?? doc.source;
}

export function DocumentList({
  documents,
  departmentLabels,
  classifications,
  docTypes,
  companyNames,
  triage,
  origins,
}: {
  documents: DocumentItem[];
  departmentLabels: Record<string, string>;
  classifications: Record<string, Classification>;
  docTypes: string[];
  /** When set (firm-wide search), each row also shows its company. */
  companyNames?: Record<string, string>;
  /** When set (pending-filing list), the drawer offers in-place resolution (T37). */
  triage?: InboxTriageProps;
  /** Origin of inbound documents, keyed by inboundMessageId (T38). */
  origins?: Record<string, DocumentOrigin>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [correctType, setCorrectType] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  // Resolution form state (T37) — pre-filled from the AI suggestion on open.
  const [resolveEdit, setResolveEdit] = useState(false);
  const [resolveDocType, setResolveDocType] = useState('');
  const [resolveCompanyId, setResolveCompanyId] = useState('');
  const [resolveDepartment, setResolveDepartment] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function open(doc: DocumentItem) {
    setSelected(doc);
    setCorrectType(doc.docType);
    setResolveEdit(false);
    setResolveError(null);
    const exception = triage?.exceptionByDoc[doc.id];
    if (exception && triage) {
      const suggested = ctxValue(exception.suggestion, 'docType') ?? '';
      setResolveDocType(triage.options.taxonomy.includes(suggested) ? suggested : '');
      const cnpj = ctxValue(exception.context, 'cnpj');
      const match = cnpj ? triage.options.companies.find((c) => c.cnpj === cnpj) : undefined;
      setResolveCompanyId(match?.id ?? '');
      setResolveDepartment(''); // '' = automatic by type (routingMap)
    }
    setUrl(null);
    setLoadingUrl(true);
    setUrl(await createDocumentSignedUrl(supabase, doc.storagePath, 300));
    setLoadingUrl(false);
  }

  function submitResolve(exception: ExceptionItem) {
    if (!resolveDocType) {
      setResolveError(copy.resolve.needType);
      return;
    }
    // An inbox document has no company yet — filing REQUIRES picking one,
    // otherwise the RPC would close the exception and strand the document.
    if (!resolveCompanyId) {
      setResolveError(copy.resolve.needCompany);
      return;
    }
    setResolveError(null);
    const department =
      resolveDepartment || (triage ? triage.options.routingMap[resolveDocType] : null) || null;
    startTransition(async () => {
      const res = await applyTriageSuggestionAction(exception.id, {
        docType: resolveDocType,
        companyId: resolveCompanyId,
        department,
        note: '',
      });
      if (res && !res.ok) {
        setResolveError(res.message);
        return;
      }
      setSelected(null);
      toast.success(copy.resolve.archived);
      router.refresh();
    });
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
  const selectedClassification = selected ? classifications[selected.id] : undefined;
  const selectedOrigin =
    selected && selected.inboundMessageId ? origins?.[selected.inboundMessageId] : undefined;
  const selectedSender = selectedOrigin?.sender
    ? `${
        selectedOrigin.channel === 'whatsapp'
          ? formatBrazilPhone(selectedOrigin.sender)
          : selectedOrigin.sender
      }${selectedOrigin.contactName ? ` — ${selectedOrigin.contactName}` : ''}`
    : null;
  const selectedPlace = selected
    ? [selected.period, departmentLabels[selected.department ?? ''] ?? selected.department]
        .filter(Boolean)
        .join(' · ')
    : '';
  const selectedException = selected && triage ? triage.exceptionByDoc[selected.id] : undefined;
  const selectedReason = selectedException ? ctxValue(selectedException.context, 'reason') : null;
  const selectedSuggestionText = selectedException
    ? [
        ctxValue(selectedException.suggestion, 'docType')
          ? docTypeLabel(ctxValue(selectedException.suggestion, 'docType') as string)
          : null,
        ctxValue(selectedException.context, 'confidence') !== null
          ? exceptionsCopy.triage.confidence(
              Math.round(Number(ctxValue(selectedException.context, 'confidence')) * 100),
            )
          : null,
        ctxValue(selectedException.context, 'cnpj')
          ? `CNPJ ${ctxValue(selectedException.context, 'cnpj')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <>
      <DataList>
        {documents.map((doc) => {
          const companyName = companyNames?.[doc.companyId ?? ''];
          const isAi = classifications[doc.id]?.decidedBy === 'ai';
          const rowException = triage?.exceptionByDoc[doc.id];
          const rowReason = rowException ? ctxValue(rowException.context, 'reason') : null;
          const rowOrigin = doc.inboundMessageId ? origins?.[doc.inboundMessageId] : undefined;
          // T38: "há 2 dias · WhatsApp" instead of any technical detail.
          const arrival = `${timeAgo(doc.createdAt)} · ${channelLabel(doc, rowOrigin)}`;
          const rowFacts = triage
            ? ([
                rowReason
                  ? (exceptionsCopy.triage.reasons[rowReason] ?? rowReason)
                  : copy.resolve.waitingFact,
                arrival,
              ].filter(Boolean) as string[])
            : ([companyName, docTypeLabel(doc.docType), arrival].filter(Boolean) as string[]);
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
              facts={rowFacts}
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
            {/* T37: in-place resolution for a pending document — same form and RPC
                as /excecoes, so resolving here closes the exception (and vice versa). */}
            {triage && selectedException ? (
              <div className="bg-card space-y-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{copy.resolve.title}</p>
                  <p className="text-muted-foreground text-xs">{copy.resolve.subtitle}</p>
                </div>
                <dl className="space-y-1 text-sm">
                  {selectedReason ? (
                    <div>
                      <dt className="text-muted-foreground text-xs">{copy.resolve.reason}</dt>
                      <dd className="mt-0.5">
                        {exceptionsCopy.triage.reasons[selectedReason] ?? selectedReason}
                      </dd>
                    </div>
                  ) : null}
                  {selectedSuggestionText ? (
                    <div>
                      <dt className="text-muted-foreground text-xs">{copy.resolve.suggestion}</dt>
                      <dd className="mt-0.5">{selectedSuggestionText}</dd>
                    </div>
                  ) : null}
                </dl>

                {resolveEdit ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="resolve-doctype" className="text-xs font-medium">
                        {copy.resolve.docType}
                      </label>
                      <select
                        id="resolve-doctype"
                        value={resolveDocType}
                        onChange={(e) => setResolveDocType(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {triage.options.taxonomy.map((t) => (
                          <option key={t} value={t}>
                            {docTypeLabel(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="resolve-company" className="text-xs font-medium">
                        {copy.resolve.company}
                      </label>
                      <select
                        id="resolve-company"
                        value={resolveCompanyId}
                        onChange={(e) => setResolveCompanyId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{copy.resolve.companyPick}</option>
                        {triage.options.companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="resolve-department" className="text-xs font-medium">
                        {copy.resolve.department}
                      </label>
                      <select
                        id="resolve-department"
                        value={resolveDepartment}
                        onChange={(e) => setResolveDepartment(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">{copy.resolve.departmentAuto}</option>
                        {triage.options.departments.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {resolveError ? <p className="text-danger-text text-sm">{resolveError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {resolveEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => submitResolve(selectedException)}
                        disabled={pending}
                        className={primaryButtonClass}
                      >
                        {pending ? copy.resolve.archiving : copy.resolve.archive}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolveEdit(false);
                          setResolveError(null);
                        }}
                        className={secondaryButtonClass}
                      >
                        {copy.resolve.cancel}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => submitResolve(selectedException)}
                        disabled={pending}
                        className={primaryButtonClass}
                      >
                        {pending ? copy.resolve.archiving : copy.resolve.archiveAsIs}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolveEdit(true);
                          setResolveError(null);
                        }}
                        disabled={pending}
                        className={secondaryButtonClass}
                      >
                        {copy.resolve.correctAndArchive}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : triage ? (
              <p className="text-muted-foreground text-sm">{copy.resolve.waiting}</p>
            ) : null}

            {/* Correct the AI's type and feed back a few-shot example (T21).
                Hidden on the pending-filing list — the resolution form owns the type there. */}
            {triage ? null : (
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
            )}

            {/* T38: where the document came from and how it was classified. */}
            <div className="bg-card space-y-2 rounded-lg border p-3">
              <span className="text-xs font-medium">{copy.origin.title}</span>
              <dl className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <dt className="text-muted-foreground text-xs">{copy.origin.channel}</dt>
                    <dd className="mt-0.5">{channelLabel(selected, selectedOrigin)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">{copy.origin.received}</dt>
                    <dd
                      className="mt-0.5"
                      title={new Date(
                        selectedOrigin?.receivedAt ?? selected.createdAt,
                      ).toLocaleString('pt-BR')}
                    >
                      {timeAgo(selectedOrigin?.receivedAt ?? selected.createdAt)}
                    </dd>
                  </div>
                  {selectedPlace ? (
                    <div>
                      <dt className="text-muted-foreground text-xs">{copy.period}</dt>
                      <dd className="mt-0.5">{selectedPlace}</dd>
                    </div>
                  ) : null}
                </div>
                {selectedSender ? (
                  <div>
                    <dt className="text-muted-foreground text-xs">{copy.origin.sender}</dt>
                    <dd className="mt-0.5">
                      {selectedSender}
                      {selectedOrigin?.ticketId ? (
                        <Link
                          href={`/atendimento?ticket=${selectedOrigin.ticketId}`}
                          className="text-primary ml-2 text-xs underline-offset-2 hover:underline"
                        >
                          {copy.origin.openTicket}
                        </Link>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {selectedClassification ? (
                  <div>
                    <dt className="text-muted-foreground text-xs">{copy.origin.classification}</dt>
                    <dd className="mt-0.5">
                      {selectedClassification.decidedBy === 'human'
                        ? copy.origin.classifiedByHuman
                        : copy.origin.classifiedByAi(
                            Math.round(selectedClassification.confidence * 100),
                          )}
                      {selectedClassification.decidedBy === 'ai' && selectedClassification.model ? (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({selectedClassification.model})
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
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
