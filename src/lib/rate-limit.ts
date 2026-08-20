import "server-only";

/**
 * Rate limit i processminne. Räcker för en enda Node-process på Hostinger,
 * vilket är exakt vad vi kör. Vid flera instanser måste detta flyttas till DB
 * eller Redis — noterat medvetet, inte glömt.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now };
  }
  return { ok: true, retryAfterMs: 0 };
}

/** Städar utgångna nycklar så kartan inte växer obegränsat. */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
