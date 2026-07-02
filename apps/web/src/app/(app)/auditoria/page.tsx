import { listAuditEvents } from '@hub/db';
import { EmptyState, PageHeader } from '@hub/ui';
import { ScrollText } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

import { AuditList } from './audit-list';
import { copy } from './copy';

// One question per screen: "what happened in this firm, and who did it?" Manager-only.
// Read-only — audit_events is written server-side (log_audit RPC / service role).
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const { entity } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const role = userData.user?.app_metadata?.role as string | undefined;
  const canView = role === 'owner' || role === 'manager';

  if (!canView) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title={copy.title} description={copy.subtitle} />
        <EmptyState icon={ScrollText} title={copy.restricted} />
      </div>
    );
  }

  const validEntity = entity && entity in copy.entities ? entity : undefined;
  const events = await listAuditEvents(supabase, { limit: 100, entity: validEntity });

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <AuditList events={events} entity={validEntity ?? 'all'} />
    </div>
  );
}
