import { parseFirmConfig } from '@hub/config';
import { listCompanies, listTasks } from '@hub/db';
import { PageHeader } from '@hub/ui';
import { Repeat } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { CreateTaskButton } from './create-task-button';
import { TasksBoard } from './tasks-board';

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view = rawView === 'all' ? 'all' : 'mine';

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id ?? '';

  const [{ data: firm }, companies, tasks, { data: users }] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    listCompanies(supabase, { status: 'all' }),
    listTasks(supabase, view === 'mine' ? { assigneeId: me } : undefined),
    supabase.from('users').select('id, full_name, email'),
  ]);

  const departments = parseFirmConfig(firm?.config).departments.map((d) => ({
    key: d.key,
    label: d.label,
  }));
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.tradeName || c.legalName }));
  const userOptions = (users ?? []).map((u) => ({ id: u.id, name: u.full_name || u.email }));
  const companyNames = Object.fromEntries(companyOptions.map((c) => [c.id, c.name]));
  const departmentLabels = Object.fromEntries(departments.map((d) => [d.key, d.label]));
  const userNames = Object.fromEntries(userOptions.map((u) => [u.id, u.name]));

  const tab = (key: 'mine' | 'all', label: string) => (
    <Link
      href={`/tarefas?view=${key}`}
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
        <Link
          href="/tarefas/recorrentes"
          className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 px-3 py-2 text-sm"
        >
          <Repeat className="size-4" aria-hidden />
          {copy.recurring}
        </Link>
      </div>

      <TasksBoard
        tasks={tasks}
        view={view}
        me={me}
        companyNames={companyNames}
        departmentLabels={departmentLabels}
        userNames={userNames}
      />
    </div>
  );
}
