import { docTypeLabel, parseFirmConfig } from '@hub/config';
import { formatCnpj } from '@hub/core';
import {
  listClassificationsByDocuments,
  listCompanies,
  listDocumentOrigins,
  listDocuments,
  listOpenTriageExceptionsByDocument,
} from '@hub/db';
import { DataList, DataListRow, EmptyState, PageHeader } from '@hub/ui';
import { Building2, ChevronLeft, Inbox, Search } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy, inputClass, secondaryButtonClass } from './copy';
import { DocumentList } from './document-list';
import { InboxButton } from './inbox-button';
import { UploadButton } from './upload-button';

// Fase 1.1 §3 — the search box is ALWAYS visible (it used to hide inside the
// collapsed filter panel and read as missing): firm-wide at level 0, per-company
// at level 1. Documents the triage couldn't file (company_id null) surface in a
// "Pendentes de arquivamento" section instead of being invisible (renamed in T37).

function SearchForm({
  placeholder,
  defaultValue,
  hidden,
}: {
  placeholder: string;
  defaultValue: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form method="get" className="flex gap-2">
      {Object.entries(hidden ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`${inputClass} pl-9`}
        />
      </div>
      <button type="submit" className={secondaryButtonClass}>
        {copy.apply}
      </button>
    </form>
  );
}

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
  const companyNames = Object.fromEntries(companies.map((c) => [c.id, c.tradeName || c.legalName]));
  const q = (sp.q ?? '').trim();

  // Level 0.5 — pending filing: documents not yet filed under a company, each
  // resolvable IN PLACE via its open triage exception (T37).
  if (sp.company === 'inbox') {
    const docs = await listDocuments(supabase, { unassigned: true, search: q || undefined });
    const [classificationEntries, exceptionByDoc, origins] = await Promise.all([
      listClassificationsByDocuments(
        supabase,
        docs.map((d) => d.id),
      ),
      listOpenTriageExceptionsByDocument(
        supabase,
        docs.map((d) => d.id),
      ),
      listDocumentOrigins(
        supabase,
        docs.map((d) => d.inboundMessageId),
      ),
    ]);
    const classifications = Object.fromEntries(classificationEntries);
    const triageOptions = {
      taxonomy: [...config.taxonomy],
      departments: config.departments.map((d) => ({ key: d.key, label: d.label })),
      companies: companies
        .filter((c) => c.status === 'active')
        .map((c) => ({ id: c.id, name: c.tradeName || c.legalName, cnpj: c.cnpj })),
      routingMap: config.routingMap,
    };
    return (
      <div className="space-y-6">
        <Link
          href="/documentos"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {copy.unassigned.back}
        </Link>
        <PageHeader
          title={copy.unassigned.title}
          description={copy.unassigned.hint}
          action={
            <Link href="/excecoes" className={secondaryButtonClass}>
              {copy.unassigned.resolve}
            </Link>
          }
        />
        {docs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={copy.unassigned.emptyTitle}
            description={copy.unassigned.emptyDescription}
          />
        ) : (
          <DocumentList
            documents={docs}
            departmentLabels={departmentLabels}
            classifications={classifications}
            docTypes={[...config.taxonomy]}
            triage={{ options: triageOptions, exceptionByDoc }}
            origins={origins}
          />
        )}
      </div>
    );
  }

  // Level 0 — pick a company (or search across the whole firm).
  const company = sp.company ? companies.find((c) => c.id === sp.company) : undefined;
  if (!company) {
    const searchDocs = q ? await listDocuments(supabase, { search: q }) : [];
    const searchClassifications = q
      ? Object.fromEntries(
          await listClassificationsByDocuments(
            supabase,
            searchDocs.map((d) => d.id),
          ),
        )
      : {};
    const searchOrigins = q
      ? await listDocumentOrigins(
          supabase,
          searchDocs.map((d) => d.inboundMessageId),
        )
      : {};
    const unassignedCount = (await listDocuments(supabase, { unassigned: true })).length;

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

        <SearchForm placeholder={copy.searchAllPlaceholder} defaultValue={q} />

        {q ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                {copy.searchResults(searchDocs.length)}
              </p>
              <Link href="/documentos" className={secondaryButtonClass}>
                {copy.clearSearch}
              </Link>
            </div>
            {searchDocs.length === 0 ? (
              <EmptyState title={copy.empty.search} />
            ) : (
              <DocumentList
                documents={searchDocs}
                departmentLabels={departmentLabels}
                classifications={searchClassifications}
                docTypes={[...config.taxonomy]}
                companyNames={companyNames}
                origins={searchOrigins}
              />
            )}
          </div>
        ) : (
          <>
            {/* T37: ALWAYS visible, even at zero — hiding it hid the concept. */}
            <DataList>
              <DataListRow
                href="/documentos?company=inbox"
                linkComponent={Link}
                leading={
                  <span
                    className={
                      unassignedCount > 0
                        ? 'bg-warning/15 text-warning-text grid size-9 place-items-center rounded-full'
                        : 'bg-muted text-muted-foreground grid size-9 place-items-center rounded-full'
                    }
                  >
                    <Inbox className="size-4" aria-hidden />
                  </span>
                }
                title={copy.unassigned.title}
                facts={[unassignedCount > 0 ? copy.unassigned.hint : copy.unassigned.hintEmpty]}
                trailing={
                  <span
                    className={
                      unassignedCount > 0
                        ? 'bg-warning/15 text-warning-text rounded-full px-2 py-0.5 text-xs font-medium'
                        : 'bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium'
                    }
                  >
                    {unassignedCount}
                  </span>
                }
              />
            </DataList>

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
          </>
        )}
      </div>
    );
  }

  // Level 1 — a company's documents. One fetch; facets + filtering in-memory.
  const allDocs = await listDocuments(supabase, { companyId: company.id });
  const periods = [...new Set(allDocs.map((d) => d.period).filter(Boolean))].sort().reverse();
  const departments = [...new Set(allDocs.map((d) => d.department).filter(Boolean))];
  const qLower = q.toLowerCase();
  const docs = allDocs.filter(
    (d) =>
      (!sp.period || d.period === sp.period) &&
      (!sp.department || d.department === sp.department) &&
      (!sp.docType || d.docType === sp.docType) &&
      (!qLower || d.fileName.toLowerCase().includes(qLower)),
  );
  const filtered = Boolean(sp.period || sp.department || sp.docType || qLower);
  const base = `/documentos?company=${company.id}`;
  const advancedOpen = Boolean(sp.period || sp.docType);
  const [classificationEntries, origins] = await Promise.all([
    listClassificationsByDocuments(
      supabase,
      docs.map((d) => d.id),
    ),
    listDocumentOrigins(
      supabase,
      docs.map((d) => d.inboundMessageId),
    ),
  ]);
  const classifications = Object.fromEntries(classificationEntries);

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

      {/* Search + department always visible; competência/tipo behind "Mais filtros". */}
      <form method="get" className="space-y-3">
        <input type="hidden" name="company" value={company.id} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1 space-y-1.5">
            <label htmlFor="q" className="text-xs font-medium">
              {copy.search}
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                id="q"
                type="search"
                name="q"
                defaultValue={q}
                className={`${inputClass} pl-9`}
              />
            </div>
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
          <button type="submit" className={secondaryButtonClass}>
            {copy.apply}
          </button>
        </div>

        <details open={advancedOpen} className="bg-card rounded-xl border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">{copy.filters}</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="period" className="text-xs font-medium">
                {copy.period}
              </label>
              <select
                id="period"
                name="period"
                defaultValue={sp.period ?? ''}
                className={inputClass}
              >
                <option value="">{copy.all}</option>
                {periods.map((p) => (
                  <option key={p} value={p ?? ''}>
                    {p}
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
                    {docTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={secondaryButtonClass}>
              {copy.apply}
            </button>
          </div>
        </details>
      </form>

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
          origins={origins}
          docTypes={[...config.taxonomy]}
        />
      )}
    </div>
  );
}
