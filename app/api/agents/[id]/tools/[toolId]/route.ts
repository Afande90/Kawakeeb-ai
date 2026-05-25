/**
 * DELETE /api/agents/[id]/tools/[toolId]  — detach a tool from this agent
 */

import type { NextRequest } from "next/server";
import { detachToolFromAgent } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string; toolId: string }>;
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id, toolId } = await ctx.params;
    await detachToolFromAgent(id, toolId);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
