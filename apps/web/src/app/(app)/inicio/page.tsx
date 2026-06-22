import { monitoredToDeadlineSignal } from '@hub/core';
import {
  countDocuments,
  countOpenExceptions,
  countOpenRequests,
  countOpenTasks,
  listCompanies,
  listMonitoredDocuments,
} from '@hub/db';
import {
  DataList,
  DataListRow,
  EmptyState,
  PageHeader,
  StatCard,
  TrafficLight,
  aggregateTrafficLight,
  type DeadlineState,
  type StatusTone,
  type TrafficLightState,
} from '@hub/ui';
import { AlertTriangle, Building2, CalendarClock, FileText, ListChecks, Send } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';

const LIGHT_ORDER: Record<TrafficLightState, number> = { red: 0, yellow: 1, green: 2, gray: 3 };

export default async function InicioPage() {
  const supabase = await createClient();
  const [openTasks, openExceptions, docCount, openRequests, companies, monitored] =
    await Promise.all([
      countOpenTasks(supabase),
      countOpenExceptions(supabase),
      countDocuments(supabase),
      countOpenRequests(supabase),
      listCompanies(supabase, { status: 'active' }),
      listMonitoredDocuments(supabase),
    ]);

  // Per-company deadline aggregation (status already recomputed on read).
  const stats = new Map<string, { signals: DeadlineState[]; overdue: number; soon: number }>();
  for (const m of monitored) {
    const entry = stats.get(m.companyId) ?? { signals: [], overdue: 0, soon: 0 };
    const signal = monitoredToDeadlineSignal(m.status);
    if (signal) entry.signals.push(signal);
    if (m.status === 'overdue') entry.overdue += 1;
    if (m.status === 'due_soon') entry.soon += 1;
    stats.set(m.companyId, entry);
  }
  const attention = monitored.filter(
    (m) => m.status === 'overdue' || m.status === 'due_soon',
  ).length;

  const cards: {
    label: string;
    value: number;
    icon: typeof ListChecks;
    tone: StatusTone;
    href?: string;
    hint?: string;
    hintTone?: StatusTone;
  }[] = [
    {
      label: copy.cards.openTasks,
      value: openTasks,
      icon: ListChecks,
      tone: 'neutral',
      href: '/tarefas?view=all',
    },
    {
      label: copy.cards.openExceptions,
      value: openExceptions,
      icon: AlertTriangle,
      tone: openExceptions > 0 ? 'danger' : 'muted',
      href: '/excecoes',
      hint: openExceptions > 0 ? copy.hints.exceptions : copy.hints.allClear,
      hintTone: openExceptions > 0 ? 'danger' : 'success',
    },
    {
      label: copy.cards.deadlines,
      value: attention,
      icon: CalendarClock,
      tone: attention > 0 ? 'warning' : 'muted',
      hint: attention > 0 ? copy.hints.deadlines : copy.hints.allClear,
      hintTone: attention > 0 ? 'warning' : 'success',
    },
    {
      label: copy.cards.companies,
      value: companies.length,
      icon: Building2,
      tone: 'neutral',
      href: '/empresas',
    },
    {
      label: copy.cards.documents,
      value: docCount,
      icon: FileText,
      tone: 'neutral',
      href: '/documentos',
    },
    {
      label: copy.cards.requests,
      value: openRequests,
      icon: Send,
      tone: openRequests > 0 ? 'warning' : 'muted',
      href: '/solicitacoes',
    },
  ];

  const panel = companies
    .map((company) => {
      const entry = stats.get(company.id);
      return { company, light: aggregateTrafficLight(entry?.signals ?? []), entry };
    })
    .sort((a, b) => LIGHT_ORDER[a.light] - LIGHT_ORDER[b.light]);

  return (
    <div className="space-y-8">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            hint={card.hint}
            hintTone={card.hintTone}
            href={card.href}
            linkComponent={card.href ? Link : undefined}
          />
        ))}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">{copy.panel.title}</h2>
          <p className="text-muted-foreground text-sm">{copy.panel.subtitle}</p>
        </div>
        {companies.length === 0 ? (
          <EmptyState icon={Building2} title={copy.panel.empty} />
        ) : (
          <DataList>
            {panel.map(({ company, light, entry }) => (
              <DataListRow
                key={company.id}
                href={`/empresas/${company.id}?tab=prazos`}
                linkComponent={Link}
                leading={<TrafficLight state={light} label={copy.lightLabel[light]} size="lg" />}
                title={company.tradeName || company.legalName}
                facts={[
                  entry ? copy.panel.facts(entry.overdue, entry.soon) : copy.panel.noDeadlines,
                ]}
              />
            ))}
          </DataList>
        )}
      </section>
    </div>
  );
}
