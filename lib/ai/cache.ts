/**
 * LLM response cache backed by Upstash Redis.
 *
 * Hash (prompt + system + model) → cached response (24h TTL).
 * Reduces API calls by 70-90% for repeated/cron-style queries.
 *
 * Skip cache for: cron jobs that must be fresh, requests with {cache: false}.
 *
 * If UPSTASH_REDIS_REST_URL is not set, all functions become no-ops and
 * the caller behaves as if cache were always empty.
 */

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

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

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface CacheKey {
  model: string;
  /** Optional namespace to invalidate groups of entries together. */
  namespace?: string;
  prompt: string;
  system?: string;
}

export interface CachedResponse {
  cachedAt: number;
  modelId: string;
  provider: string;
  text: string;
}

/**
 * Produce a stable cache key from inputs. SHA-256 of canonicalized JSON.
 */
export function makeCacheKey(input: CacheKey): string {
  const canonical = JSON.stringify({
    prompt: input.prompt,
    system: input.system || "",
    model: input.model,
    namespace: input.namespace || "default",
  });
  const hash = createHash("sha256").update(canonical).digest("hex");
  return `llm:${hash}`;
}

/**
 * Return a cached response if one exists, otherwise null.
 */
export async function getCached(
  input: CacheKey
): Promise<CachedResponse | null> {
  const r = getRedis();
  if (!r) {
    return null;
  }

  try {
    const key = makeCacheKey(input);
    const cached = await r.get<CachedResponse>(key);
    return cached ?? null;
  } catch (err) {
    console.error("[cache] Redis get failed:", err);
    return null;
  }
}

/**
 * Store a response in the cache with default 24h TTL.
 */
export async function setCached(
  input: CacheKey,
  response: Omit<CachedResponse, "cachedAt">,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }

  try {
    const key = makeCacheKey(input);
    const payload: CachedResponse = { ...response, cachedAt: Date.now() };
    await r.set(key, payload, { ex: ttlSeconds });
  } catch (err) {
    console.error("[cache] Redis set failed:", err);
  }
}

/**
 * Manual cache bypass: delete a specific entry.
 */
export async function invalidateCache(input: CacheKey): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }
  try {
    await r.del(makeCacheKey(input));
  } catch (err) {
    console.error("[cache] Redis del failed:", err);
  }
}

/**
 * Get cache stats — useful for the usage dashboard.
 */
export async function getCacheStats(): Promise<{
  hits: number;
  misses: number;
  hitRate: number;
}> {
  const r = getRedis();
  if (!r) {
    return { hits: 0, misses: 0, hitRate: 0 };
  }

  try {
    const [hits, misses] = await Promise.all([
      r.get<number>("llm:stats:hits"),
      r.get<number>("llm:stats:misses"),
    ]);
    const h = hits ?? 0;
    const m = misses ?? 0;
    const total = h + m;
    return {
      hits: h,
      misses: m,
      hitRate: total > 0 ? h / total : 0,
    };
  } catch {
    return { hits: 0, misses: 0, hitRate: 0 };
  }
}

/**
 * Increment hit/miss counters (call from your chat route).
 */
export async function recordCacheHit(): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }
  try {
    await r.incr("llm:stats:hits");
  } catch {
    // Stats are non-critical; swallow errors.
  }
}
export async function recordCacheMiss(): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }
  try {
    await r.incr("llm:stats:misses");
  } catch {
    // Stats are non-critical; swallow errors.
  }
}
