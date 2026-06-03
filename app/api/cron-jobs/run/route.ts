/**
 * Cron runner — executes due scheduled jobs.
 *
 * GET/POST /api/cron-jobs/run
 *   Header: Authorization: Bearer <CRON_SECRET>   (or ?secret=... query param)
 *
 * Called on a schedule by GitHub Actions (.github/workflows/cron.yml).
 * Loads all enabled jobs, runs the ones whose cron expression matches the
 * current minute, records last_run/last_status, and (optionally) pushes the
 * result to Telegram if CRON_TELEGRAM_CHAT_ID is set.
 *
 * Pass ?force=<jobId> to run one job immediately regardless of schedule
 * (used by the "Run now" button in the admin UI).
 */

import type { NextRequest } from "next/server";
import { runAgent } from "@/lib/ai/run-agent";
import { cronMatches } from "@/lib/cron/matcher";
import { listCronJobs, updateCronJob } from "@/lib/db/agents";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured → allow (dev convenience). Set CRON_SECRET in prod.
    return true;
  }
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) {
    return true;
  }
  return req.nextUrl.searchParams.get("secret") === secret;
}

async function maybeNotifyTelegram(text: string): Promise<void> {
  const chatId = process.env.CRON_TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!(chatId && token)) {
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    });
  } catch (err) {
    console.error("[cron] telegram notify failed:", err);
  }
}

export function POST(req: NextRequest) {
  return handle(req);
}
export function GET(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force");
  const now = new Date();

  let jobs: Awaited<ReturnType<typeof listCronJobs>>;
  try {
    jobs = await listCronJobs(force ? {} : { enabledOnly: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const due = force
    ? jobs.filter((j) => j.id === force)
    : jobs.filter((j) => cronMatches(j.schedule, now));

  const results: Array<{
    id: string;
    name: string;
    status: "success" | "error" | "skipped";
    detail?: string;
  }> = [];

  for (const job of due) {
    if (!job.agent_id) {
      results.push({
        id: job.id,
        name: job.name,
        status: "skipped",
        detail: "no agent assigned",
      });
      continue;
    }
    try {
      const out = await runAgent({
        agentId: job.agent_id,
        prompt: job.instructions,
        source: "cron",
        useCache: false,
      });
      await updateCronJob(job.id, {
        last_run: new Date().toISOString(),
        last_status: "success",
      });
      results.push({ id: job.id, name: job.name, status: "success" });
      await maybeNotifyTelegram(
        `⏰ ${job.name} (${out.agentName})\n\n${out.text}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await updateCronJob(job.id, {
        last_run: new Date().toISOString(),
        last_status: `error: ${msg}`,
      });
      results.push({
        id: job.id,
        name: job.name,
        status: "error",
        detail: msg,
      });
    }
  }

  return Response.json({
    ran: results.length,
    checkedAt: now.toISOString(),
    results,
  });
}
