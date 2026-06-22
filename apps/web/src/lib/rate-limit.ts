// In-memory fixed-window rate limiter (T24). Guards the public token route (/s/[token])
// from abuse. Per-instance: fine for the v1 single-instance web deploy; a multi-instance
// deploy should move this to a shared store (a pg table or Redis) — see HARDENING.md.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the call is allowed, false if `key` has exceeded `limit` within
 * the current `windowMs`. `now` is injectable for tests.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  // Opportunistic prune so the map can't grow without bound under many distinct IPs.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Test seam: clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
