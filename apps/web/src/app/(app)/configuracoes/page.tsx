import { parseFirmConfig } from '@hub/config';
import { PageHeader } from '@hub/ui';

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
        departments={config.departments}
        taxonomy={config.taxonomy}
        routingMap={config.routingMap}
      />
    </div>
  );
}
