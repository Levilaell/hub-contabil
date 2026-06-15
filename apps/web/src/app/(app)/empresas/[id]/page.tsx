import { parseFirmConfig } from '@hub/config';
import { formatCnpj } from '@hub/core';
import { getCompany, listContacts } from '@hub/db';
import { PageHeader, StatusBadge } from '@hub/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { copy, primaryButtonClass } from '../copy';
import { ArchiveButton } from './archive-button';
import { ContactsSection } from './contacts-section';
import { EnrichButton } from './enrich-button';

const TABS = [
  { key: 'dados', label: copy.detail.tabs.dados, enabled: true },
  { key: 'contatos', label: copy.detail.tabs.contatos, enabled: true },
  { key: 'tarefas', label: copy.detail.tabs.tarefas, enabled: false },
  { key: 'documentos', label: copy.detail.tabs.documentos, enabled: false },
  { key: 'prazos', label: copy.detail.tabs.prazos, enabled: false },
  { key: 'solicitacoes', label: copy.detail.tabs.solicitacoes, enabled: false },
  { key: 'regras', label: copy.detail.tabs.regras, enabled: false },
] as const;

function resolveTab(raw: string | undefined): string {
  return TABS.some((tab) => tab.enabled && tab.key === raw) ? (raw as string) : 'dados';
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <dt className="text-muted-foreground w-40 shrink-0 text-sm">{label}</dt>
      <dd className="text-sm">{value || copy.detail.fields.unset}</dd>
    </div>
  );
}

export default async function EmpresaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = resolveTab(rawTab);

  const supabase = await createClient();
  const company = await getCompany(supabase, id);
  if (!company) notFound();

  const [contacts, { data: firm }] = await Promise.all([
    listContacts(supabase, id),
    supabase.from('firms').select('config').limit(1).single(),
  ]);

  const regimeLabel = company.taxRegime
    ? (parseFirmConfig(firm?.config).taxRegimes.find((r) => r.key === company.taxRegime)?.label ??
      company.taxRegime)
    : null;
  const location = [company.city, company.state].filter(Boolean).join(' / ') || null;
  const archived = company.status === 'archived';

  return (
    <div className="space-y-6">
      <Link
        href="/empresas"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {copy.detail.backToList}
      </Link>

      <PageHeader
        title={company.tradeName || company.legalName}
        action={
          <div className="flex gap-2">
            <Link href={`/empresas/${id}/editar`} className={primaryButtonClass}>
              {copy.detail.edit}
            </Link>
            <ArchiveButton companyId={id} archived={archived} />
          </div>
        }
      />
      <div className="-mt-3">
        <StatusBadge
          tone={archived ? 'muted' : 'success'}
          label={archived ? copy.detail.badgeArchived : copy.detail.badgeActive}
        />
      </div>

      {/* Tab skeleton — Dados/Contatos live; the rest arrive with their modules. */}
      <div className="border-border flex flex-wrap gap-1 border-b">
        {TABS.map((entry) =>
          entry.enabled ? (
            <Link
              key={entry.key}
              href={`/empresas/${id}?tab=${entry.key}`}
              aria-current={tab === entry.key ? 'page' : undefined}
              className={
                tab === entry.key
                  ? 'border-primary -mb-px border-b-2 px-3 py-2 text-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2 text-sm'
              }
            >
              {entry.label}
            </Link>
          ) : (
            <span
              key={entry.key}
              title={copy.detail.soon}
              className="text-muted-foreground/50 -mb-px cursor-not-allowed border-b-2 border-transparent px-3 py-2 text-sm"
            >
              {entry.label}
            </span>
          ),
        )}
      </div>

      {tab === 'dados' ? (
        <div className="space-y-4">
          <dl className="bg-card divide-border divide-y rounded-xl border px-5 py-2">
            <DataRow label={copy.detail.fields.cnpj} value={formatCnpj(company.cnpj)} />
            <DataRow label={copy.detail.fields.legalName} value={company.legalName} />
            <DataRow label={copy.detail.fields.tradeName} value={company.tradeName} />
            <DataRow label={copy.detail.fields.taxRegime} value={regimeLabel} />
            <DataRow label={copy.detail.fields.location} value={location} />
          </dl>

          <section className="bg-card space-y-3 rounded-xl border p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{copy.enrichment.title}</h2>
              <EnrichButton companyId={id} />
            </div>
            {!company.enrichment ? (
              <p className="text-muted-foreground text-sm">{copy.enrichment.none}</p>
            ) : company.enrichment.status === 'pending' ? (
              <p className="text-muted-foreground text-sm">{copy.enrichment.pending}</p>
            ) : (
              <dl className="divide-border divide-y">
                <DataRow label={copy.enrichment.legalName} value={company.enrichment.legalName} />
                <DataRow
                  label={copy.enrichment.cnae}
                  value={
                    [company.enrichment.cnaePrimaryCode, company.enrichment.cnaePrimaryDescription]
                      .filter(Boolean)
                      .join(' — ') || null
                  }
                />
                <DataRow
                  label={copy.enrichment.registration}
                  value={company.enrichment.registrationStatus}
                />
                <DataRow label={copy.enrichment.address} value={company.enrichment.addressLine} />
              </dl>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'contatos' ? <ContactsSection companyId={id} contacts={contacts} /> : null}
    </div>
  );
}
