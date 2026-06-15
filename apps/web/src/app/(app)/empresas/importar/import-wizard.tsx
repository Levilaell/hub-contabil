'use client';

import { formatCnpj } from '@hub/core';
import { StatusBadge, type StatusTone } from '@hub/ui';
import { CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import { copy, primaryButtonClass, secondaryButtonClass } from '../copy';
import { confirmImport, previewImport, type ConfirmResult, type PreviewResult } from './actions';

type Preview = Extract<PreviewResult, { ok: true }>;
type Done = Extract<ConfirmResult, { ok: true }>;

const STATUS_TONE: Record<string, StatusTone> = {
  valid: 'success',
  invalid: 'danger',
  duplicate: 'warning',
};
const STATUS_LABEL: Record<string, string> = {
  valid: copy.import.statusValid,
  invalid: copy.import.statusInvalid,
  duplicate: copy.import.statusDuplicate,
};

function Count({ value, label, tone }: { value: number; label: string; tone: string }) {
  const color =
    tone === 'valid'
      ? 'text-success-text'
      : tone === 'invalid'
        ? 'text-danger-text'
        : 'text-warning-text';
  return (
    <div className="bg-card flex-1 rounded-xl border p-4 text-center">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-muted-foreground mt-1 text-xs">{label}</p>
    </div>
  );
}

export function ImportWizard() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function analyze() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(copy.import.noFile);
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    startTransition(async () => {
      const res = await previewImport(formData);
      if (!res.ok) setError(res.message);
      else setPreview(res);
    });
  }

  function confirm() {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => r.status === 'valid')
      .map((r) => ({
        cnpj: r.cnpj,
        legalName: r.legalName,
        tradeName: r.tradeName,
        taxRegime: r.taxRegime,
        city: r.city,
        state: r.state,
      }));
    setError(null);
    startTransition(async () => {
      const res = await confirmImport(rows);
      if (!res.ok) setError(res.message);
      else setDone(res);
    });
  }

  function reset() {
    setPreview(null);
    setDone(null);
    setError(null);
  }

  // Step 3 — result.
  if (done) {
    return (
      <div className="bg-card space-y-4 rounded-xl border p-6 text-center">
        <span className="bg-success/12 text-success-text mx-auto grid size-12 place-items-center rounded-full">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-semibold">{done.created}</p>
          <p className="text-muted-foreground text-sm">{copy.import.created}</p>
        </div>
        {done.skipped > 0 ? (
          <p className="text-muted-foreground text-sm">
            {done.skipped} {copy.import.skipped}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">{copy.import.enrichNote}</p>
        <div className="flex justify-center gap-2 pt-2">
          <Link href="/empresas" className={primaryButtonClass}>
            {copy.import.goToList}
          </Link>
          <button type="button" onClick={reset} className={secondaryButtonClass}>
            {copy.import.importMore}
          </button>
        </div>
      </div>
    );
  }

  // Step 2 — preview.
  if (preview) {
    const validCount = preview.counts.valid;
    return (
      <div className="space-y-5">
        <div className="flex gap-3">
          <Count value={validCount} label={copy.import.countValid} tone="valid" />
          <Count
            value={preview.counts.duplicate}
            label={copy.import.countDuplicate}
            tone="duplicate"
          />
          <Count value={preview.counts.invalid} label={copy.import.countInvalid} tone="invalid" />
        </div>

        <ul className="divide-border bg-card max-h-[28rem] divide-y overflow-y-auto rounded-xl border">
          {preview.rows.map((r) => (
            <li key={r.line} className="flex items-center gap-3 p-3">
              <span className="text-muted-foreground w-14 shrink-0 text-xs">
                {copy.import.line} {r.line}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {r.legalName || formatCnpj(r.cnpj) || '—'}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {r.reason ?? formatCnpj(r.cnpj)}
                </span>
              </span>
              <StatusBadge tone={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} />
            </li>
          ))}
        </ul>

        {error ? <p className="text-danger-text text-sm">{error}</p> : null}
        {validCount === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.import.nothingValid}</p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending || validCount === 0}
            className={primaryButtonClass}
          >
            {pending ? copy.import.confirming : `${copy.import.confirm} ${validCount}`}
          </button>
          <button type="button" onClick={reset} disabled={pending} className={secondaryButtonClass}>
            {copy.import.back}
          </button>
        </div>
      </div>
    );
  }

  // Step 1 — upload.
  return (
    <div className="bg-card space-y-5 rounded-xl border p-6">
      <div className="space-y-1.5">
        <label htmlFor="file" className="text-sm font-medium">
          {copy.import.fileLabel}
        </label>
        <input
          ref={fileRef}
          id="file"
          type="file"
          accept=".csv,.xlsx"
          className="file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm"
        />
      </div>

      <Link
        href="/empresas/importar/modelo"
        prefetch={false}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <Download className="size-4" aria-hidden />
        {copy.import.template}
      </Link>
      <p className="text-muted-foreground text-xs">{copy.import.templateHint}</p>

      {error ? <p className="text-danger-text text-sm">{error}</p> : null}

      <button type="button" onClick={analyze} disabled={pending} className={primaryButtonClass}>
        <FileSpreadsheet className="size-4" aria-hidden />
        {pending ? copy.import.analyzing : copy.import.analyze}
      </button>
    </div>
  );
}
