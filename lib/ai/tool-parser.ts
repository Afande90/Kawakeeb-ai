/**
 * Pattern 3 (Odysseus) — Multi-format tool-call parser.
 *
 * Different models emit tool calls in different shapes. Before trusting only
 * the SDK's native tool-call objects, also scan the raw text for:
 *   - fenced ```tool ... ``` blocks (JSON inside)
 *   - [TOOL_CALL]{...} inline markers
 *   - MiniMax-style XML: <invoke name="x"><parameter name="y">v</parameter></invoke>
 *
 * All normalised into one shape: { tool, args }.
 *
 * Source: odysseus tool_parsing.py.
 */

export interface ParsedToolCall {
  args: Record<string, unknown>;
  tool: string;
}

/** Try to JSON.parse, returning {} on failure. */
function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v !== null
      ? (v as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** ```tool ... ``` or ```tool_call ... ``` fenced blocks. */
function parseFenced(text: string): ParsedToolCall[] {
  const out: ParsedToolCall[] = [];
  const re = /```(?:tool|tool_call)\s*\n([\s\S]*?)```/gi;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const obj = safeJson(m[1].trim());
    const tool = (obj.tool ?? obj.name) as string | undefined;
    if (tool) {
      out.push({
        tool,
        args: (obj.args ?? obj.arguments ?? obj.parameters ?? {}) as Record<
          string,
          unknown
        >,
      });
    }
    m = re.exec(text);
  }
  return out;
}

/** [TOOL_CALL]{ "tool": "...", "args": {...} } */
function parseBracket(text: string): ParsedToolCall[] {
  const out: ParsedToolCall[] = [];
  const re = /\[TOOL_CALL\]\s*(\{[\s\S]*?\})/gi;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const obj = safeJson(m[1]);
    const tool = (obj.tool ?? obj.name) as string | undefined;
    if (tool) {
      out.push({
        tool,
        args: (obj.args ?? obj.arguments ?? {}) as Record<string, unknown>,
      });
    }
    m = re.exec(text);
  }
  return out;
}

/**
 * MiniMax / Anthropic-style XML:
 * <invoke name="search"><parameter name="q">coffee</parameter></invoke>
 */
function parseXml(text: string): ParsedToolCall[] {
  const out: ParsedToolCall[] = [];
  const invokeRe = /<invoke\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/invoke>/gi;
  let m: RegExpExecArray | null = invokeRe.exec(text);
  while (m !== null) {
    const tool = m[1];
    const inner = m[2];
    const args: Record<string, unknown> = {};
    const paramRe =
      /<parameter\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/parameter>/gi;
    let p: RegExpExecArray | null = paramRe.exec(inner);
    while (p !== null) {
      args[p[1]] = p[2].trim();
      p = paramRe.exec(inner);
    }
    out.push({ tool, args });
    m = invokeRe.exec(text);
  }
  return out;
}

/**
 * Parse all tool calls found in a model's raw text reply, in any supported
 * format. Returns a de-duplicated list (by tool + JSON args).
 */
export function parseToolCalls(text: string): ParsedToolCall[] {
  if (!text) {
    return [];
  }
  const all = [...parseFenced(text), ...parseBracket(text), ...parseXml(text)];
  const seen = new Set<string>();
  const unique: ParsedToolCall[] = [];
  for (const call of all) {
    const key = `${call.tool}:${JSON.stringify(call.args)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(call);
    }
  }
  return unique;
}

/** True if the text contains at least one parseable tool call. */
export function hasToolCall(text: string): boolean {
  return parseToolCalls(text).length > 0;
}
