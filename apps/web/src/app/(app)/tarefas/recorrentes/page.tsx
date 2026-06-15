import { parseFirmConfig } from '@hub/config';
import { listCompanies, listRecurringTasks } from '@hub/db';
import { PageHeader } from '@hub/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { RecurringList } from './recurring-list';

export default async function RecorrentesPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const role = userData.user?.app_metadata?.role as string | undefined;
  const canManage = role === 'owner' || role === 'manager';

  const [{ data: firm }, templates, companies] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    listRecurringTasks(supabase),
    listCompanies(supabase, { status: 'active' }),
  ]);
  const config = parseFirmConfig(firm?.config);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/tarefas"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {copy.back}
      </Link>
      <PageHeader title={copy.title} description={copy.subtitle} />
      <RecurringList
        templates={templates}
        departments={config.departments.map((d) => ({ key: d.key, label: d.label }))}
        regimes={config.taxRegimes.map((r) => ({ key: r.key, label: r.label }))}
        companyOptions={companies.map((c) => ({ id: c.id, name: c.tradeName || c.legalName }))}
        canManage={canManage}
      />
    </div>
  );
}
