import { describe, expect, it } from 'vitest';

import { allowedTaskTransitions, canHandoffTask, canTransitionTask, isTaskStatus } from './task';

describe('task state machine', () => {
  it('allows the valid forward transitions', () => {
    expect(canTransitionTask('pending', 'in_progress')).toBe(true);
    expect(canTransitionTask('in_progress', 'done')).toBe(true);
    expect(canTransitionTask('pending', 'canceled')).toBe(true);
    expect(canTransitionTask('in_progress', 'canceled')).toBe(true);
  });

  it('rejects invalid and backward transitions', () => {
    expect(canTransitionTask('pending', 'done')).toBe(false); // must pass through in_progress
    expect(canTransitionTask('done', 'in_progress')).toBe(false); // terminal
    expect(canTransitionTask('canceled', 'pending')).toBe(false); // terminal
    expect(canTransitionTask('in_progress', 'pending')).toBe(false);
  });

  it('lists allowed transitions per status', () => {
    expect(allowedTaskTransitions('pending')).toEqual(['in_progress', 'canceled']);
    expect(allowedTaskTransitions('done')).toEqual([]);
  });

  it('permits handoff only from open statuses (mirrors the SQL guard)', () => {
    expect(canHandoffTask('pending')).toBe(true);
    expect(canHandoffTask('in_progress')).toBe(true);
    expect(canHandoffTask('done')).toBe(false);
    expect(canHandoffTask('canceled')).toBe(false);
  });

  it('guards the status type', () => {
    expect(isTaskStatus('pending')).toBe(true);
    expect(isTaskStatus('bogus')).toBe(false);
  });
});
