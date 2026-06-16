import { PageHeader, SkeletonList } from '@hub/ui';

import { copy } from './copy';

// Loading = skeletons, never spinners (CLAUDE.md UX rule #7).
export default function SolicitacoesLoading() {
  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <SkeletonList rows={6} />
    </div>
  );
}
