import { afterEach, describe, expect, it } from 'vitest';

import { rateLimit, resetRateLimits } from './rate-limit';

describe('rateLimit', () => {
  afterEach(() => resetRateLimits());

  it('allows up to the limit, then blocks within the window', () => {
    const t = 1_000;
    expect(rateLimit('ip:a', 3, 60_000, t)).toBe(true);
    expect(rateLimit('ip:a', 3, 60_000, t)).toBe(true);
    expect(rateLimit('ip:a', 3, 60_000, t)).toBe(true);
    expect(rateLimit('ip:a', 3, 60_000, t)).toBe(false); // 4th in window → blocked
  });

  it('resets after the window elapses', () => {
    expect(rateLimit('ip:b', 1, 60_000, 0)).toBe(true);
    expect(rateLimit('ip:b', 1, 60_000, 0)).toBe(false);
    expect(rateLimit('ip:b', 1, 60_000, 60_001)).toBe(true); // new window
  });

  it('tracks keys independently', () => {
    expect(rateLimit('ip:c', 1, 60_000, 0)).toBe(true);
    expect(rateLimit('ip:d', 1, 60_000, 0)).toBe(true); // different key, own bucket
    expect(rateLimit('ip:c', 1, 60_000, 0)).toBe(false);
  });
});
