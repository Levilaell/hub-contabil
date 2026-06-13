import { describe, expect, it } from 'vitest';

import { type DeadlineState, aggregateTrafficLight } from './traffic-light';

describe('aggregateTrafficLight', () => {
  it('returns gray when there is no data', () => {
    expect(aggregateTrafficLight([])).toBe('gray');
  });

  it('returns green when every deadline is ok', () => {
    expect(aggregateTrafficLight(['ok', 'ok', 'ok'])).toBe('green');
  });

  it('returns yellow when something is upcoming and nothing is overdue', () => {
    expect(aggregateTrafficLight(['ok', 'upcoming', 'ok'])).toBe('yellow');
  });

  it('returns red when anything is overdue', () => {
    expect(aggregateTrafficLight(['ok', 'upcoming', 'overdue'])).toBe('red');
  });

  it('lets overdue take precedence over upcoming (red wins)', () => {
    const mixed: DeadlineState[] = ['upcoming', 'overdue'];
    expect(aggregateTrafficLight(mixed)).toBe('red');
  });

  it('returns red for a single overdue deadline', () => {
    expect(aggregateTrafficLight(['overdue'])).toBe('red');
  });

  it('returns yellow for a single upcoming deadline', () => {
    expect(aggregateTrafficLight(['upcoming'])).toBe('yellow');
  });
});
