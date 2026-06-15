import { ChevronRight } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

import { cn } from '../lib/cn';

// Progressive disclosure (CLAUDE.md UX rule #2): a list row shows the minimum —
// an indicator, the title, and up to two facts. Everything else lives one click
// away in a DetailDrawer/detail page.
export function DataList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={cn('divide-border bg-card divide-y overflow-hidden rounded-xl border', className)}
    >
      {children}
    </ul>
  );
}

export interface DataListRowProps {
  /** Status indicator — a <TrafficLight> or <StatusBadge>. */
  leading?: ReactNode;
  title: string;
  /** Up to two key facts; extras are dropped (detail lives in the drawer). */
  facts?: string[];
  /** Optional right-aligned slot, e.g. a <StatusBadge>. */
  trailing?: ReactNode;
  /** When set, the whole row links here. */
  href?: string;
  /** Link element to render when href is set (e.g. Next's Link). Defaults to "a". */
  linkComponent?: ElementType;
  /** When set (and no href), the row is a button — e.g. to open a detail drawer. */
  onClick?: () => void;
  className?: string;
}

export function DataListRow({
  leading,
  title,
  facts = [],
  trailing,
  href,
  linkComponent,
  onClick,
  className,
}: DataListRowProps) {
  const Root: ElementType = href ? (linkComponent ?? 'a') : onClick ? 'button' : 'div';
  const interactive = Boolean(href || onClick);
  const rootProps = href ? { href } : onClick ? { type: 'button' as const, onClick } : {};
  const shown = facts.slice(0, 2);
  return (
    <li>
      <Root
        {...rootProps}
        className={cn(
          'flex w-full items-center gap-3 p-4 text-left',
          interactive &&
            'hover:bg-accent focus-visible:ring-ring group transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset',
          className,
        )}
      >
        {leading ? <span className="grid shrink-0 place-items-center">{leading}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          {shown.length ? (
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">
              {shown.join(' · ')}
            </span>
          ) : null}
        </span>
        {trailing ? <span className="shrink-0">{trailing}</span> : null}
        {interactive ? (
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        ) : null}
      </Root>
    </li>
  );
}
