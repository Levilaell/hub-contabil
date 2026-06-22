'use client';

import { AlertTriangle, FileDown, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  buildExportAction,
  previewExportAction,
  type ExportPreview,
} from './actions';
import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

interface Company {
  id: string;
  name: string;
}

export function ExportBuilder({ companies, docTypes }: { companies: Company[]; docTypes: string[] }) {
  const router = useRouter();
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filters = useMemo(
    () => ({
      companyIds: [...selectedCompanies],
      period,
      docTypes: [...selectedTypes],
    }),
    [selectedCompanies, selectedTypes, period],
  );

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies;
  }, [companies, search]);

  function toggle(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
    setPreview(null); // filters changed → previous preview is stale
  }

  function runPreview() {
    setError(null);
    startTransition(async () => {
      setPreview(await previewExportAction(filters));
    });
  }

  function runBuild() {
    setError(null);
    startTransition(async () => {
      const res = await buildExportAction(filters);
      if (res && !res.ok) {
        setError(res.message);
        return;
      }
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <section className="bg-card space-y-4 rounded-xl border p-5">
      <h2 className="text-sm font-semibold">{copy.builder.title}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-xs font-medium">{copy.builder.companies}</span>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4"
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={copy.builder.companiesSearch}
              className={`${inputClass} pl-8`}
            />
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
            {filteredCompanies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selectedCompanies.has(c.id)}
                  onChange={() => toggle(selectedCompanies, c.id, setSelectedCompanies)}
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {copy.builder.selected(selectedCompanies.size)}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="exp-period" className="text-xs font-medium">
              {copy.builder.period}
            </label>
            <input
              id="exp-period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPreview(null);
              }}
              placeholder="2026-06"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium">{copy.builder.docTypes}</span>
            <div className="flex flex-wrap gap-1.5">
              {docTypes.map((t) => {
                const on = selectedTypes.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggle(selectedTypes, t, setSelectedTypes)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      on ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              {selectedTypes.size === 0 ? copy.builder.docTypesAll : null}
            </p>
          </div>
        </div>
      </div>

      {preview ? (
        <div className="bg-background space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">{copy.preview.title}</p>
          {preview.count === 0 && preview.excludedCount === 0 ? (
            <p className="text-muted-foreground text-sm">{copy.preview.none}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <strong>{preview.count}</strong> {copy.preview.included}
                </span>
                {preview.excludedCount > 0 ? (
                  <span className="text-warning-text">
                    <strong>{preview.excludedCount}</strong> {copy.preview.excluded}
                  </span>
                ) : null}
                {preview.alreadyExportedCount > 0 ? (
                  <span className="text-muted-foreground">
                    <strong>{preview.alreadyExportedCount}</strong> {copy.preview.already}
                  </span>
                ) : null}
              </div>
              {preview.excludedCount > 0 ? (
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                  <AlertTriangle className="text-warning-text mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {copy.preview.excludedHint}
                </p>
              ) : null}
              {preview.alreadyExportedCount > 0 ? (
                <p className="text-muted-foreground text-xs">{copy.preview.reExportWarning}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="text-danger-text text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={runBuild}
          disabled={pending}
          className={primaryButtonClass}
        >
          <FileDown className="size-4" aria-hidden />
          {pending ? copy.builder.building : copy.builder.build}
        </button>
        <button
          type="button"
          onClick={runPreview}
          disabled={pending}
          className={secondaryButtonClass}
        >
          {pending ? copy.builder.previewing : copy.builder.preview}
        </button>
      </div>
    </section>
  );
}
