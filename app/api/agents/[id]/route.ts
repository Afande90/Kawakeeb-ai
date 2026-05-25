/**
 * GET    /api/agents/[id]  — fetch an agent with all its relations (tools, skills, knowledge, starters)
 * PUT    /api/agents/[id]  — update agent fields
 * DELETE /api/agents/[id]  — delete an agent (cascades to attachments)
 */

import type { NextRequest } from "next/server";
import {
  deleteAgent,
  getAgentWithRelations,
  updateAgent,
} from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const agent = await getAgentWithRelations(id);
    if (!agent) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ agent });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const agent = await updateAgent(id, body);
    return Response.json({ agent });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    await deleteAgent(id);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
