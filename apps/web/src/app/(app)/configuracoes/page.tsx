import { parseFirmConfig } from '@hub/config';
import { PageHeader } from '@hub/ui';
import { ChevronRight, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { SettingsForm } from './settings-form';

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const [{ data: firm }, { data: userData }] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    supabase.auth.getUser(),
  ]);

  const config = parseFirmConfig(firm?.config);
  const role = userData.user?.app_metadata?.role as string | undefined;
  const canEdit = role === 'owner' || role === 'manager';

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <SettingsForm
        canEdit={canEdit}
        deadlineDefaultDays={config.deadlineTriggers.defaultDays}
        aiThreshold={config.aiThreshold}
        supportAutoReply={config.support.autoReply}
        supportAiThreshold={config.support.aiThreshold}
        departments={config.departments}
        taxonomy={config.taxonomy}
        routingMap={config.routingMap}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{copy.links.title}</h2>
        <Link
          href="/regras"
          className="bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-4 transition-colors"
        >
          <span className="bg-muted text-muted-foreground grid size-9 place-items-center rounded-full">
            <SlidersHorizontal className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{copy.links.rulesTitle}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {copy.links.rulesDescription}
            </span>
          </span>
          <ChevronRight className="text-muted-foreground size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
