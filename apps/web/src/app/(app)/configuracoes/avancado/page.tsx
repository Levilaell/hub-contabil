import { parseFirmConfig } from '@hub/config';
import { EmptyState, PageHeader } from '@hub/ui';
import { SlidersHorizontal } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

import { AdvancedForm } from './advanced-form';
import { copy } from './copy';

// Edit the firm's advanced vocabularies (departments, document taxonomy, routing map).
// Manager-only; the write chain is validated + audited in @hub/db.
export default async function AvancadoPage() {
  const supabase = await createClient();
  const [{ data: firm }, { data: userData }] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    supabase.auth.getUser(),
  ]);
  const role = userData.user?.app_metadata?.role as string | undefined;
  const canEdit = role === 'owner' || role === 'manager';

  const config = parseFirmConfig(firm?.config);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      {!canEdit ? (
        <EmptyState icon={SlidersHorizontal} title={copy.restricted} />
      ) : (
        <AdvancedForm
          initialDepartments={config.departments}
          initialTaxonomy={config.taxonomy}
          initialRoutingMap={config.routingMap}
        />
      )}
    </div>
  );
}
