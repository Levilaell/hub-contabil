'use client';

import { docTypeLabel } from '@hub/config';
import type { RequestKind } from '@hub/core';
import type { DocumentRequest } from '@hub/db';
import { StatusBadge, type StatusTone } from '@hub/ui';
import { Check, Copy, Plus } from 'lucide-react';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

import { RequestDrawer } from '../../solicitacoes/request-drawer';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from '../copy';
import { createRequestAction } from './solicitacoes-actions';

// Company-page requests, split by kind into two tabs (T31, decision #4):
// 'upload_request' lives in "Solicitações", 'document_offer' in "Envios" —
// separate flows, separate lists, full control of each. Rows open the same
// detail drawer as the global /solicitacoes screen (send/copy/cancel).

interface DocOption {
  id: string;
  fileName: string;
}

const TONE: Record<string, StatusTone> = {
  requested: 'neutral',
  sent: 'neutral',
  viewed: 'warning',
  received: 'success',
  downloaded: 'success',
  expired: 'muted',
  cancelled: 'muted',
};
const OPEN_STATUSES = ['requested', 'sent', 'viewed'];

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function CreatedLink({ token, onReset }: { token: string; onReset: () => void }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== 'undefined' ? `${window.location.origin}/s/${token}` : `/s/${token}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="bg-success/8 border-success/30 space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">{copy.solicitacoes.linkTitle}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{copy.solicitacoes.linkHint}</p>
      </div>
      <div className="flex gap-2">
        <input readOnly value={url} className={`${inputClass} font-mono text-xs`} />
        <button type="button" onClick={() => void handleCopy()} className={secondaryButtonClass}>
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? copy.solicitacoes.copied : copy.solicitacoes.copy}
        </button>
      </div>
      <button type="button" onClick={onReset} className={primaryButtonClass}>
        <Plus className="size-4" aria-hidden />
        {copy.solicitacoes.newAnother}
      </button>
    </div>
  );
}

function RequestForm({
  companyId,
  kind,
  companyDocs,
  docTypes,
  defaultExpiryDays,
  onCreated,
  onCancel,
}: {
  companyId: string;
  kind: RequestKind;
  companyDocs: DocOption[];
  docTypes: string[];
  defaultExpiryDays: number;
  onCreated: (token: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createRequestAction(companyId, null, formData);
      if (!result) return;
      if (result.ok) onCreated(result.token);
      else setError(result.message);
    });
  }

  const canOffer = companyDocs.length > 0;

  return (
    <form onSubmit={handleSubmit} className="bg-background space-y-3 rounded-lg border p-4">
      {/* The tab decides the kind (T31) — no kind select inside the form. */}
      <input type="hidden" name="kind" value={kind} />

      <Field label={copy.solicitacoes.title} htmlFor="title">
        <input
          id="title"
          name="title"
          required
          placeholder={
            kind === 'upload_request'
              ? copy.solicitacoes.titlePlaceholder
              : copy.solicitacoes.titlePlaceholderOffer
          }
          className={inputClass}
        />
      </Field>

      <Field label={copy.solicitacoes.description} htmlFor="description">
        <textarea id="description" name="description" rows={2} className={inputClass} />
      </Field>

      {kind === 'upload_request' ? (
        <Field label={copy.solicitacoes.docType} htmlFor="requestedDocType">
          <select
            id="requestedDocType"
            name="requestedDocType"
            defaultValue=""
            className={inputClass}
          >
            <option value="">{copy.solicitacoes.docTypeAny}</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>
                {docTypeLabel(t)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label={copy.solicitacoes.document} htmlFor="documentId">
          {canOffer ? (
            <select
              id="documentId"
              name="documentId"
              defaultValue=""
              required
              className={inputClass}
            >
              <option value="" disabled>
                {copy.solicitacoes.documentPick}
              </option>
              {companyDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fileName}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-muted-foreground text-sm">{copy.solicitacoes.noDocs}</p>
          )}
        </Field>
      )}

      <Field label={copy.solicitacoes.expiryDays} htmlFor="expiryDays">
        <input
          id="expiryDays"
          name="expiryDays"
          type="number"
          min={1}
          max={90}
          defaultValue={defaultExpiryDays}
          className={inputClass}
        />
      </Field>

      {error ? <p className="text-danger-text text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || (kind === 'document_offer' && !canOffer)}
          className={primaryButtonClass}
        >
          {pending ? copy.solicitacoes.creating : copy.solicitacoes.create}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          {copy.solicitacoes.cancel}
        </button>
      </div>
    </form>
  );
}

function RequestRow({ request, onOpen }: { request: DocumentRequest; onOpen: () => void }) {
  const isOpen = OPEN_STATUSES.includes(request.status);
  const fact =
    request.kind === 'upload_request'
      ? request.requestedDocType
        ? docTypeLabel(request.requestedDocType)
        : copy.solicitacoes.docTypeAny
      : null;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="hover:bg-accent flex w-full items-center gap-3 p-4 text-left transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{request.title}</span>
          <span className="text-muted-foreground mt-0.5 block truncate text-xs">
            {[fact, isOpen ? copy.solicitacoes.expiresIn(daysUntil(request.expiresAt)) : null]
              .filter(Boolean)
              .join(' · ') || copy.solicitacoes.openDetail}
          </span>
        </span>
        <StatusBadge
          tone={TONE[request.status] ?? 'muted'}
          label={copy.solicitacoes.status[request.status] ?? request.status}
        />
      </button>
    </li>
  );
}

export function SolicitacoesSection({
  companyId,
  kind,
  requests,
  companyDocs,
  docTypes,
  defaultExpiryDays,
}: {
  companyId: string;
  kind: RequestKind;
  requests: DocumentRequest[];
  companyDocs: DocOption[];
  docTypes: string[];
  defaultExpiryDays: number;
}) {
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [selected, setSelected] = useState<DocumentRequest | null>(null);

  const isUpload = kind === 'upload_request';
  const items = requests.filter((r) => r.kind === kind);

  return (
    <div className="space-y-4">
      {!createdToken ? (
        <div className="flex justify-end">
          {mode !== 'new' ? (
            <button type="button" onClick={() => setMode('new')} className={secondaryButtonClass}>
              <Plus className="size-4" aria-hidden />
              {isUpload ? copy.solicitacoes.add : copy.solicitacoes.addOffer}
            </button>
          ) : null}
        </div>
      ) : null}

      {createdToken ? (
        <CreatedLink
          token={createdToken}
          onReset={() => {
            setCreatedToken(null);
            setMode('new');
          }}
        />
      ) : mode === 'new' ? (
        <RequestForm
          companyId={companyId}
          kind={kind}
          companyDocs={companyDocs}
          docTypes={docTypes}
          defaultExpiryDays={defaultExpiryDays}
          onCreated={(token) => {
            setCreatedToken(token);
            setMode('list');
          }}
          onCancel={() => setMode('list')}
        />
      ) : null}

      {items.length === 0 && mode !== 'new' && !createdToken ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm font-medium">
            {isUpload ? copy.solicitacoes.empty : copy.solicitacoes.emptyOffer}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {isUpload ? copy.solicitacoes.emptyHint : copy.solicitacoes.emptyOfferHint}
          </p>
        </div>
      ) : items.length > 0 ? (
        <ul className="divide-border bg-card divide-y overflow-hidden rounded-xl border">
          {items.map((request) => (
            <RequestRow key={request.id} request={request} onOpen={() => setSelected(request)} />
          ))}
        </ul>
      ) : null}

      {selected ? <RequestDrawer request={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
