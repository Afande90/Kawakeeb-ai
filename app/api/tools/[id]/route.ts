/**
 * GET    /api/tools/[id]  — fetch one tool
 * PUT    /api/tools/[id]  — update
 * DELETE /api/tools/[id]  — delete
 */

import type { NextRequest } from "next/server";
import { deleteTool, getTool, updateTool } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const tool = await getTool(id);
    if (!tool) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ tool });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const tool = await updateTool(id, body);
    return Response.json({ tool });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    await deleteTool(id);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
