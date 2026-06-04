/**
 * Pattern 7 (Odysseus) — Singleflight + shared short-TTL cache.
 *
 * When several callers need the same data in the same window (e.g. two
 * dashboard widgets or research sub-queries hitting the same source), fetch it
 * ONCE: concurrent callers await the same in-flight promise instead of each
 * firing the request. Plus a short in-memory TTL so repeated calls within the
 * window reuse the result. This is what keeps free-tier APIs from rate-death.
 *
 * In-memory only (per server instance) — intended for hot, short-lived data,
 * not durable caching (use lib/ai/cache.ts / Upstash for that).
 *
 * Source: odysseus task_scheduler.py shared-cache trick.
 */

interface Entry<T> {
  expires: number;
  inflight?: Promise<T>;
  value?: T;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Fetch-once helper. Key by (source, params). TTL in milliseconds.
 *
 *   const book = await singleflight(`binance:${symbol}`, 3000, () => fetchBook(symbol));
 *
 * Concurrent callers with the same key share one fetch; subsequent callers
 * within ttlMs get the cached value.
 */
export function singleflight<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;

  // Fresh cached value.
  if (existing && existing.value !== undefined && existing.expires > now) {
    return Promise.resolve(existing.value);
  }

  // A fetch is already in flight — join it.
  if (existing?.inflight) {
    return existing.inflight;
  }

  // Start a new fetch; record it so concurrent callers join.
  const inflight = (async () => {
    try {
      const value = await fetcher();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } catch (err) {
      store.delete(key); // don't cache failures
      throw err;
    }
  })();

  store.set(key, { expires: now + ttlMs, inflight });
  return inflight;
}

/** Manually drop a cached entry. */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Clear everything (useful in tests). */
export function clearAll(): void {
  store.clear();
}
