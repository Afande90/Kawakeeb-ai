/**
 * PUT    /api/cron-jobs/[id]  — update (toggle enabled, edit fields)
 * DELETE /api/cron-jobs/[id]  — delete
 */

import type { NextRequest } from "next/server";
import { deleteCronJob, updateCronJob } from "@/lib/db/agents";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const job = await updateCronJob(id, body);
    return Response.json({ job });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    await deleteCronJob(id);
    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
