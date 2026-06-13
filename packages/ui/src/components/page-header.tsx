import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

// One primary action per screen, visually dominant (CLAUDE.md UX rule #5).
export interface PageHeaderProps {
  title: string;
  description?: string;
  /** THE single primary action for the screen. */
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
