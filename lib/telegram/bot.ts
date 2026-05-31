/**
 * Telegram bot core — stateless webhook handler.
 *
 * Flow:
 *  - /agents → list available agents + their commands
 *  - /triage, /jobs, etc. → switch the user's active agent (stored in Redis)
 *  - any text → run the active agent, reply with the result
 *
 * Per-user active agent lives in Redis keyed by chat id, so the bot is fully
 * stateless across serverless invocations.
 */

import "server-only";
import { Redis } from "@upstash/redis";
import { runAgent } from "@/lib/ai/run-agent";
import { getAgentByTelegramCommand, listAgents } from "@/lib/db/agents";

const TG_API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) {
    throw new Error("TELEGRAM_BOT_TOKEN not set");
  }
  return t;
}

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) {
    return redis;
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && tok)) {
    return null;
  }
  redis = new Redis({ url, token: tok });
  return redis;
}

const activeKey = (chatId: number | string) => `tg:active:${chatId}`;

async function getActiveAgentId(chatId: number): Promise<string | null> {
  const r = getRedis();
  if (!r) {
    return null;
  }
  return (await r.get<string>(activeKey(chatId))) ?? null;
}

async function setActiveAgentId(
  chatId: number,
  agentId: string
): Promise<void> {
  const r = getRedis();
  if (!r) {
    return;
  }
  await r.set(activeKey(chatId), agentId);
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  // Telegram caps messages at 4096 chars.
  const chunk = text.slice(0, 4000);
  await fetch(`${TG_API}/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: chunk }),
  });
}

async function sendTyping(chatId: number): Promise<void> {
  await fetch(`${TG_API}/bot${token()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
}

async function handleCommand(chatId: number, text: string): Promise<boolean> {
  const cmd = text.split(/\s+/)[0].toLowerCase();

  if (cmd === "/start" || cmd === "/help") {
    await sendMessage(
      chatId,
      "👋 Kawakeeb AI bot.\n\nCommands:\n/agents — list agents\n/<agent> — switch agent (e.g. /research)\n/status — show current agent\n\nThen just send a message to chat with the active agent."
    );
    return true;
  }

  if (cmd === "/agents") {
    const agents = await listAgents({ activeOnly: true });
    const lines = agents.map(
      (a) =>
        `${a.icon ?? "🤖"} ${a.name} — ${a.telegram_command ?? "(no command)"}`
    );
    await sendMessage(chatId, `Available agents:\n\n${lines.join("\n")}`);
    return true;
  }

  if (cmd === "/status") {
    const id = await getActiveAgentId(chatId);
    if (!id) {
      await sendMessage(chatId, "No agent selected. Use /agents to pick one.");
      return true;
    }
    const agents = await listAgents();
    const ag = agents.find((a) => a.id === id);
    await sendMessage(
      chatId,
      ag
        ? `Active agent: ${ag.icon ?? "🤖"} ${ag.name}`
        : "Active agent unknown."
    );
    return true;
  }

  const agent = await getAgentByTelegramCommand(cmd);
  if (agent) {
    await setActiveAgentId(chatId, agent.id);
    await sendMessage(
      chatId,
      `Switched to ${agent.icon ?? "🤖"} ${agent.name}. Send a message to begin.`
    );
    return true;
  }

  await sendMessage(chatId, `Unknown command: ${cmd}. Try /agents.`);
  return true;
}

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.text) {
    return;
  }
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (text.startsWith("/")) {
    await handleCommand(chatId, text);
    return;
  }

  const agentId = await getActiveAgentId(chatId);
  if (!agentId) {
    await sendMessage(
      chatId,
      "Pick an agent first with /agents, then send your message."
    );
    return;
  }

  await sendTyping(chatId);
  try {
    const result = await runAgent({
      agentId,
      prompt: text,
      source: "telegram",
    });
    await sendMessage(chatId, result.text);
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : "Unknown error";
    await sendMessage(chatId, `⚠️ Error: ${m}`);
  }
}
