import { parseFirmConfig } from '@hub/config';
import { countUnassignedOpenTasks, listCompanies, listRecurringTasks, listTasks } from '@hub/db';
import { PageHeader } from '@hub/ui';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { CreateTaskButton } from './create-task-button';
import { TasksBoard } from './tasks-board';

// Competência helpers (Fase 1.1 §2): the board opens on the current month with
// « » navigation; ad-hoc tasks (no period) always show. All in firm time (SP).
function currentPeriod(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const total = (y ?? 2026) * 12 + ((m ?? 1) - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const label = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; department?: string }>;
}) {
  const { view: rawView, period: rawPeriod, department: rawDepartment } = await searchParams;
  const view = rawView === 'all' ? 'all' : rawView === 'unassigned' ? 'unassigned' : 'mine';
  const period =
    rawPeriod === 'all' ? 'all' : /^\d{4}-\d{2}$/.test(rawPeriod ?? '') ? rawPeriod! : currentPeriod();

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id ?? '';

  const { data: firm } = await supabase.from('firms').select('config').limit(1).single();
  const departments = parseFirmConfig(firm?.config).departments.map((d) => ({
    key: d.key,
    label: d.label,
  }));
  const department = departments.some((d) => d.key === rawDepartment) ? rawDepartment : undefined;

  const [companies, tasks, { data: users }, unassignedCount, recurringTemplates] =
    await Promise.all([
      listCompanies(supabase, { status: 'all' }),
      listTasks(supabase, {
        ...(view === 'mine' ? { assigneeId: me } : {}),
        ...(view === 'unassigned' ? { unassigned: true } : {}),
        ...(period !== 'all' ? { period, includeNoPeriod: true } : {}),
        ...(department ? { department } : {}),
      }),
      supabase.from('users').select('id, full_name, email'),
      countUnassignedOpenTasks(supabase),
      listRecurringTasks(supabase),
    ]);

  const companyOptions = companies.map((c) => ({ id: c.id, name: c.tradeName || c.legalName }));
  const userOptions = (users ?? []).map((u) => ({ id: u.id, name: u.full_name || u.email }));
  const companyNames = Object.fromEntries(companyOptions.map((c) => [c.id, c.name]));
  const departmentLabels = Object.fromEntries(departments.map((d) => [d.key, d.label]));
  const userNames = Object.fromEntries(userOptions.map((u) => [u.id, u.name]));

  const href = (params: { view?: string; period?: string; department?: string | null }) => {
    const q = new URLSearchParams();
    q.set('view', params.view ?? view);
    const p = params.period ?? period;
    if (p !== currentPeriod()) q.set('period', p);
    const d = params.department === undefined ? department : params.department;
    if (d) q.set('department', d);
    return `/tarefas?${q.toString()}`;
  };

  const tab = (key: 'mine' | 'all' | 'unassigned', label: string) => (
    <Link
      href={href({ view: key })}
      aria-current={view === key ? 'page' : undefined}
      className={
        view === key
          ? 'border-primary -mb-px border-b-2 px-3 py-2 text-sm font-medium'
          : 'text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2 text-sm'
      }
    >
      {label}
    </Link>
  );

  const chip = (label: string, active: boolean, target: string) => (
    <Link
      key={target}
      href={target}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium'
          : 'text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs'
      }
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        action={
          <CreateTaskButton
            companyOptions={companyOptions}
            departments={departments}
            userOptions={userOptions}
          />
        }
      />

      <div className="border-border flex items-center gap-1 border-b">
        {tab('mine', copy.viewMine)}
        {tab('all', copy.viewAll)}
        {/* Queue of ownerless open tasks (T28) — count is firm-wide so the gap is
            visible from any month/department filter. */}
        {tab(
          'unassigned',
          unassignedCount > 0 ? `${copy.viewUnassigned} (${unassignedCount})` : copy.viewUnassigned,
        )}
        <Link
          href="/tarefas/recorrentes"
          className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 px-3 py-2 text-sm"
        >
          <Repeat className="size-4" aria-hidden />
          {copy.recurring}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* « Julho » month navigation — default view is the current competência. */}
        <div className="flex items-center gap-1">
          <Link
            href={href({ period: shiftPeriod(period === 'all' ? currentPeriod() : period, -1) })}
            aria-label={copy.period.prev}
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="min-w-36 text-center text-sm font-medium">
            {period === 'all' ? copy.period.all : periodLabel(period)}
          </span>
          <Link
            href={href({ period: shiftPeriod(period === 'all' ? currentPeriod() : period, 1) })}
            aria-label={copy.period.next}
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          {period !== 'all' && period !== currentPeriod() ? (
            <Link
              href={href({ period: currentPeriod() })}
              className="text-muted-foreground hover:text-foreground ml-1 text-xs underline-offset-2 hover:underline"
            >
              {copy.period.backToCurrent}
            </Link>
          ) : null}
          {period !== 'all' ? (
            <Link
              href={href({ period: 'all' })}
              className="text-muted-foreground hover:text-foreground ml-1 text-xs underline-offset-2 hover:underline"
            >
              {copy.period.all}
            </Link>
          ) : null}
        </div>

        {/* Department filter (Fase 1.1 §2) — the owner/manager sees everything by
            default and narrows to one department in a click. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {chip(copy.departmentFilter.all, !department, href({ department: null }))}
          {departments.map((d) => chip(d.label, department === d.key, href({ department: d.key })))}
        </div>
      </div>

      <TasksBoard
        tasks={tasks}
        view={view}
        me={me}
        companyNames={companyNames}
        departmentLabels={departmentLabels}
        userNames={userNames}
        userOptions={userOptions}
        recurringTitles={Object.fromEntries(recurringTemplates.map((t) => [t.id, t.title]))}
      />
    </div>
  );
}
