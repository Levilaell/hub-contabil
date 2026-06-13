import { type LucideProps, Inbox } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '../lib/cn';

// Designed empty state (CLAUDE.md UX rule #7): say what the absence means and
// what to do. Copy is always passed in (pt-BR lives in the feature's copy.ts).
export interface EmptyStateProps {
  icon?: ComponentType<LucideProps>;
  title: string;
  description?: string;
  /** Optional primary action (a button/link rendered by the feature). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground mb-4 grid size-12 place-items-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
