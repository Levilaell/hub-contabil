import { PageHeader } from '@hub/ui';

import { copy } from '../copy';
import { ImportWizard } from './import-wizard';

export default function ImportarEmpresasPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={copy.import.title} description={copy.import.subtitle} />
      <ImportWizard />
    </div>
  );
}
