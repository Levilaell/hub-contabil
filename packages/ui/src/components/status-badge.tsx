import { type VariantProps, cva } from 'class-variance-authority';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  type LucideProps,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { cn } from '../lib/cn';

// Status as a shared visual language: color + icon + short label. The only
// status-badge implementation in the product — features must reuse it.
const statusBadge = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'border-success/20 bg-success/12 text-success-text',
        warning: 'border-warning/25 bg-warning/15 text-warning-text',
        danger: 'border-danger/20 bg-danger/12 text-danger-text',
        neutral: 'border-neutral/20 bg-neutral/12 text-neutral-text',
        muted: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof statusBadge>['tone']>;

const defaultIcon: Record<StatusTone, ComponentType<LucideProps>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Circle,
  muted: MinusCircle,
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: string;
  /** Override the default per-tone icon. */
  icon?: ComponentType<LucideProps>;
  className?: string;
}

export function StatusBadge({ tone = 'neutral', label, icon, className }: StatusBadgeProps) {
  const Icon = icon ?? defaultIcon[tone];
  return (
    <span className={cn(statusBadge({ tone }), className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
