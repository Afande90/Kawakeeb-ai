/**
 * DELETE /api/agents/[id]/skills/[skillId]  — detach a skill from this agent
 */

import type { NextRequest } from "next/server";
import { detachSkillFromAgent } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string; skillId: string }>;
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id, skillId } = await ctx.params;
    await detachSkillFromAgent(id, skillId);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
