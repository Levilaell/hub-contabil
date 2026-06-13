import {
  DataList,
  DataListRow,
  DetailDrawer,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonList,
  StatCard,
  StatusBadge,
  TrafficLight,
  aggregateTrafficLight,
  cn,
} from '@hub/ui';
import {
  AlertTriangle,
  CalendarClock,
  Inbox,
  ListChecks,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { copy } from './copy';
import { ShellPreview } from './shell-preview';

const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90';
const secondaryBtn =
  'inline-flex items-center gap-2 rounded-lg border bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {title}
        </h2>
        {hint ? <p className="text-muted-foreground mt-1 text-sm">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

// Complete literal class strings — Tailwind cannot detect classes built by
// string interpolation (e.g. `bg-${token}`), so each swatch spells it out.
const swatches = [
  { bg: 'bg-success', label: copy.tones.success },
  { bg: 'bg-warning', label: copy.tones.warning },
  { bg: 'bg-danger', label: copy.tones.danger },
  { bg: 'bg-neutral', label: copy.tones.neutral },
  { bg: 'bg-muted', label: copy.tones.muted },
] as const;

function ColorScale() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {swatches.map((s) => (
        <div key={s.bg} className="space-y-1.5">
          <div className={cn('h-12 rounded-lg border', s.bg)} />
          <p className="text-muted-foreground text-xs">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

const aggExample = aggregateTrafficLight(['ok', 'upcoming', 'overdue']);

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 p-6 md:p-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">{copy.subtitle}</p>
      </header>

      <Section title={copy.sections.colors} hint={copy.sections.colorsHint}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-background space-y-2 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium">{copy.theme.light}</p>
            <ColorScale />
          </div>
          <div className="dark bg-background text-foreground space-y-2 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium">{copy.theme.dark}</p>
            <ColorScale />
          </div>
        </div>
      </Section>

      <Section title={copy.sections.statusBadge}>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success" label={copy.status.emDia} />
          <StatusBadge tone="warning" label={copy.status.venceBreve} />
          <StatusBadge tone="danger" label={copy.status.vencido} />
          <StatusBadge tone="neutral" label={copy.status.pendente} />
          <StatusBadge tone="muted" label={copy.status.semDados} />
        </div>
      </Section>

      <Section title={copy.sections.trafficLight} hint={copy.sections.trafficLightHint}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex items-center gap-2 text-sm">
              <TrafficLight state="red" label={copy.farol.vencido} /> {copy.farol.vencido}
            </span>
            <span className="flex items-center gap-2 text-sm">
              <TrafficLight state="yellow" label={copy.farol.proximo} /> {copy.farol.proximo}
            </span>
            <span className="flex items-center gap-2 text-sm">
              <TrafficLight state="green" label={copy.farol.emDia} /> {copy.farol.emDia}
            </span>
            <span className="flex items-center gap-2 text-sm">
              <TrafficLight state="gray" label={copy.farol.semDados} /> {copy.farol.semDados}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TrafficLight state="green" size="sm" />
            <TrafficLight state="green" size="md" />
            <TrafficLight state="green" size="lg" />
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            {copy.farol.agg} <TrafficLight state={aggExample} label={copy.farol.vencido} />
            <span className="font-mono text-xs">{aggExample}</span>
          </p>
        </div>
      </Section>

      <Section title={copy.sections.statCard}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={copy.stats.tarefasHoje}
            value={12}
            icon={ListChecks}
            tone="neutral"
            href="#"
          />
          <StatCard
            label={copy.stats.excecoes}
            value={2}
            icon={AlertTriangle}
            tone="warning"
            href="#"
          />
          <StatCard
            label={copy.stats.prazos}
            value={5}
            icon={CalendarClock}
            tone="danger"
            hint={copy.stats.hojeVencem}
            href="#"
          />
          <StatCard
            label={copy.stats.solicitacoes}
            value={3}
            icon={Send}
            tone="neutral"
            hint={copy.stats.aguardando}
            href="#"
          />
        </div>
      </Section>

      <Section title={copy.sections.dataList}>
        <DataList>
          <DataListRow
            href="#"
            leading={<TrafficLight state="red" label={copy.farol.vencido} />}
            title={copy.list.companies[0].name}
            facts={[copy.list.companies[0].fact1, copy.list.companies[0].fact2]}
            trailing={<StatusBadge tone="danger" label={copy.status.vencido} />}
          />
          <DataListRow
            href="#"
            leading={<TrafficLight state="yellow" label={copy.farol.proximo} />}
            title={copy.list.companies[1].name}
            facts={[copy.list.companies[1].fact1, copy.list.companies[1].fact2]}
            trailing={<StatusBadge tone="warning" label={copy.status.venceBreve} />}
          />
          <DataListRow
            href="#"
            leading={<TrafficLight state="green" label={copy.farol.emDia} />}
            title={copy.list.companies[2].name}
            facts={[copy.list.companies[2].fact1, copy.list.companies[2].fact2]}
            trailing={<StatusBadge tone="success" label={copy.status.emDia} />}
          />
        </DataList>
      </Section>

      <Section title={copy.sections.states}>
        <div className="grid gap-6 md:grid-cols-2">
          <EmptyState
            icon={Inbox}
            title={copy.empty.title}
            description={copy.empty.description}
            action={
              <button type="button" className={secondaryBtn}>
                <RefreshCw className="size-4" aria-hidden />
                {copy.empty.action}
              </button>
            }
          />
          <EmptyState
            icon={AlertTriangle}
            title={copy.error.title}
            description={copy.error.description}
            action={
              <button type="button" className={primaryBtn}>
                <RefreshCw className="size-4" aria-hidden />
                {copy.error.action}
              </button>
            }
          />
        </div>
        <SkeletonList rows={3} />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </Section>

      <Section title={copy.sections.pageHeader}>
        <div className="bg-card rounded-xl border p-4">
          <PageHeader
            title={copy.header.title}
            description={copy.header.subtitle}
            action={
              <button type="button" className={primaryBtn}>
                <Plus className="size-4" aria-hidden />
                {copy.header.action}
              </button>
            }
          />
        </div>
      </Section>

      <Section title={copy.sections.drawer}>
        <DetailDrawer
          title={copy.drawer.title}
          description={copy.drawer.subtitle}
          closeLabel={copy.drawer.close}
          trigger={
            <button type="button" className={secondaryBtn}>
              {copy.drawer.open}
            </button>
          }
          footer={
            <button type="button" className={primaryBtn}>
              {copy.drawer.footerAction}
            </button>
          }
        >
          <p className="text-muted-foreground text-sm">{copy.drawer.body}</p>
        </DetailDrawer>
      </Section>

      <Section title={copy.sections.appShell}>
        <ShellPreview />
      </Section>

      <Section title={copy.sections.darkMode} hint={copy.sections.darkModeHint}>
        <div className="dark bg-background text-foreground space-y-4 rounded-xl border p-6">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success" label={copy.status.emDia} />
            <StatusBadge tone="warning" label={copy.status.venceBreve} />
            <StatusBadge tone="danger" label={copy.status.vencido} />
            <StatusBadge tone="neutral" label={copy.status.pendente} />
            <StatusBadge tone="muted" label={copy.status.semDados} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label={copy.stats.tarefasHoje} value={12} icon={ListChecks} tone="neutral" />
            <StatCard
              label={copy.stats.prazos}
              value={5}
              icon={CalendarClock}
              tone="danger"
              hint={copy.stats.hojeVencem}
            />
          </div>
          <DataList>
            <DataListRow
              leading={<TrafficLight state="red" label={copy.farol.vencido} />}
              title={copy.list.companies[0].name}
              facts={[copy.list.companies[0].fact1, copy.list.companies[0].fact2]}
              trailing={<StatusBadge tone="danger" label={copy.status.vencido} />}
            />
            <DataListRow
              leading={<TrafficLight state="green" label={copy.farol.emDia} />}
              title={copy.list.companies[2].name}
              facts={[copy.list.companies[2].fact1, copy.list.companies[2].fact2]}
              trailing={<StatusBadge tone="success" label={copy.status.emDia} />}
            />
          </DataList>
        </div>
      </Section>
    </div>
  );
}
