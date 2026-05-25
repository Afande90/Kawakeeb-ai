/**
 * POST /api/agents/[id]/tools  — attach a tool to this agent
 * Body: { tool_id: string }
 */

import type { NextRequest } from "next/server";
import { attachToolToAgent } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { tool_id } = await req.json();
    if (!tool_id) {
      return Response.json({ error: "tool_id is required" }, { status: 400 });
    }
    await attachToolToAgent(id, tool_id);
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
