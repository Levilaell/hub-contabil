import { parseFirmConfig } from '@hub/config';
import { formatCnpj } from '@hub/core';
import { listCompanies } from '@hub/db';
import { DataList, DataListRow, EmptyState, PageHeader, StatusBadge } from '@hub/ui';
import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy, inputClass, primaryButtonClass, secondaryButtonClass } from './copy';

type StatusFilter = 'active' | 'archived' | 'all';

function resolveStatus(raw: string | undefined): StatusFilter {
  return raw === 'archived' || raw === 'all' ? raw : 'active';
}

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = resolveStatus(sp.status);
  const search = (sp.q ?? '').trim();

  const supabase = await createClient();
  const [{ data: firm }, companies] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    listCompanies(supabase, { status, search }),
  ]);

  const regimeLabels = new Map(
    parseFirmConfig(firm?.config).taxRegimes.map((regime) => [regime.key, regime.label]),
  );
  const filtered = status !== 'active' || search.length > 0;

  const newButton = (
    <Link href="/empresas/nova" className={primaryButtonClass}>
      <Plus className="size-4" aria-hidden />
      {copy.list.newCompany}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={copy.list.title} description={copy.list.subtitle} action={newButton} />

      {/* Filters collapsed by default (UX rule #8); opened when a filter is active. */}
      <details open={filtered} className="bg-card rounded-xl border px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{copy.list.filters}</summary>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <label htmlFor="q" className="text-xs font-medium">
              {copy.list.searchLabel}
            </label>
            <input
              id="q"
              name="q"
              defaultValue={search}
              placeholder={copy.list.searchPlaceholder}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="status" className="text-xs font-medium">
              {copy.list.statusLabel}
            </label>
            <select id="status" name="status" defaultValue={status} className={inputClass}>
              <option value="active">{copy.list.statusActive}</option>
              <option value="archived">{copy.list.statusArchived}</option>
              <option value="all">{copy.list.statusAll}</option>
            </select>
          </div>
          <button type="submit" className={secondaryButtonClass}>
            {copy.list.apply}
          </button>
        </form>
      </details>

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? copy.list.empty.filteredTitle : copy.list.empty.title}
          description={filtered ? copy.list.empty.filteredDescription : copy.list.empty.description}
          action={filtered ? undefined : newButton}
        />
      ) : (
        <DataList>
          {companies.map((company) => {
            const regime = company.taxRegime
              ? (regimeLabels.get(company.taxRegime) ?? company.taxRegime)
              : copy.list.regimeUnset;
            return (
              <DataListRow
                key={company.id}
                href={`/empresas/${company.id}`}
                linkComponent={Link}
                leading={
                  <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
                    <Building2 className="size-4" aria-hidden />
                  </span>
                }
                title={company.tradeName || company.legalName}
                facts={[regime, formatCnpj(company.cnpj)]}
                trailing={
                  company.status === 'archived' ? (
                    <StatusBadge tone="muted" label={copy.list.badgeArchived} />
                  ) : undefined
                }
              />
            );
          })}
        </DataList>
      )}
    </div>
  );
}
