/**
 * Convert database-defined tools (webhook / CLI / internal) into Vercel AI SDK
 * tool definitions that the LLM can call during a chat turn.
 *
 * Webhook tools  → fetch the URL with the LLM's arguments
 * CLI tools      → execute a shell command (Manim, Edge TTS, etc.)
 * Internal tools → call a registered handler function
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "ai";
import { type ZodTypeAny, z } from "zod";
import type { Tool, ToolParameter } from "@/lib/db/agent-types";

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════
// Internal tool registry — for tools that need Node code, not HTTP/CLI.
// Register handlers from feature modules (image gen, video assembly, etc.).
// ═══════════════════════════════════════════════════════════════

type InternalHandler = (args: Record<string, unknown>) => Promise<unknown>;
const internalHandlers = new Map<string, InternalHandler>();

export function registerInternalTool(name: string, handler: InternalHandler) {
  internalHandlers.set(name, handler);
}

// ═══════════════════════════════════════════════════════════════
// Parameter conversion: our DB schema → Zod schema for the AI SDK
// ═══════════════════════════════════════════════════════════════

function paramToZod(p: ToolParameter): ZodTypeAny {
  let base: ZodTypeAny;
  switch (p.type) {
    case "integer":
    case "number":
      base = z.number();
      break;
    case "boolean":
      base = z.boolean();
      break;
    case "array":
      base = z.array(z.any());
      break;
    case "object":
      base = z.record(z.any());
      break;
    default:
      base = z.string();
      break;
  }
  base = base.describe(p.description);
  return p.required ? base : base.optional();
}

function buildSchema(params: ToolParameter[]) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const p of params) {
    shape[p.name] = paramToZod(p);
  }
  return z.object(shape);
}

// ═══════════════════════════════════════════════════════════════
// Tool executors
// ═══════════════════════════════════════════════════════════════

async function callWebhook(
  t: Tool,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!t.webhook_url) {
    throw new Error(`Tool ${t.name} has no webhook_url`);
  }

  const method = (t.http_method || "POST").toUpperCase();
  let url = t.webhook_url;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...t.headers,
    },
  };

  if (method === "GET") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(args)) {
      if (v != null) {
        params.append(k, String(v));
      }
    }
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${params.toString()}`;
  } else {
    init.body = JSON.stringify(args);
  }

  const resp = await fetch(url, init);
  if (!resp.ok) {
    throw new Error(
      `Webhook ${t.name} failed: ${resp.status} ${resp.statusText}`
    );
  }
  const ct = resp.headers.get("content-type") || "";
  return ct.includes("application/json")
    ? await resp.json()
    : await resp.text();
}

async function callCli(
  t: Tool,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!t.cli_command) {
    throw new Error(`Tool ${t.name} has no cli_command`);
  }

  // Replace {{arg}} placeholders with actual values. Quote everything to
  // avoid shell injection from LLM-provided arguments.
  let cmd = t.cli_command;
  for (const [k, v] of Object.entries(args)) {
    const safe = String(v).replace(/"/g, '\\"');
    cmd = cmd.replaceAll(`{{${k}}}`, `"${safe}"`);
  }

  const { stdout, stderr } = await execAsync(cmd, {
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout, stderr };
}

async function callInternal(
  t: Tool,
  args: Record<string, unknown>
): Promise<unknown> {
  let handler = internalHandlers.get(t.name);
  if (!handler) {
    // Lazily register the built-in web tools (web_search, fetch_url) the
    // first time one is invoked, avoiding a circular import at module load.
    const { registerWebTools } = await import("./web-tools");
    registerWebTools();
    handler = internalHandlers.get(t.name);
  }
  if (!handler) {
    throw new Error(`No internal handler registered for ${t.name}`);
  }
  return handler(args);
}

// ═══════════════════════════════════════════════════════════════
// Main export: convert DB tools → AI SDK tool definitions
// ═══════════════════════════════════════════════════════════════

export function buildTools(
  dbTools: Tool[]
): Record<string, ReturnType<typeof tool>> {
  const result: Record<string, ReturnType<typeof tool>> = {};

  for (const t of dbTools) {
    result[t.name] = tool({
      description: t.description,
      inputSchema: buildSchema(t.parameters),
      execute: async (args: Record<string, unknown>) => {
        try {
          switch (t.tool_type) {
            case "webhook":
              return await callWebhook(t, args);
            case "cli":
              return await callCli(t, args);
            case "internal":
              return await callInternal(t, args);
            default:
              throw new Error(`Unknown tool_type: ${t.tool_type}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { error: msg };
        }
      },
    });
  }

  return result;
}
