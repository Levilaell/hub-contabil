import { PageHeader, SkeletonList } from '@hub/ui';

import { copy } from './copy';

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.subtitle} />
      <SkeletonList />
    </div>
  );
}
