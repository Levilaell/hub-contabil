import { parseFirmConfig } from '@hub/config';
import { listCompanies, listExceptions, type ExceptionStatus } from '@hub/db';
import { EmptyState, PageHeader } from '@hub/ui';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

import { copy, inputClass, secondaryButtonClass } from './copy';
import { ExceptionsList } from './exceptions-list';

const SOURCES = [
  'triage',
  'export',
  'rules',
  'deadlines',
  'requests',
  'enrichment',
  'notifications',
];

function resolveStatus(raw: string | undefined): ExceptionStatus | 'all' {
  return raw === 'resolved' || raw === 'ignored' || raw === 'all' ? raw : 'open';
}

export default async function ExcecoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string }>;
}) {
  const sp = await searchParams;
  const status = resolveStatus(sp.status);
  const source = sp.source && SOURCES.includes(sp.source) ? sp.source : undefined;

  const supabase = await createClient();
  const [exceptions, companies, { data: firm }] = await Promise.all([
    listExceptions(supabase, { status, source }),
    listCompanies(supabase, { status: 'active' }),
    supabase.from('firms').select('config').limit(1).single(),
  ]);
  const config = parseFirmConfig(firm?.config);
  const filtered = status !== 'open' || Boolean(source);
  const triageOptions = {
    taxonomy: [...config.taxonomy],
    departments: config.departments.map((d) => ({ key: d.key, label: d.label })),
    companies: companies.map((c) => ({
      id: c.id,
      name: c.tradeName || c.legalName,
      cnpj: c.cnpj,
    })),
    routingMap: config.routingMap,
  };

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <details open={filtered} className="bg-card rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.filters}</summary>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs font-medium">
              {copy.statusLabel}
            </label>
            <select id="status" name="status" defaultValue={status} className={inputClass}>
              <option value="open">{copy.statusOpen}</option>
              <option value="resolved">{copy.statusResolved}</option>
              <option value="ignored">{copy.statusIgnored}</option>
              <option value="all">{copy.statusAll}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="source" className="text-xs font-medium">
              {copy.sourceLabel}
            </label>
            <select id="source" name="source" defaultValue={source ?? ''} className={inputClass}>
              <option value="">{copy.sourceAll}</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {copy.sources[s] ?? s}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={secondaryButtonClass}>
            {copy.apply}
          </button>
        </form>
      </details>

      {exceptions.length === 0 ? (
        <EmptyState
          icon={filtered ? AlertTriangle : CheckCircle2}
          title={filtered ? copy.empty.filteredTitle : copy.empty.title}
          description={filtered ? copy.empty.filteredDescription : copy.empty.description}
        />
      ) : (
        <ExceptionsList exceptions={exceptions} triageOptions={triageOptions} />
      )}
    </div>
  );
}
