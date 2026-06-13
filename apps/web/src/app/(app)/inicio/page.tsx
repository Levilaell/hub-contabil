import { EmptyState, PageHeader } from '@hub/ui';
import { LayoutDashboard } from 'lucide-react';

import { copy } from './copy';

// Placeholder home — exists so the app shell is reachable and exercised with
// real Next routing. The real dashboard (StatCards + traffic-light panels) is T13.
export default function InicioPage() {
  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <EmptyState
        icon={LayoutDashboard}
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    </div>
  );
}
