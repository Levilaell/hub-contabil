import { type VariantProps, cva } from 'class-variance-authority';
import { ChevronRight, type LucideProps } from 'lucide-react';
import type { ComponentType, ElementType } from 'react';

import { cn } from '../lib/cn';

// Dashboard building block: one big number + label, clickable through to the
// filtered list behind it. "Numbers before tables" (CLAUDE.md UX rule #6).
const accent = cva('grid size-10 shrink-0 place-items-center rounded-lg', {
  variants: {
    tone: {
      success: 'bg-success/12 text-success',
      warning: 'bg-warning/15 text-warning',
      danger: 'bg-danger/12 text-danger',
      neutral: 'bg-neutral/12 text-neutral',
      muted: 'bg-muted text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'muted' },
});

export interface StatCardProps extends VariantProps<typeof accent> {
  label: string;
  value: string | number;
  icon?: ComponentType<LucideProps>;
  /** Optional supporting line, e.g. "3 vencem hoje". */
  hint?: string;
  /** When set, the whole card links here. */
  href?: string;
  /** Link element to render when href is set (e.g. Next's Link). Defaults to "a". */
  linkComponent?: ElementType;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
  href,
  linkComponent,
  className,
}: StatCardProps) {
  const Root: ElementType = href ? (linkComponent ?? 'a') : 'div';
  return (
    <Root
      href={href}
      className={cn(
        'bg-card text-card-foreground flex items-center gap-4 rounded-xl border p-4 text-left',
        href &&
          'hover:bg-accent focus-visible:ring-ring group transition-colors outline-none focus-visible:ring-2',
        className,
      )}
    >
      {Icon ? (
        <span className={accent({ tone })}>
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block truncate text-sm font-medium">{label}</span>
        <span className="block text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {hint ? <span className="text-muted-foreground block truncate text-xs">{hint}</span> : null}
      </span>
      {href ? (
        <ChevronRight
          className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </Root>
  );
}
