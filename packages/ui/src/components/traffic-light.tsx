import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../lib/cn';
import type { TrafficLightState } from '../lib/traffic-light';

// The shared traffic-light dot. Identical everywhere (panels, lists, dashboard).
// Aggregation lives in ../lib/traffic-light (aggregateTrafficLight).
// The dot is filled with the state color and wrapped in a soft outer halo — the
// "light" of the farol (an outer ring, not inset; design/README.md).
const light = cva('inline-block shrink-0 rounded-full ring-4', {
  variants: {
    state: {
      red: 'bg-danger ring-danger/16',
      yellow: 'bg-warning ring-warning/20',
      green: 'bg-success ring-success/16',
      gray: 'bg-neutral ring-neutral/25',
    },
    size: {
      sm: 'size-2.5',
      md: 'size-3.5',
      lg: 'size-4',
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
