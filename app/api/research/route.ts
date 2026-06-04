/**
 * POST /api/research
 *   body: { question: string, format?: "json" | "html" }
 *
 * Runs the deep-research loop (Pattern 6) and returns either the structured
 * JSON result or a standalone HTML report (Pattern 8).
 *
 * Requires BRAVE_SEARCH_API_KEY for web search; without it the loop still runs
 * but finds no sources (returns plan + empty report).
 */

import type { NextRequest } from "next/server";
import { deepResearch } from "@/lib/ai/deep-research";
import { generateHtmlReport } from "@/lib/report/html";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { question?: string; format?: "json" | "html" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const result = await deepResearch(question);

    if (body.format === "html") {
      const html = generateHtmlReport({
        title: result.question,
        subtitle: `${result.rounds} research rounds · ${result.sources.length} sources`,
        markdown: result.report,
        sources: result.sources,
      });
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return Response.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
