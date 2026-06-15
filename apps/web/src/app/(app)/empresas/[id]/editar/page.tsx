import { parseFirmConfig } from '@hub/config';
import { getCompany } from '@hub/db';
import { PageHeader } from '@hub/ui';
import { notFound } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { updateCompanyAction } from '../../actions';
import { CompanyForm } from '../../company-form';
import { copy } from '../../copy';

export default async function EditarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [company, { data: firm }] = await Promise.all([
    getCompany(supabase, id),
    supabase.from('firms').select('config').limit(1).single(),
  ]);
  if (!company) notFound();

  const regimes = parseFirmConfig(firm?.config).taxRegimes.map((regime) => ({
    key: regime.key,
    label: regime.label,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.form.editTitle} description={copy.form.editSubtitle} />
      <div className="bg-card rounded-xl border p-5">
        <CompanyForm
          mode="edit"
          action={updateCompanyAction.bind(null, id)}
          regimes={regimes}
          defaults={{
            legalName: company.legalName,
            tradeName: company.tradeName,
            taxRegime: company.taxRegime,
            city: company.city,
            state: company.state,
          }}
          cancelHref={`/empresas/${id}`}
        />
      </div>
    </div>
  );
}
