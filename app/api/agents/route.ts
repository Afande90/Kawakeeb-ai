/**
 * GET  /api/agents       — list all agents (active only by default)
 * POST /api/agents       — create a new agent
 */

import type { NextRequest } from "next/server";
import { createAgent, listAgents } from "@/lib/db/agents";

export async function GET(req: NextRequest) {
  try {
    const includeInactive = req.nextUrl.searchParams.get("all") === "true";
    const agents = await listAgents({ activeOnly: !includeInactive });
    return Response.json({ agents });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.system_prompt) {
      return Response.json(
        { error: "name and system_prompt are required" },
        { status: 400 }
      );
    }
    const agent = await createAgent(body);
    return Response.json({ agent }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
