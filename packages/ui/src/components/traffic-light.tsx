import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../lib/cn';
import type { TrafficLightState } from '../lib/traffic-light';

// The shared traffic-light dot. Identical everywhere (panels, lists, dashboard).
// Aggregation lives in ../lib/traffic-light (aggregateTrafficLight).
const light = cva('inline-block shrink-0 rounded-full ring-2 ring-inset', {
  variants: {
    state: {
      red: 'bg-danger ring-danger/25',
      yellow: 'bg-warning ring-warning/30',
      green: 'bg-success ring-success/25',
      gray: 'bg-muted-foreground/40 ring-border',
    },
    size: {
      sm: 'size-2.5',
      md: 'size-3.5',
      lg: 'size-5',
    },
  },
  defaultVariants: { state: 'gray', size: 'md' },
});

export interface TrafficLightProps extends VariantProps<typeof light> {
  state: TrafficLightState;
  /** Accessible description of the state, e.g. "Vencido". */
  label?: string;
  className?: string;
}

export function TrafficLight({ state, size, label, className }: TrafficLightProps) {
  return (
    <span
      className={cn(light({ state, size }), className)}
      role="img"
      aria-label={label ?? state}
      title={label}
    />
  );
}
