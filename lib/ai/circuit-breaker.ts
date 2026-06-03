/**
 * Pattern 2 (Odysseus) — Dead-host circuit breaker.
 *
 * Counts consecutive failures per provider. After 3 strikes, the provider is
 * marked "open" (dead) for a cooldown window; during that window the rotation
 * skips it entirely and routes to a fallback. First success closes the breaker.
 *
 * This is the pattern that would have stopped a single dead provider
 * (Claude Code / OpenRouter outage) from taking the whole app down.
 *
 * Source: odysseus llm_core.py. In-memory Map keyed by provider id — per
 * server instance, which is the right scope for transient connect failures.
 */

import type { ProviderId } from "./multi-providers";

const FAILURE_THRESHOLD = 3; // consecutive failures before opening
const COOLDOWN_MS = 60_000; // 60s dead window

interface BreakerState {
  failures: number;
  openedAt: number | null; // timestamp when it tripped, else null
}

const breakers = new Map<ProviderId, BreakerState>();

function state(provider: ProviderId): BreakerState {
  let s = breakers.get(provider);
  if (!s) {
    s = { failures: 0, openedAt: null };
    breakers.set(provider, s);
  }
  return s;
}

/**
 * Is this provider currently usable? False while the breaker is open and the
 * cooldown hasn't elapsed. Auto-resets (half-open) once cooldown passes.
 */
export function isAvailable(provider: ProviderId): boolean {
  const s = state(provider);
  if (s.openedAt === null) {
    return true;
  }
  if (Date.now() - s.openedAt >= COOLDOWN_MS) {
    // Cooldown elapsed → half-open: allow one trial call.
    s.openedAt = null;
    s.failures = 0;
    return true;
  }
  return false;
}

/** Record a successful call — closes the breaker. */
export function recordSuccess(provider: ProviderId): void {
  const s = state(provider);
  s.failures = 0;
  s.openedAt = null;
}

/**
 * Record a failed call. On the 3rd consecutive failure, trips the breaker.
 * Returns true if this failure tripped/keeps the breaker open.
 */
export function recordFailure(provider: ProviderId): boolean {
  const s = state(provider);
  s.failures += 1;
  if (s.failures >= FAILURE_THRESHOLD) {
    s.openedAt = Date.now();
    return true;
  }
  return false;
}

/** Inspect breaker states (for the usage dashboard / debugging). */
export function getBreakerStates(): Array<{
  provider: ProviderId;
  failures: number;
  open: boolean;
  cooldownRemainingMs: number;
}> {
  const out: Array<{
    provider: ProviderId;
    failures: number;
    open: boolean;
    cooldownRemainingMs: number;
  }> = [];
  for (const [provider, s] of breakers.entries()) {
    const open = s.openedAt !== null && Date.now() - s.openedAt < COOLDOWN_MS;
    out.push({
      provider,
      failures: s.failures,
      open,
      cooldownRemainingMs:
        s.openedAt === null
          ? 0
          : Math.max(0, COOLDOWN_MS - (Date.now() - s.openedAt)),
    });
  }
  return out;
}
