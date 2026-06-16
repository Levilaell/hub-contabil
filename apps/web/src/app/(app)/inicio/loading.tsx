import { PageHeader, Skeleton, SkeletonList } from '@hub/ui';

import { copy } from './copy';

// Loading = skeletons, never spinners (CLAUDE.md UX rule #7).
// Mirrors the dashboard shape: 6 stat cards + the company panel list.
export default function InicioLoading() {
  return (
    <div className="space-y-8">
      <PageHeader title={copy.title} description={copy.subtitle} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-xl border p-5" aria-busy>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-5 rounded-md" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <SkeletonList rows={5} />
      </section>
    </div>
  );
}
