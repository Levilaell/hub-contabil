import { describe, expect, it } from 'vitest';

import { deriveMonitoredStatus, monitoredToDeadlineSignal } from './monitored';

const TODAY = '2026-06-15';

describe('deriveMonitoredStatus', () => {
  it('is no_date when there is no due date', () => {
    expect(deriveMonitoredStatus(null, 30, TODAY)).toBe('no_date');
  });

  it('is overdue strictly in the past', () => {
    expect(deriveMonitoredStatus('2026-06-14', 30, TODAY)).toBe('overdue');
    expect(deriveMonitoredStatus('2020-01-01', 30, TODAY)).toBe('overdue');
  });

  it('is due_soon on the due date itself (not overdue)', () => {
    expect(deriveMonitoredStatus('2026-06-15', 30, TODAY)).toBe('due_soon');
  });

  it('is due_soon on the inclusive early edge of the window', () => {
    // window start = due - trigger = 2026-06-15 → today
    expect(deriveMonitoredStatus('2026-07-15', 30, TODAY)).toBe('due_soon');
  });

  it('is valid one day before the window opens', () => {
    // window start = 2026-06-16, today = 2026-06-15 → still valid
    expect(deriveMonitoredStatus('2026-07-16', 30, TODAY)).toBe('valid');
  });

  it('is valid for a far-future due date', () => {
    expect(deriveMonitoredStatus('2027-01-01', 30, TODAY)).toBe('valid');
  });

  it('handles trigger_days = 0 (due_soon only on the due date)', () => {
    expect(deriveMonitoredStatus('2026-06-15', 0, TODAY)).toBe('due_soon');
    expect(deriveMonitoredStatus('2026-06-16', 0, TODAY)).toBe('valid');
    expect(deriveMonitoredStatus('2026-06-14', 0, TODAY)).toBe('overdue');
  });

  it('crosses month boundaries correctly in the window math', () => {
    // due 2026-07-05, trigger 10 → window start 2026-06-25; today 2026-06-15 → valid
    expect(deriveMonitoredStatus('2026-07-05', 10, TODAY)).toBe('valid');
    // today 2026-06-25 would be due_soon
    expect(deriveMonitoredStatus('2026-07-05', 10, '2026-06-25')).toBe('due_soon');
  });
});

describe('monitoredToDeadlineSignal', () => {
  it('maps statuses to traffic-light signals', () => {
    expect(monitoredToDeadlineSignal('overdue')).toBe('overdue');
    expect(monitoredToDeadlineSignal('needs_update')).toBe('overdue');
    expect(monitoredToDeadlineSignal('due_soon')).toBe('upcoming');
    expect(monitoredToDeadlineSignal('valid')).toBe('ok');
    expect(monitoredToDeadlineSignal('no_date')).toBeNull();
  });
});
