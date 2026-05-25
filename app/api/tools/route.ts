/**
 * GET  /api/tools   — list all tools
 * POST /api/tools   — create a new tool
 */

import type { NextRequest } from "next/server";
import { createTool, listTools } from "@/lib/db/agents";

export async function GET(req: NextRequest) {
  try {
    const includeInactive = req.nextUrl.searchParams.get("all") === "true";
    const tools = await listTools({ activeOnly: !includeInactive });
    return Response.json({ tools });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!(body.name && body.description && body.tool_type)) {
      return Response.json(
        { error: "name, description, and tool_type are required" },
        { status: 400 }
      );
    }
    const tool = await createTool(body);
    return Response.json({ tool }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
