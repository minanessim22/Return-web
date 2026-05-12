type Bucket = {
  count: number;
  resetAt: number;
  touchedAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now || now - bucket.touchedAt > 60 * 60 * 1000) {
      buckets.delete(key);
    }
  }

  if (buckets.size <= MAX_BUCKETS) {
    return;
  }

  const ordered = [...buckets.entries()].sort((left, right) => left[1].touchedAt - right[1].touchedAt);
  for (const [key] of ordered.slice(0, buckets.size - MAX_BUCKETS)) {
    buckets.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
      touchedAt: now
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterMs: windowMs
    };
  }

  bucket.touchedAt = now;

  if (bucket.count >= limit) {
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now)
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterMs: Math.max(0, bucket.resetAt - now)
  };
}

export function getRateLimitBucketCount() {
  pruneExpiredBuckets(Date.now());
  return buckets.size;
}
