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
  getModel,
  getNextAvailableModel,
  type ProviderId,
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

  const provider = agent.model_provider as ProviderId;
  let model: ReturnType<typeof getModel>;
  let usedProvider = provider;
  try {
    model = getModel(provider, agent.model_id);
  } catch {
    const next = await getNextAvailableModel("chat", {
      excludeProviders: [provider],
    });
    model = next.model;
    usedProvider = next.provider;
  }

  const tools = buildTools(agent.tools);
  const startedAt = Date.now();

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
  });

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
      if (cacheable && result.text) {
        await setCached(
          { prompt, system: systemPrompt, model: modelTag },
          {
            text: result.text,
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
    text: result.text || "(no response)",
    provider: usedProvider,
    agentName: agent.name,
  };
}
