const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000;

/**
 * Fixed-window in-memory rate limiter (single instance).
 * Returns true when the request is allowed.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
    if (buckets.size > MAX_KEYS) buckets.clear();
  }
  return true;
}
