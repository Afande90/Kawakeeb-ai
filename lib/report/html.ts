/**
 * Pattern 8 (Odysseus) — Visual report generator.
 *
 * Turns a markdown report + sources into a self-contained standalone HTML
 * document: auto table-of-contents from headings, dark/light via
 * prefers-color-scheme, collapsible sources, print/share toolbar, no remote
 * fonts or assets. One file you can open, print, or share.
 *
 * Source: odysseus visual_report.py.
 */

export interface ReportInput {
  markdown: string;
  sources?: { title: string; url: string }[];
  subtitle?: string;
  title: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Minimal markdown → HTML. Handles headings, bold, italic, inline code,
 * links, unordered/ordered lists, and paragraphs. Collects headings for TOC.
 */
function renderMarkdown(md: string): {
  html: string;
  toc: { level: number; text: string; id: string }[];
} {
  const lines = md.split("\n");
  const out: string[] = [];
  const toc: { level: number; text: string; id: string }[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const inline = (t: string): string =>
    escapeHtml(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
      );

  for (const line of lines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeLists();
      const level = h[1].length;
      const text = h[2].trim();
      const id = slugify(text);
      toc.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inUl) {
        closeLists();
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inOl) {
        closeLists();
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      closeLists();
      continue;
    }
    closeLists();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeLists();
  return { html: out.join("\n"), toc };
}

export function generateHtmlReport(input: ReportInput): string {
  const { html, toc } = renderMarkdown(input.markdown);

  const tocHtml = toc
    .filter((t) => t.level <= 3)
    .map(
      (t) =>
        `<a class="toc-l${t.level}" href="#${t.id}">${escapeHtml(t.text)}</a>`
    )
    .join("\n");

  const sourcesHtml = (input.sources ?? [])
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(
          s.title
        )}</a></li>`
    )
    .join("\n");

  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>
  :root {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #666; --border: #e2e2e2;
    --accent: #2563eb; --card: #f7f7f8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --fg: #e6e6e6; --muted: #9aa0a6; --border: #2a2d34;
      --accent: #6ea8fe; --card: #171a21;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    line-height: 1.6;
  }
  .toolbar {
    position: sticky; top: 0; background: var(--bg);
    border-bottom: 1px solid var(--border); padding: 12px 24px;
    display: flex; gap: 12px; align-items: center;
  }
  .toolbar h1 { font-size: 16px; margin: 0; flex: 1; }
  .toolbar button {
    background: var(--accent); color: #fff; border: 0; border-radius: 6px;
    padding: 6px 12px; cursor: pointer; font-size: 13px;
  }
  .layout { display: flex; max-width: 1100px; margin: 0 auto; }
  nav.toc {
    width: 240px; padding: 24px 16px; position: sticky; top: 57px;
    align-self: flex-start; max-height: calc(100vh - 57px); overflow-y: auto;
    border-right: 1px solid var(--border);
  }
  nav.toc a {
    display: block; color: var(--muted); text-decoration: none;
    padding: 3px 0; font-size: 13px;
  }
  nav.toc a:hover { color: var(--accent); }
  .toc-l2 { padding-left: 12px !important; }
  .toc-l3 { padding-left: 24px !important; font-size: 12px !important; }
  main { flex: 1; padding: 24px 32px; min-width: 0; }
  h1, h2, h3, h4 { line-height: 1.25; }
  code {
    background: var(--card); padding: 2px 5px; border-radius: 4px;
    font-family: ui-monospace, monospace; font-size: 0.9em;
  }
  a { color: var(--accent); }
  details {
    margin-top: 32px; border: 1px solid var(--border); border-radius: 8px;
    padding: 12px 16px; background: var(--card);
  }
  summary { cursor: pointer; font-weight: 600; }
  .meta { color: var(--muted); font-size: 13px; }
  @media print {
    .toolbar, nav.toc { display: none; }
    .layout { display: block; }
  }
  @media (max-width: 760px) { nav.toc { display: none; } }
</style>
</head>
<body>
  <div class="toolbar">
    <h1>${escapeHtml(input.title)}</h1>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="layout">
    <nav class="toc">${tocHtml}</nav>
    <main>
      ${input.subtitle ? `<p class="meta">${escapeHtml(input.subtitle)}</p>` : ""}
      <p class="meta">Generated ${generated} UTC · Kawakeeb AI</p>
      ${html}
      ${
        sourcesHtml
          ? `<details open><summary>Sources (${(input.sources ?? []).length})</summary><ol>${sourcesHtml}</ol></details>`
          : ""
      }
    </main>
  </div>
</body>
</html>`;
}
