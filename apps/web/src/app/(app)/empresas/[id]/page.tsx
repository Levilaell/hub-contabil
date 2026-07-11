import { parseFirmConfig } from '@hub/config';
import { formatCnpj, monitoredToDeadlineSignal } from '@hub/core';
import {
  getCompany,
  listClassificationsByDocuments,
  listContacts,
  listDocuments,
  listDocumentRequests,
  listMonitoredDocuments,
  listPartners,
  listTasks,
  type Classification,
  type Task,
} from '@hub/db';
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  TrafficLight,
  aggregateTrafficLight,
  type DeadlineState,
} from '@hub/ui';
import { ChevronLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { copy, primaryButtonClass, secondaryButtonClass } from '../copy';
import { ArchiveButton } from './archive-button';
import { ContactsSection } from './contacts-section';
import { EnrichButton } from './enrich-button';
import { PartnersSection } from './partners-section';
import { PrazosSection } from './prazos-section';
import { SolicitacoesSection } from './solicitacoes-section';
// The Tarefas and Documentos tabs consume the existing task (T10) and document
// repository (T12) modules, scoped to this company — no status visuals re-implemented.
import { DocumentList } from '../../documentos/document-list';
import { CreateTaskButton } from '../../tarefas/create-task-button';
import { TasksBoard } from '../../tarefas/tasks-board';

const TABS = [
  { key: 'dados', label: copy.detail.tabs.dados, enabled: true },
  { key: 'contatos', label: copy.detail.tabs.contatos, enabled: true },
  { key: 'tarefas', label: copy.detail.tabs.tarefas, enabled: true },
  { key: 'documentos', label: copy.detail.tabs.documentos, enabled: true },
  { key: 'prazos', label: copy.detail.tabs.prazos, enabled: true },
  { key: 'solicitacoes', label: copy.detail.tabs.solicitacoes, enabled: true },
  // Envios = document_offer requests (guias, CNDs…), split from solicitações
  // per decision #4 (T31) so each flow is tracked on its own.
  { key: 'envios', label: copy.detail.tabs.envios, enabled: true },
  // CFOP mapping rules are firm-wide (T19) → managed in /regras, not per company.
] as const;

function resolveTab(raw: string | undefined): string {
  return TABS.some((tab) => tab.enabled && tab.key === raw) ? (raw as string) : 'dados';
}

// YYYY-MM-DD → DD/MM/YYYY (calendar date; no timezone math on purpose).
function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
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

  const [contacts, partners, prazos, companyDocs, requests, { data: firm }] = await Promise.all([
    listContacts(supabase, id),
    listPartners(supabase, id),
    listMonitoredDocuments(supabase, { companyId: id }),
    listDocuments(supabase, { companyId: id }),
    listDocumentRequests(supabase, { companyId: id }),
    supabase.from('firms').select('config').limit(1).single(),
  ]);

  const config = parseFirmConfig(firm?.config);
  const regimeLabel = company.taxRegime
    ? (config.taxRegimes.find((r) => r.key === company.taxRegime)?.label ?? company.taxRegime)
    : null;
  const location = [company.city, company.state].filter(Boolean).join(' / ') || null;
  const addressLine =
    [
      [company.addressStreet, company.addressNumber].filter(Boolean).join(', '),
      company.addressComplement,
      company.addressDistrict,
      company.addressZip,
    ]
      .filter(Boolean)
      .join(' · ') || null;
  const archived = company.status === 'archived';
  const companyName = company.tradeName || company.legalName;
  const departmentLabels = Object.fromEntries(config.departments.map((d) => [d.key, d.label]));

  // Tasks tab consumes the task module (T10) scoped to this company. Fetched only
  // when the tab is active (the assignee list is the one extra query worth saving).
  let tasks: Task[] = [];
  let userOptions: { id: string; name: string }[] = [];
  let me = '';
  if (tab === 'tarefas') {
    const [{ data: userData }, companyTasks, { data: users }] = await Promise.all([
      supabase.auth.getUser(),
      listTasks(supabase, { companyId: id }),
      supabase.from('users').select('id, full_name, email'),
    ]);
    me = userData.user?.id ?? '';
    tasks = companyTasks;
    userOptions = (users ?? []).map((u) => ({ id: u.id, name: u.full_name || u.email }));
  }

  // Classifications for the documents tab ("classificado por IA" badge, T21).
  let documentClassifications: Record<string, Classification> = {};
  if (tab === 'documentos') {
    documentClassifications = Object.fromEntries(
      await listClassificationsByDocuments(
        supabase,
        companyDocs.map((d) => d.id),
      ),
    );
  }

  // Company farol (CLAUDE.md UX rule #4): aggregate this company's deadline signals.
  const deadlineSignals = prazos
    .map((p) => monitoredToDeadlineSignal(p.status))
    .filter((s): s is DeadlineState => s !== null);
  const companyLight = aggregateTrafficLight(deadlineSignals);
  const lightLabel: Record<string, string> = {
    red: 'Prazo vencido',
    yellow: 'Prazo a vencer',
    green: 'Prazos em dia',
    gray: 'Sem prazos',
  };

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
      <div className="-mt-3 flex items-center gap-3">
        <StatusBadge
          tone={archived ? 'muted' : 'success'}
          label={archived ? copy.detail.badgeArchived : copy.detail.badgeActive}
        />
        <span className="inline-flex items-center gap-1.5">
          <TrafficLight state={companyLight} label={lightLabel[companyLight]} />
          <span className="text-muted-foreground text-xs">{lightLabel[companyLight]}</span>
        </span>
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

          {/* Fase 1.1 §1.1 — optional cadastral detail, one click away (UX rule 2). */}
          <details className="bg-card rounded-xl border px-5 py-3">
            <summary className="cursor-pointer text-sm font-semibold">
              {copy.detail.moreData}
            </summary>
            <dl className="divide-border mt-1 divide-y">
              <DataRow label={copy.detail.fields.legalNature} value={company.legalNature} />
              <DataRow label={copy.detail.fields.companySize} value={company.companySize} />
              <DataRow
                label={copy.detail.fields.stateRegistration}
                value={company.stateRegistration}
              />
              <DataRow
                label={copy.detail.fields.municipalRegistration}
                value={company.municipalRegistration}
              />
              <DataRow
                label={copy.detail.fields.nire}
                value={
                  company.nire
                    ? [company.nire, company.nireIssuedOn ? formatDateBr(company.nireIssuedOn) : null]
                        .filter(Boolean)
                        .join(' — ')
                    : null
                }
              />
              <DataRow
                label={copy.detail.fields.activitiesStartedOn}
                value={company.activitiesStartedOn ? formatDateBr(company.activitiesStartedOn) : null}
              />
              <DataRow
                label={copy.detail.fields.serviceStartedOn}
                value={company.serviceStartedOn ? formatDateBr(company.serviceStartedOn) : null}
              />
              <DataRow label={copy.detail.fields.address} value={addressLine} />
              <DataRow
                label={copy.detail.fields.shareCapital}
                value={
                  company.shareCapital != null
                    ? company.shareCapital.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })
                    : null
                }
              />
              <DataRow
                label={copy.detail.fields.cnae}
                value={
                  [company.cnaeCode, company.cnaeDescription].filter(Boolean).join(' — ') || null
                }
              />
            </dl>
          </details>

          <PartnersSection companyId={id} partners={partners} />

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

      {tab === 'contatos' ? (
        <ContactsSection
          companyId={id}
          contacts={contacts}
          departments={config.departments.map((d) => ({ key: d.key, label: d.label }))}
        />
      ) : null}

      {tab === 'tarefas' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <CreateTaskButton
              companyOptions={[{ id, name: companyName }]}
              departments={config.departments.map((d) => ({ key: d.key, label: d.label }))}
              userOptions={userOptions}
            />
          </div>
          <TasksBoard
            tasks={tasks}
            view="all"
            me={me}
            companyNames={{ [id]: companyName }}
            departmentLabels={departmentLabels}
            userNames={Object.fromEntries(userOptions.map((u) => [u.id, u.name]))}
            userOptions={userOptions}
          />
        </div>
      ) : null}

      {tab === 'documentos' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link href={`/documentos?company=${id}`} className={secondaryButtonClass}>
              {copy.detail.openRepository}
            </Link>
          </div>
          {companyDocs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={copy.detail.documentsEmpty}
              description={copy.detail.documentsEmptyHint}
              action={
                <Link href={`/documentos?company=${id}`} className={primaryButtonClass}>
                  {copy.detail.openRepository}
                </Link>
              }
            />
          ) : (
            <DocumentList
              documents={companyDocs}
              departmentLabels={departmentLabels}
              classifications={documentClassifications}
              docTypes={[...config.taxonomy]}
            />
          )}
        </div>
      ) : null}

      {tab === 'prazos' ? (
        <PrazosSection
          companyId={id}
          prazos={prazos}
          kinds={config.monitoredKinds.map((k) => ({ key: k.key, label: k.label }))}
          defaultTriggerDays={config.deadlineTriggers.defaultDays}
          companyDocs={companyDocs.map((d) => ({ id: d.id, fileName: d.fileName }))}
        />
      ) : null}

      {tab === 'solicitacoes' || tab === 'envios' ? (
        <SolicitacoesSection
          companyId={id}
          kind={tab === 'envios' ? 'document_offer' : 'upload_request'}
          requests={requests}
          companyDocs={companyDocs.map((d) => ({ id: d.id, fileName: d.fileName }))}
          docTypes={[...config.taxonomy]}
          defaultExpiryDays={config.requestTokenExpiryDays}
        />
      ) : null}
    </div>
  );
}
