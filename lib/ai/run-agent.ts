/**
 * Non-streaming agent runner — shared by Telegram, cron, and any caller that
 * wants a single complete reply instead of a stream.
 *
 * Loads the agent + skills/tools, picks an available provider (with fallback
 * rotation), generates one response, logs usage, and returns the text.
 */

import "server-only";
import { generateText } from "ai";
import { getAgentWithRelations, logUsage } from "@/lib/db/agents";
import { getCached, setCached } from "./cache";
import {
  type ProviderId,
  runWithFailover,
  trackUsage,
} from "./multi-providers";
import { buildSystemPrompt } from "./skill-loader";
import { buildTools } from "./tool-executor";

export interface RunAgentResult {
  agentName: string;
  provider: string;
  text: string;
}

export async function runAgent(opts: {
  agentId: string;
  prompt: string;
  source?: "cron" | "telegram" | "chat";
  useCache?: boolean;
}): Promise<RunAgentResult> {
  const { agentId, prompt, source = "telegram", useCache = true } = opts;

  const agent = await getAgentWithRelations(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }
  if (!agent.is_active) {
    throw new Error("Agent is disabled");
  }

  const systemPrompt = buildSystemPrompt(agent);
  const modelTag = `${agent.model_provider}:${agent.model_id}`;
  const cacheable = useCache && agent.tools.length === 0;

  if (cacheable) {
    const hit = await getCached({
      prompt,
      system: systemPrompt,
      model: modelTag,
    });
    if (hit) {
      return {
        text: hit.text,
        provider: `${hit.provider} (cached)`,
        agentName: agent.name,
      };
    }
  }

  const preferred = agent.model_provider as ProviderId;
  const tools = buildTools(agent.tools);
  const startedAt = Date.now();

  // Pattern 2: run with circuit-breaker-aware failover across providers.
  const { result, provider: usedProvider } = await runWithFailover(
    "chat",
    preferred,
    (model) =>
      generateText({
        model,
        system: systemPrompt,
        prompt,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
      })
  );

  // Pattern 5: if the cheap reply looks like a failure, escalate to a teacher
  // model and capture a reusable skill. Only for tool-free single-shot turns.
  let finalText = result.text;
  if (agent.tools.length === 0) {
    const { escalateIfFailed } = await import("./teacher");
    const t = await escalateIfFailed({
      prompt,
      system: systemPrompt,
      cheapReply: result.text,
      category: "general",
    });
    finalText = t.text;
  }

  // Log + cache without blocking the response.
  const logPromise = (async () => {
    try {
      await trackUsage(usedProvider);
      await logUsage({
        provider: usedProvider,
        model_id: agent.model_id,
        agent_id: agent.id,
        tokens_input: result.usage?.inputTokens ?? 0,
        tokens_output: result.usage?.outputTokens ?? 0,
        duration_ms: Date.now() - startedAt,
        status: "success",
        source,
      });
      if (cacheable && finalText) {
        await setCached(
          { prompt, system: systemPrompt, model: modelTag },
          {
            text: finalText,
            provider: usedProvider,
            modelId: agent.model_id,
          }
        );
      }
    } catch (err) {
      console.error("[run-agent] post-run logging failed:", err);
    }
  })();
  // Don't await — but keep a reference so it isn't GC'd prematurely.
  logPromise.catch(() => {
    // already handled inside
  });

  return {
    text: finalText || "(no response)",
    provider: usedProvider,
    agentName: agent.name,
  };
}
