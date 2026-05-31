/**
 * GET  /api/cron-jobs  — list all scheduled jobs
 * POST /api/cron-jobs  — create a job
 */

import type { NextRequest } from "next/server";
import { createCronJob, listCronJobs } from "@/lib/db/agents";

export async function GET() {
  try {
    const jobs = await listCronJobs();
    return Response.json({ jobs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!(body.name && body.schedule && body.instructions)) {
      return Response.json(
        { error: "name, schedule, and instructions are required" },
        { status: 400 }
      );
    }
    const job = await createCronJob(body);
    return Response.json({ job }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
