import { parseFirmConfig } from '@hub/config';
import { listAllRequests, listCompanies } from '@hub/db';
import { PageHeader } from '@hub/ui';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { CreateRequestButton } from './create-request-button';
import { RequestsList } from './requests-list';

// Global follow-up screen (T17/T31): every request across the firm's companies,
// with status, timeline, resend — and creation without leaving the page.
export default async function SolicitacoesPage() {
  const supabase = await createClient();
  const [requests, companies, { data: firm }] = await Promise.all([
    listAllRequests(supabase),
    listCompanies(supabase, { status: 'active' }),
    supabase.from('firms').select('config').limit(1).single(),
  ]);
  const config = parseFirmConfig(firm?.config);

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.subtitle}
        action={
          <CreateRequestButton
            companies={companies.map((c) => ({ id: c.id, name: c.tradeName || c.legalName }))}
            docTypes={[...config.taxonomy]}
            defaultExpiryDays={config.requestTokenExpiryDays}
          />
        }
      />
      <RequestsList requests={requests} />
    </div>
  );
}
