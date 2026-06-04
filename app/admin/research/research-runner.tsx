"use client";

/**
 * Deep-research runner UI. Enter a question, run the multi-round research
 * loop, view the report, and open/download the standalone HTML report.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ResearchResult {
  plan: string;
  question: string;
  report: string;
  rounds: number;
  sources: { title: string; url: string }[];
}

export function ResearchRunner() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!question.trim() || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, format: "json" }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error ?? "Research failed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function openHtmlReport() {
    // Re-run as HTML and open in a new tab.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/research";
    form.target = "_blank";
    // Can't send JSON via form; use fetch + blob instead.
    fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, format: "html" }),
    })
      .then((r) => r.text())
      .then((html) => {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-bold text-3xl tracking-tight">Deep Research</h1>
        <p className="mt-1 text-muted-foreground">
          Multi-round web research → sourced report. Needs BRAVE_SEARCH_API_KEY.
        </p>
      </header>

      <div className="space-y-3 rounded-lg border bg-card p-6">
        <Textarea
          className="min-h-[80px]"
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Is there demand for Patient Care Coordinators in Abu Dhabi private hospitals in 2026?"
          value={question}
        />
        <div className="flex justify-end">
          <Button disabled={loading || !question.trim()} onClick={run}>
            {loading ? "Researching… (up to a few minutes)" : "Run research"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {result.rounds} rounds · {result.sources.length} sources
            </p>
            <Button onClick={openHtmlReport} size="sm" variant="outline">
              Open HTML report
            </Button>
          </div>
          <article className="prose-sm max-w-none whitespace-pre-wrap rounded-lg border bg-card p-6 text-sm">
            {result.report}
          </article>
          {result.sources.length > 0 && (
            <details className="rounded-lg border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">
                Sources ({result.sources.length})
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {result.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      className="text-primary underline"
                      href={s.url}
                      rel="noopener"
                      target="_blank"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
