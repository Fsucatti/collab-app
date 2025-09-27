// lib/rateLimit.ts
type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 60, refillMs = 60_000) {
  // limit requests per window; simple token bucket (in-memory)
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: limit, last: now };
  const elapsed = now - b.last;
  const refill = Math.floor(elapsed / refillMs) * limit; // refill on whole windows
  const tokens = Math.min(limit, b.tokens + refill);
  const next: Bucket = { tokens, last: tokens === limit ? now : b.last };
  if (next.tokens <= 0) return false;
  next.tokens -= 1;
  next.last = now;
  buckets.set(key, next);
  return true;
}
