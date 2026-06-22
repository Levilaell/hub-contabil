import { parseFirmConfig } from '@hub/config';
import { formatCnpj } from '@hub/core';
import { listClassificationsByDocuments, listCompanies, listDocuments } from '@hub/db';
import { DataList, DataListRow, EmptyState, PageHeader } from '@hub/ui';
import { Building2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy, inputClass, secondaryButtonClass } from './copy';
import { DocumentList } from './document-list';
import { InboxButton } from './inbox-button';
import { UploadButton } from './upload-button';

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    period?: string;
    department?: string;
    docType?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: firm }, companies] = await Promise.all([
    supabase.from('firms').select('id, config').limit(1).single(),
    listCompanies(supabase, { status: 'all' }),
  ]);
  const config = parseFirmConfig(firm?.config);
  const firmId = (firm?.id as string) ?? '';
  const departmentLabels = Object.fromEntries(config.departments.map((d) => [d.key, d.label]));

  // Level 0 — pick a company.
  const company = sp.company ? companies.find((c) => c.id === sp.company) : undefined;
  if (!company) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={copy.title}
          description={copy.pickCompany}
          action={
            <div className="flex gap-2">
              <InboxButton firmId={firmId} />
              <Link href="/exportacao" className={secondaryButtonClass}>
                {copy.exportLink}
              </Link>
            </div>
          }
        />
        {companies.length === 0 ? (
          <EmptyState icon={Building2} title={copy.empty.companies} />
        ) : (
          <DataList>
            {companies.map((c) => (
              <DataListRow
                key={c.id}
                href={`/documentos?company=${c.id}`}
                linkComponent={Link}
                leading={
                  <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                    <Building2 className="size-4" aria-hidden />
                  </span>
                }
                title={c.tradeName || c.legalName}
                facts={[formatCnpj(c.cnpj)]}
              />
            ))}
          </DataList>
        )}
      </div>
    );
  }

  // Level 1 — a company's documents. One fetch; facets + filtering in-memory.
  const allDocs = await listDocuments(supabase, { companyId: company.id });
  const periods = [...new Set(allDocs.map((d) => d.period).filter(Boolean))].sort().reverse();
  const departments = [...new Set(allDocs.map((d) => d.department).filter(Boolean))];
  const q = (sp.q ?? '').trim().toLowerCase();
  const docs = allDocs.filter(
    (d) =>
      (!sp.period || d.period === sp.period) &&
      (!sp.department || d.department === sp.department) &&
      (!sp.docType || d.docType === sp.docType) &&
      (!q || d.fileName.toLowerCase().includes(q)),
  );
  const filtered = Boolean(sp.period || sp.department || sp.docType || q);
  const base = `/documentos?company=${company.id}`;
  const classifications = Object.fromEntries(
    await listClassificationsByDocuments(
      supabase,
      docs.map((d) => d.id),
    ),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/documentos"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {copy.back}
      </Link>
      <PageHeader
        title={company.tradeName || company.legalName}
        description={copy.subtitle}
        action={
          <UploadButton
            companyId={company.id}
            firmId={firmId}
            departments={config.departments.map((d) => ({ key: d.key, label: d.label }))}
            docTypes={[...config.taxonomy]}
          />
        }
      />

      <details open={filtered} className="bg-card rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.filters}</summary>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="company" value={company.id} />
          <div className="min-w-44 flex-1 space-y-1.5">
            <label htmlFor="q" className="text-xs font-medium">
              {copy.search}
            </label>
            <input id="q" name="q" defaultValue={sp.q ?? ''} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="period" className="text-xs font-medium">
              {copy.period}
            </label>
            <select id="period" name="period" defaultValue={sp.period ?? ''} className={inputClass}>
              <option value="">{copy.all}</option>
              {periods.map((p) => (
                <option key={p} value={p ?? ''}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="department" className="text-xs font-medium">
              {copy.department}
            </label>
            <select
              id="department"
              name="department"
              defaultValue={sp.department ?? ''}
              className={inputClass}
            >
              <option value="">{copy.all}</option>
              {departments.map((d) => (
                <option key={d} value={d ?? ''}>
                  {departmentLabels[d ?? ''] ?? d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="docType" className="text-xs font-medium">
              {copy.docType}
            </label>
            <select
              id="docType"
              name="docType"
              defaultValue={sp.docType ?? ''}
              className={inputClass}
            >
              <option value="">{copy.all}</option>
              {config.taxonomy.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={secondaryButtonClass}>
            {copy.apply}
          </button>
        </form>
      </details>

      {docs.length === 0 ? (
        <EmptyState
          title={filtered ? copy.empty.filtered : copy.empty.docs}
          action={
            !filtered ? null : (
              <Link href={base} className={secondaryButtonClass}>
                {copy.all}
              </Link>
            )
          }
        />
      ) : (
        <DocumentList
          documents={docs}
          departmentLabels={departmentLabels}
          classifications={classifications}
          docTypes={[...config.taxonomy]}
        />
      )}
    </div>
  );
}
