/**
 * Pattern 6 (Odysseus) — Deep research loop.
 *
 *   plan → (query → search → fetch → extract goal-relevant facts → fold into
 *   an evolving report → decide continue/stop) → final report
 *
 * Bounds: min 2 rounds, max 8, max-empty-rounds (stop if 2 rounds add
 * nothing). Goal-based extraction caps chars per page to protect token budget.
 *
 * Source: odysseus deep_research.py. Uses our provider rotation + the Brave
 * Search API (BRAVE_SEARCH_API_KEY) for web search.
 */

import "server-only";
import { generateText } from "ai";
import { getNextAvailableModel } from "./multi-providers";
import { singleflight } from "./singleflight";

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 8;
const MAX_EMPTY_ROUNDS = 2;
const MAX_CHARS_PER_PAGE = 15_000;
const PAGES_PER_ROUND = 3;

export interface ResearchProgress {
  round: number;
  status: string;
}

export interface ResearchResult {
  plan: string;
  question: string;
  report: string; // markdown
  rounds: number;
  sources: { title: string; url: string }[];
}

interface BraveResult {
  description?: string;
  title: string;
  url: string;
}

async function braveSearch(query: string): Promise<BraveResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return [];
  }
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
    query
  )}&count=5`;
  try {
    const res = await fetch(url, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
    });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as {
      web?: { results?: BraveResult[] };
    };
    return data.web?.results ?? [];
  } catch {
    return [];
  }
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (KawakeebResearchBot)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return "";
    }
    const html = await res.text();
    // Crude text extraction: strip tags + scripts/styles.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, MAX_CHARS_PER_PAGE);
  } catch {
    return "";
  }
}

/**
 * Run the full deep-research loop for a question.
 * `onProgress` is optional and lets a caller stream status updates.
 */
export async function deepResearch(
  question: string,
  onProgress?: (p: ResearchProgress) => void
): Promise<ResearchResult> {
  const progress = (round: number, status: string) =>
    onProgress?.({ round, status });

  // ─── 1. Plan ───
  progress(0, "Planning research");
  const { model } = await getNextAvailableModel("reasoning");
  const planRes = await generateText({
    model,
    system:
      "You are a research planner. Turn the user's question into a short " +
      "research plan: list the 3-5 sub-questions that matter and what to look " +
      "for. Be concise.",
    prompt: question,
  });
  const plan = planRes.text;

  let report = `# Research: ${question}\n\n`;
  const sources: { title: string; url: string }[] = [];
  const seenUrls = new Set<string>();
  let emptyRounds = 0;
  let round = 0;

  while (round < MAX_ROUNDS) {
    round += 1;
    progress(round, "Generating queries");

    // ─── 2. Generate queries ───
    const { model: qModel } = await getNextAvailableModel("fast");
    const qRes = await generateText({
      model: qModel,
      system:
        "Given the research plan and the report so far, output 1-3 web search " +
        "queries (one per line, no numbering) that would fill the biggest gaps. " +
        "Only the queries.",
      prompt: `PLAN:\n${plan}\n\nREPORT SO FAR:\n${report}`,
    });
    const queries = qRes.text
      .split("\n")
      .map((q) => q.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    // ─── 3. Search + fetch + extract ───
    progress(round, "Searching and reading");
    let roundFacts = "";
    for (const query of queries) {
      // Pattern 7: dedupe identical searches across rounds for 60s.
      const results = await singleflight(`brave:${query}`, 60_000, () =>
        braveSearch(query)
      );
      for (const r of results.slice(0, PAGES_PER_ROUND)) {
        if (seenUrls.has(r.url)) {
          continue;
        }
        seenUrls.add(r.url);
        const pageText = await fetchPageText(r.url);
        if (!pageText) {
          continue;
        }
        const { model: exModel } = await getNextAvailableModel("fast");
        const exRes = await generateText({
          model: exModel,
          system:
            "Extract ONLY facts relevant to the research goal from this page. " +
            "Bullet points, with numbers/specifics. If nothing relevant, reply " +
            "'NONE'.",
          prompt: `GOAL: ${question}\n\nPAGE (${r.title}):\n${pageText}`,
        });
        if (exRes.text.trim() && !exRes.text.trim().startsWith("NONE")) {
          roundFacts += `\n### From: ${r.title}\n${exRes.text}\n`;
          sources.push({ title: r.title, url: r.url });
        }
      }
    }

    // ─── 4. Fold into report ───
    if (roundFacts.trim()) {
      progress(round, "Updating report");
      const { model: synthModel } = await getNextAvailableModel("reasoning");
      const synthRes = await generateText({
        model: synthModel,
        system:
          "Fold the new facts into the evolving research report. Keep it " +
          "well-structured markdown with clear sections. Don't repeat. " +
          "Output the full updated report.",
        prompt: `CURRENT REPORT:\n${report}\n\nNEW FACTS:\n${roundFacts}`,
      });
      report = synthRes.text;
      emptyRounds = 0;
    } else {
      emptyRounds += 1;
    }

    // ─── 5. Decide stop ───
    if (round >= MIN_ROUNDS && emptyRounds >= MAX_EMPTY_ROUNDS) {
      break;
    }
    if (round >= MIN_ROUNDS) {
      const { model: decModel } = await getNextAvailableModel("fast");
      const decRes = await generateText({
        model: decModel,
        system:
          "Based on the report and the original question, is the research " +
          "sufficiently complete? Answer only STOP or CONTINUE.",
        prompt: `QUESTION: ${question}\n\nREPORT:\n${report}`,
      });
      if (decRes.text.trim().toUpperCase().startsWith("STOP")) {
        break;
      }
    }
  }

  // Dedupe sources.
  const uniqueSources = Array.from(
    new Map(sources.map((s) => [s.url, s])).values()
  );

  return { question, plan, report, sources: uniqueSources, rounds: round };
}
