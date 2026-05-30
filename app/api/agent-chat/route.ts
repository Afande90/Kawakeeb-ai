/**
 * Dynamic agent chat route.
 *
 * POST /api/agent-chat
 * Body: { agentId: string, messages: UIMessage[], cache?: boolean }
 *
 * Loads the agent + its skills/tools/knowledge from Supabase, picks an
 * available LLM via rate-limit-aware rotation, streams the response, and
 * logs usage. This route is INDEPENDENT of the template's /api/chat — it
 * doesn't touch chat history or auth, so it's safe to develop in parallel.
 */

import { convertToModelMessages, streamText, type UIMessage } from "ai";
import type { NextRequest } from "next/server";
import {
  getCached,
  recordCacheHit,
  recordCacheMiss,
  setCached,
} from "@/lib/ai/cache";
import {
  getModel,
  type ProviderId,
  trackUsage,
} from "@/lib/ai/multi-providers";
import { buildSystemPrompt } from "@/lib/ai/skill-loader";
import { buildTools } from "@/lib/ai/tool-executor";
import { getAgentWithRelations, logUsage } from "@/lib/db/agents";

export const maxDuration = 60; // seconds — bumped from default 10s for tool use

interface ChatRequest {
  agentId: string;
  /** Skip cache lookup. Defaults to true (cache on) for non-cron requests. */
  cache?: boolean;
  messages: UIMessage[];
  /** Source tag for usage logs. */
  source?: "chat" | "cron" | "telegram";
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agentId, messages, cache: useCache = true, source = "chat" } = body;

  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "messages must be a non-empty array" },
      { status: 400 }
    );
  }

  // ─── Load agent with relations ─────────────────────────────────
  const agent = await getAgentWithRelations(agentId);
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }
  if (!agent.is_active) {
    return Response.json({ error: "Agent is disabled" }, { status: 403 });
  }

  const systemPrompt = buildSystemPrompt(agent);

  // ─── Cache check (only for simple turns: no tool calls in history) ───
  // We don't cache multi-turn tool conversations because each step has
  // different state. Single user message → assistant text is a fair hit.
  const lastUserText = extractLastUserText(messages);
  const cacheable =
    useCache &&
    agent.tools.length === 0 &&
    messages.length === 1 &&
    lastUserText !== null;

  // Only short-circuit the cache for non-interactive callers (cron/telegram).
  // The chat UI always gets a real streamed response so the UI-message
  // protocol stays intact.
  if (cacheable && source !== "chat" && lastUserText) {
    const hit = await getCached({
      prompt: lastUserText,
      system: systemPrompt,
      model: `${agent.model_provider}:${agent.model_id}`,
    });
    if (hit) {
      await recordCacheHit();
      // Return a text/event-stream-shaped response that mimics streaming.
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`0:${JSON.stringify(hit.text)}\n`)
            );
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    await recordCacheMiss();
  }

  // ─── Get a model. Try agent's configured provider first; fall back. ──
  const provider = agent.model_provider as ProviderId;
  let model: ReturnType<typeof getModel>;
  let usedProvider = provider;
  try {
    model = getModel(provider, agent.model_id);
  } catch {
    // Provider not configured (no API key). Fall through to rotation.
    const { getNextAvailableModel } = await import("@/lib/ai/multi-providers");
    const next = await getNextAvailableModel("chat", {
      excludeProviders: [provider],
    });
    model = next.model;
    usedProvider = next.provider;
  }

  // ─── Build tools from DB ───────────────────────────────────────
  const tools = buildTools(agent.tools);

  // ─── Stream the response ──────────────────────────────────────
  const startedAt = Date.now();

  // convertToModelMessages may return a Promise in this SDK version — await it.
  const modelMessages = await convertToModelMessages(messages);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      onFinish: async (event) => {
        try {
          await trackUsage(usedProvider);
          await logUsage({
            provider: usedProvider,
            model_id: agent.model_id,
            agent_id: agent.id,
            tokens_input: event.usage?.inputTokens ?? 0,
            tokens_output: event.usage?.outputTokens ?? 0,
            duration_ms: Date.now() - startedAt,
            status: "success",
            source,
          });

          // Save to cache if cacheable
          if (cacheable && lastUserText && event.text) {
            await setCached(
              {
                prompt: lastUserText,
                system: systemPrompt,
                model: `${agent.model_provider}:${agent.model_id}`,
              },
              {
                text: event.text,
                provider: usedProvider,
                modelId: agent.model_id,
              }
            );
          }
        } catch (err) {
          console.error("[agent-chat] post-stream logging failed:", err);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent-chat] streamText failed:", err);
    return Response.json({ error: `LLM call failed: ${msg}` }, { status: 500 });
  }
}

/** Extract plain text from the last user message in a UIMessage[] history. */
function extractLastUserText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") {
      continue;
    }
    const parts = m.parts ?? [];
    const text = parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}
