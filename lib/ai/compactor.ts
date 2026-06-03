/**
 * Pattern 4 (Odysseus) — Context compaction.
 *
 * When a thread approaches the model's context window, summarise the OLDEST
 * turns into a structured digest (User Goal / What Was Done / Current State /
 * Next Steps — preserving file paths + IDs) and replace them, keeping the most
 * recent turns verbatim.
 *
 * Source: odysseus context_compactor.py.
 */

import "server-only";
import { generateText, type ModelMessage } from "ai";
import { getNextAvailableModel } from "./multi-providers";

// Rough token estimate: ~4 chars/token. Good enough to decide when to compact.
function estimateTokens(messages: ModelMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    chars +=
      typeof m.content === "string"
        ? m.content.length
        : JSON.stringify(m.content).length;
  }
  return Math.ceil(chars / 4);
}

const COMPACT_PROMPT = `You are compacting an old portion of a conversation to
save context. Produce a tight structured summary with exactly these sections:

User Goal: (what the user is ultimately trying to achieve)
What Was Done: (key actions/results so far — preserve all file paths, IDs,
  numbers, and decisions verbatim)
Current State: (where things stand right now)
Next Steps: (what remains)

Be terse. Do not lose concrete identifiers. Output only the summary.`;

export interface CompactOptions {
  /** Model context window in tokens. */
  contextWindow?: number;
  /** Always keep this many most-recent messages verbatim. */
  keepRecent?: number;
  /** Compact when usage exceeds this fraction of the window. */
  threshold?: number;
}

/**
 * Returns a possibly-compacted message array. If under threshold, returns the
 * input unchanged. Otherwise summarises the oldest block and prepends it as a
 * single system message, keeping the recent tail verbatim.
 */
export async function compactIfNeeded(
  messages: ModelMessage[],
  opts: CompactOptions = {}
): Promise<{ messages: ModelMessage[]; compacted: boolean }> {
  const contextWindow = opts.contextWindow ?? 128_000;
  const threshold = opts.threshold ?? 0.85;
  const keepRecent = opts.keepRecent ?? 8;

  const tokens = estimateTokens(messages);
  if (tokens < contextWindow * threshold || messages.length <= keepRecent + 2) {
    return { messages, compacted: false };
  }

  const head = messages.slice(0, messages.length - keepRecent);
  const tail = messages.slice(messages.length - keepRecent);

  const transcript = head
    .map((m) => {
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role.toUpperCase()}: ${content}`;
    })
    .join("\n\n");

  try {
    const { model } = await getNextAvailableModel("fast");
    const { text } = await generateText({
      model,
      system: COMPACT_PROMPT,
      prompt: transcript,
    });

    const summaryMessage: ModelMessage = {
      role: "system",
      content: `[Earlier conversation, summarised]\n${text}`,
    };
    return { messages: [summaryMessage, ...tail], compacted: true };
  } catch (err) {
    console.error("[compactor] failed, returning original:", err);
    return { messages, compacted: false };
  }
}
