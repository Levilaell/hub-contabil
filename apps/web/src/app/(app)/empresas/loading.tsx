import { PageHeader, SkeletonList } from '@hub/ui';

import { copy } from './copy';

// Loading = skeletons, never spinners (UX rule #7).
export default function EmpresasLoading() {
  return (
    <div className="space-y-6">
      <PageHeader title={copy.list.title} description={copy.list.subtitle} />
      <SkeletonList rows={5} />
    </div>
  );
}
