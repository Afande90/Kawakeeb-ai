/**
 * Pre-flight rate limit checker using Upstash Redis.
 *
 * Tracks RPM (requests per minute) and RPD (requests per day) per provider.
 * Before calling an LLM, ask canCall() — if false, the caller should rotate
 * to a different provider via getNextAvailableModel().
 *
 * After a successful call, call recordCall() to update counters.
 */

import { Redis } from "@upstash/redis";
import type { ProviderId } from "./multi-providers";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) {
    return redis;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

/**
 * Buffer below the actual limit. If rpm=30 and BUFFER=0.8, we stop
 * calling at 24 to leave headroom for race conditions.
 */
const SAFETY_BUFFER = 0.8;

function minuteKey(provider: ProviderId): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  return `rl:${provider}:m:${yyyy}${mm}${dd}${hh}${min}`;
}

function dayKey(provider: ProviderId): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `rl:${provider}:d:${yyyy}${mm}${dd}`;
}

/**
 * Check whether a provider can accept another call right now.
 * Returns true if both per-minute and per-day quotas have headroom.
 * If Redis is not configured, returns true (no enforcement).
 */
export async function canCall(
  provider: ProviderId,
  rpm: number,
  rpd: number
): Promise<boolean> {
  const r = getRedis();
  if (!r) {
    return true; // no Redis → no enforcement
  }

  try {
    const [perMinute, perDay] = await Promise.all([
      r.get<number>(minuteKey(provider)),
      r.get<number>(dayKey(provider)),
    ]);

    const minuteUsed = perMinute ?? 0;
    const dayUsed = perDay ?? 0;

    if (minuteUsed >= rpm * SAFETY_BUFFER) {
      return false;
    }
    if (rpd > 0 && dayUsed >= rpd * SAFETY_BUFFER) {
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[rate-limiter] Redis check failed for ${provider}:`, err);
    return true; // fail-open: don't block requests if Redis is unreachable
  }
}

/**
 * Record a successful call. Increments both minute and day counters with TTLs.
 */
export async function recordCall(provider: ProviderId): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }

  try {
    const mKey = minuteKey(provider);
    const dKey = dayKey(provider);

    // Increment + set TTL atomically (TTL is set only if key is new)
    await Promise.all([
      r.incr(mKey).then(async (val) => {
        if (val === 1) {
          await r.expire(mKey, 70); // 70s = 1 min + buffer
        }
      }),
      r.incr(dKey).then(async (val) => {
        if (val === 1) {
          await r.expire(dKey, 90_000); // 25h = 24h + buffer
        }
      }),
    ]);
  } catch (err) {
    console.error(`[rate-limiter] Redis record failed for ${provider}:`, err);
  }
}

/**
 * Get current usage stats for a provider (for the usage dashboard).
 */
export async function getUsage(provider: ProviderId): Promise<{
  perMinute: number;
  perDay: number;
}> {
  const r = getRedis();
  if (!r) {
    return { perMinute: 0, perDay: 0 };
  }

  try {
    const [m, d] = await Promise.all([
      r.get<number>(minuteKey(provider)),
      r.get<number>(dayKey(provider)),
    ]);
    return { perMinute: m ?? 0, perDay: d ?? 0 };
  } catch {
    return { perMinute: 0, perDay: 0 };
  }
}
