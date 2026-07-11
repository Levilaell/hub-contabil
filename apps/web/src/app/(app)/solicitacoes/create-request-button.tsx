'use client';

import { docTypeLabel } from '@hub/config';
import { DetailDrawer } from '@hub/ui';
import { Check, Copy, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

import { createRequestGlobalAction, loadCompanyDocsAction } from './actions';
import { copy } from './copy';

// Create a request from the global page (T31) — company picked in the form.
// After creation the raw link shows ONCE (only its hash is stored), same rule
// as the company tab.

const inputClass =
  'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60';

interface Option {
  id: string;
  name: string;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function CreatedLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/s/${token}`;

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
        <p className="text-sm font-medium">{copy.create.linkTitle}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">{copy.create.linkHint}</p>
      </div>
      <div className="flex gap-2">
        <input readOnly value={url} className={`${inputClass} font-mono text-xs`} />
        <button type="button" onClick={() => void handleCopy()} className={secondaryBtn}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? copy.create.copied : copy.create.copy}
        </button>
      </div>
    </div>
  );
}

export function CreateRequestButton({
  companies,
  docTypes,
  defaultExpiryDays,
}: {
  companies: Option[];
  docTypes: string[];
  defaultExpiryDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'upload_request' | 'document_offer'>('upload_request');
  const [companyId, setCompanyId] = useState('');
  const [companyDocs, setCompanyDocs] = useState<{ id: string; fileName: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickCompany(id: string) {
    setCompanyId(id);
    setCompanyDocs(null);
    if (id) void loadCompanyDocsAction(id).then(setCompanyDocs);
  }

  function reset() {
    setKind('upload_request');
    setCompanyId('');
    setCompanyDocs(null);
    setError(null);
    setCreatedToken(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createRequestGlobalAction(null, formData);
      if (result.ok) {
        setCreatedToken(result.token);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  const docs = companyDocs ?? [];
  const canOffer = companyId !== '' && docs.length > 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
        <Plus className="size-4" aria-hidden />
        {copy.create.button}
      </button>
      <DetailDrawer
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            reset();
          }
        }}
        title={copy.create.title}
        description={copy.create.subtitle}
        closeLabel={copy.close}
      >
        {createdToken ? (
          <CreatedLink token={createdToken} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label={copy.create.company} htmlFor="new-companyId">
              <select
                id="new-companyId"
                name="companyId"
                required
                value={companyId}
                onChange={(e) => pickCompany(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  {copy.create.companyPick}
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={copy.create.kind} htmlFor="new-kind">
              <select
                id="new-kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className={inputClass}
              >
                <option value="upload_request">{copy.kindUpload}</option>
                <option value="document_offer" disabled={!canOffer}>
                  {copy.kindOffer}
                </option>
              </select>
              {companyId && companyDocs !== null && docs.length === 0 ? (
                <p className="text-muted-foreground text-xs">{copy.create.noDocs}</p>
              ) : null}
            </Field>

            <Field label={copy.create.requestTitle} htmlFor="new-title">
              <input
                id="new-title"
                name="title"
                required
                placeholder={copy.create.titlePlaceholder}
                className={inputClass}
              />
            </Field>

            <Field label={copy.create.description} htmlFor="new-description">
              <textarea id="new-description" name="description" rows={2} className={inputClass} />
            </Field>

            {kind === 'upload_request' ? (
              <Field label={copy.create.docType} htmlFor="new-requestedDocType">
                <select
                  id="new-requestedDocType"
                  name="requestedDocType"
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="">{copy.create.docTypeAny}</option>
                  {docTypes.map((t) => (
                    <option key={t} value={t}>
                      {docTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label={copy.create.document} htmlFor="new-documentId">
                <select id="new-documentId" name="documentId" defaultValue="" required className={inputClass}>
                  <option value="" disabled>
                    {copy.create.documentPick}
                  </option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fileName}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={copy.create.expiryDays} htmlFor="new-expiryDays">
              <input
                id="new-expiryDays"
                name="expiryDays"
                type="number"
                min={1}
                max={90}
                defaultValue={defaultExpiryDays}
                className={inputClass}
              />
            </Field>

            {error ? <p className="text-danger-text text-sm">{error}</p> : null}

            <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
              {pending ? copy.create.creating : copy.create.submit}
            </button>
          </form>
        )}
      </DetailDrawer>
    </>
  );
}
