/**
 * GET  /api/skills        — list all skills (optionally filter by category)
 * POST /api/skills        — create a new skill
 */

import type { NextRequest } from "next/server";
import { createSkill, listSkills } from "@/lib/db/agents";

export async function GET(req: NextRequest) {
  try {
    const includeInactive = req.nextUrl.searchParams.get("all") === "true";
    const category = req.nextUrl.searchParams.get("category") ?? undefined;
    const skills = await listSkills({
      activeOnly: !includeInactive,
      category,
    });
    return Response.json({ skills });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!(body.name && body.content)) {
      return Response.json(
        { error: "name and content are required" },
        { status: 400 }
      );
    }
    const skill = await createSkill(body);
    return Response.json({ skill }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
