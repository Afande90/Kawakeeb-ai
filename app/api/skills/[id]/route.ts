/**
 * GET    /api/skills/[id]  — fetch one skill
 * PUT    /api/skills/[id]  — update
 * DELETE /api/skills/[id]  — delete
 */

import type { NextRequest } from "next/server";
import { deleteSkill, getSkill, updateSkill } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const skill = await getSkill(id);
    if (!skill) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ skill });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const skill = await updateSkill(id, body);
    return Response.json({ skill });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    await deleteSkill(id);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
