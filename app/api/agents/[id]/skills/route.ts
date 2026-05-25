/**
 * POST /api/agents/[id]/skills  — attach a skill to this agent
 * Body: { skill_id: string }
 */

import type { NextRequest } from "next/server";
import { attachSkillToAgent } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { skill_id } = await req.json();
    if (!skill_id) {
      return Response.json({ error: "skill_id is required" }, { status: 400 });
    }
    await attachSkillToAgent(id, skill_id);
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
