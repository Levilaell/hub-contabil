import { parseFirmConfig } from '@hub/config';
import { listCompanies, listExportBatches } from '@hub/db';
import { PageHeader } from '@hub/ui';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

import { BatchesList } from './batches-list';
import { copy } from './copy';
import { ExportBuilder } from './export-builder';

export default async function ExportacaoPage() {
  const supabase = await createClient();
  const [{ data: firm }, companies, batches] = await Promise.all([
    supabase.from('firms').select('config').limit(1).single(),
    listCompanies(supabase, { status: 'all' }),
    listExportBatches(supabase),
  ]);
  const config = parseFirmConfig(firm?.config);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.tradeName || c.legalName }));

  return (
    <div className="space-y-6">
      <Link
        href="/documentos"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {copy.back}
      </Link>

      <PageHeader title={copy.title} description={copy.subtitle} />

      <ExportBuilder companies={companyOptions} docTypes={[...config.taxonomy]} />

      <BatchesList batches={batches} />
    </div>
  );
}
