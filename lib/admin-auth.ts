/**
 * Minimal admin gate. A single password (ADMIN_PASSWORD env) protects /admin
 * and the agent management APIs. On success we set a cookie whose value is an
 * HMAC of the password — so the raw password is never stored in the cookie and
 * the cookie can't be forged without AUTH_SECRET.
 *
 * If ADMIN_PASSWORD is unset, the gate is OPEN (dev convenience). Set it before
 * any public deploy.
 *
 * Edge-runtime safe: uses Web Crypto (crypto.subtle), no Node APIs.
 */

export const ADMIN_COOKIE = "kawakeeb_admin";

async function hmac(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The expected cookie value for the configured password. */
export function expectedToken(): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    return Promise.resolve(null); // gate disabled
  }
  const secret = process.env.AUTH_SECRET ?? "kawakeeb-fallback-secret";
  return hmac(pw, secret);
}

/** True if no password is configured (gate open). */
export function gateDisabled(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

/** Verify a submitted password and return the cookie value to set. */
export function verifyPassword(input: string): Promise<string | null> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || input !== pw) {
    return Promise.resolve(null);
  }
  const secret = process.env.AUTH_SECRET ?? "kawakeeb-fallback-secret";
  return hmac(pw, secret);
}

/** Check whether a request's cookie value is valid. */
export async function cookieIsValid(
  cookieValue: string | undefined
): Promise<boolean> {
  if (gateDisabled()) {
    return true;
  }
  if (!cookieValue) {
    return false;
  }
  const expected = await expectedToken();
  return cookieValue === expected;
}
