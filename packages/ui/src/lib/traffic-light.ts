// THE central visual metaphor (CLAUDE.md UX rule #4). The aggregation rule is
// pure and lives here so the UI, worker, and panels all compute it identically.

/** A single deadline's situation, the input to traffic-light aggregation. */
export type DeadlineState = 'overdue' | 'upcoming' | 'ok';

/** The aggregated light shown on a panel/list/dashboard. */
export type TrafficLightState = 'red' | 'yellow' | 'green' | 'gray';

/**
 * Aggregate many deadline states into one light:
 *   red    — any overdue
 *   yellow — any upcoming and none overdue
 *   green  — all ok
 *   gray   — no data
 */
export function aggregateTrafficLight(items: readonly DeadlineState[]): TrafficLightState {
  if (items.length === 0) {
    return 'gray';
  }
  if (items.some((state) => state === 'overdue')) {
    return 'red';
  }
  if (items.some((state) => state === 'upcoming')) {
    return 'yellow';
  }
  return 'green';
}
