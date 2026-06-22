import { CFOP_DOMAIN } from '@hub/core';
import { listMappingRules } from '@hub/db';
import { PageHeader } from '@hub/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { copy } from './copy';
import { ImportButton } from './import-button';
import { RulesList } from './rules-list';

// Firm-wide CFOP mapping rules (T19). Reachable from Settings — the sidebar is
// capped at 7 items (UX rule #11), and rules are firm policy, not a daily queue.
export default async function RegrasPage() {
  const supabase = await createClient();
  const rules = await listMappingRules(supabase, { domain: CFOP_DOMAIN });

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {copy.back}
      </Link>

      <PageHeader title={copy.title} description={copy.subtitle} action={<ImportButton />} />

      <RulesList rules={rules} />
    </div>
  );
}
