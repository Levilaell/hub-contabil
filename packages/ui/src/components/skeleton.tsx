import { cn } from '../lib/cn';

// Loading = skeletons, never spinners (CLAUDE.md UX rule #7).
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} aria-hidden />;
}

/** A list-shaped skeleton matching DataList rows, for list loading states. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-border bg-card divide-y rounded-xl border', className)} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-3.5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
