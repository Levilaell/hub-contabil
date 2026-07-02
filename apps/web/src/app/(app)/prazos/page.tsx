import { parseFirmConfig } from '@hub/config';
import { listFirmDeadlines, type FirmDeadline } from '@hub/db';
import {
  DataList,
  DataListRow,
  EmptyState,
  PageHeader,
  StatusBadge,
  TrafficLight,
  type StatusTone,
  type TrafficLightState,
} from '@hub/ui';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';

type Status = FirmDeadline['status'];

// Most urgent first; a due row above a far-future one within the same bucket.
const URGENCY: Record<Status, number> = {
  overdue: 0,
  needs_update: 0,
  due_soon: 1,
  valid: 2,
  no_date: 3,
};
const LIGHT: Record<Status, TrafficLightState> = {
  overdue: 'red',
  needs_update: 'red',
  due_soon: 'yellow',
  valid: 'green',
  no_date: 'gray',
};
const TONE: Record<Status, StatusTone> = {
  overdue: 'danger',
  needs_update: 'danger',
  due_soon: 'warning',
  valid: 'success',
  no_date: 'muted',
};
const ATTENTION: Status[] = ['overdue', 'needs_update', 'due_soon'];

function firmToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
function ymdToUtc(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
function dueText(dueDate: string | null, today: string): string {
  if (!dueDate) return copy.due.none;
  const diff = Math.round((ymdToUtc(dueDate) - ymdToUtc(today)) / 86_400_000);
  if (diff === 0) return copy.due.today;
  return diff > 0 ? copy.due.inDays(diff) : copy.due.agoDays(-diff);
}

function FilterTab({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium'
          : 'hover:bg-accent rounded-lg border px-3 py-1.5 text-sm font-medium'
      }
    >
      {label}
    </Link>
  );
}

// One question per screen: "which deadlines need me?" Default view = attention only.
export default async function PrazosPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const attention = view !== 'all';

  const supabase = await createClient();
  const [{ data: firm }, deadlines] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    listFirmDeadlines(supabase),
  ]);
  const kinds = parseFirmConfig(firm?.config).monitoredKinds;
  const kindLabel = (key: string) => kinds.find((k) => k.key === key)?.label ?? key;
  const today = firmToday();

  const attentionCount = deadlines.filter((d) => ATTENTION.includes(d.status)).length;
  const rows = deadlines
    .filter((d) => (attention ? ATTENTION.includes(d.status) : true))
    .sort(
      (a, b) =>
        URGENCY[a.status] - URGENCY[b.status] ||
        (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99'),
    );

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <div className="flex gap-2">
        <FilterTab active={attention} href="/prazos" label={copy.views.attention} />
        <FilterTab active={!attention} href="/prazos?view=all" label={copy.views.all} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={attention ? copy.emptyAttention : copy.emptyAll}
        />
      ) : (
        <div className="space-y-3">
          {attention ? (
            <p className="text-muted-foreground text-sm">{copy.countAttention(attentionCount)}</p>
          ) : null}
          <DataList>
            {rows.map((d) => (
              <DataListRow
                key={d.id}
                href={`/empresas/${d.companyId}?tab=prazos`}
                linkComponent={Link}
                leading={
                  <TrafficLight state={LIGHT[d.status]} label={copy.lightLabel[LIGHT[d.status]]} />
                }
                title={d.companyName}
                facts={[kindLabel(d.docKind), dueText(d.dueDate, today)]}
                trailing={<StatusBadge tone={TONE[d.status]} label={copy.status[d.status]} />}
              />
            ))}
          </DataList>
        </div>
      )}
    </div>
  );
}
