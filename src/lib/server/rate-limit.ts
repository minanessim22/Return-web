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

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const res = await fetch(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          ['INCR', `rate_limit:${key}`],
          ['TTL', `rate_limit:${key}`]
        ])
      });

      if (res.ok) {
        const data = await res.json();
        const count = data[0]?.result;
        const ttl = data[1]?.result;

        if (count === 1 || ttl === -1) {
          // Set expiry window
          await fetch(`${redisUrl}/expire/rate_limit:${key}/${Math.ceil(windowMs / 1000)}`, {
            headers: { Authorization: `Bearer ${redisToken}` }
          });
        }

        return {
          allowed: count <= limit,
          remaining: Math.max(0, limit - count),
          retryAfterMs: ttl > 0 ? ttl * 1000 : windowMs
        };
      }
    } catch (err) {
      console.error('[Rate Limit] Redis check failed, falling back to memory:', err);
    }
  }

  // Local fallback (in-memory)
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
