import { parseFirmConfig } from '@hub/config';
import { PageHeader } from '@hub/ui';

import { createClient } from '@/lib/supabase/server';

import { createCompanyAction } from '../actions';
import { CompanyForm } from '../company-form';
import { copy } from '../copy';

export default async function NovaEmpresaPage() {
  const supabase = await createClient();
  const { data: firm } = await supabase.from('firms').select('config').limit(1).single();
  const regimes = parseFirmConfig(firm?.config).taxRegimes.map((regime) => ({
    key: regime.key,
    label: regime.label,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.form.newTitle} description={copy.form.newSubtitle} />
      <div className="bg-card rounded-xl border p-5">
        <CompanyForm
          mode="create"
          action={createCompanyAction}
          regimes={regimes}
          cancelHref="/empresas"
        />
      </div>
    </div>
  );
}
