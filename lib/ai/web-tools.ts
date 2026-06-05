/**
 * Native web tools for agents — lightweight alternative to a full browser
 * (Webwright/Playwright) that runs fine on low-end hardware and serverless.
 *
 *   web_search  → Brave Search API, returns top results (title/url/snippet)
 *   fetch_url   → fetch a page, strip to readable text (capped)
 *
 * These are registered as INTERNAL tools (see tool-executor's registry) so any
 * agent can be given web access from the admin Tools page. For true clicking/
 * form-filling automation, the heavier Webwright path stays in BACKLOG.
 */

import "server-only";
import { singleflight } from "./singleflight";
import { registerInternalTool } from "./tool-executor";

const MAX_PAGE_CHARS = 12_000;

interface BraveWebResult {
  description?: string;
  title: string;
  url: string;
}

async function braveSearch(
  query: string,
  count = 5
): Promise<BraveWebResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return [];
  }
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
    query
  )}&count=${count}`;
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": key, Accept: "application/json" },
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as {
    web?: { results?: BraveWebResult[] };
  };
  return data.web?.results ?? [];
}

async function fetchReadable(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (KawakeebWebBot)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    return `Failed to fetch ${url}: HTTP ${res.status}`;
  }
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_PAGE_CHARS) || "(no readable text found)";
}

let registered = false;

/**
 * Register the web tools' internal handlers. Call once at server start (or
 * lazily before building tools). Idempotent.
 */
export function registerWebTools(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerInternalTool("web_search", async (args) => {
    const query = String(args.query ?? "").trim();
    if (!query) {
      return { error: "query is required" };
    }
    const count = Math.min(Number(args.count ?? 5) || 5, 10);
    const results = await singleflight(
      `websearch:${query}:${count}`,
      60_000,
      () => braveSearch(query, count)
    );
    if (results.length === 0) {
      return {
        results: [],
        note: "No results (BRAVE_SEARCH_API_KEY may be unset).",
      };
    }
    return {
      results: results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description ?? "",
      })),
    };
  });

  registerInternalTool("fetch_url", async (args) => {
    const url = String(args.url ?? "").trim();
    if (!/^https?:\/\//.test(url)) {
      return { error: "A valid http(s) url is required" };
    }
    try {
      const text = await singleflight(`fetchurl:${url}`, 120_000, () =>
        fetchReadable(url)
      );
      return { url, text };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "fetch failed";
      return { error: msg };
    }
  });
}
