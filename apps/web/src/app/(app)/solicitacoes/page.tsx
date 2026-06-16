import { listAllRequests } from '@hub/db';
import { PageHeader } from '@hub/ui';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { RequestsList } from './requests-list';

// Global follow-up screen (T17): every request across the firm's companies, with
// status, timeline and resend. One question per screen — "o que está pendente?".
export default async function SolicitacoesPage() {
  const supabase = await createClient();
  const requests = await listAllRequests(supabase);

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <RequestsList requests={requests} />
    </div>
  );
}
