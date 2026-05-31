/**
 * Cron jobs page — schedule recurring agent tasks.
 * NOTE: this manages job definitions. Actual execution wiring (GitHub
 * Actions dispatch) is a follow-up (see BACKLOG.md). Jobs created here are
 * stored and toggleable; the runner is added in a later step.
 */

import { connection } from "next/server";
import { listAgents, listCronJobs } from "@/lib/db/agents";
import { CronManager } from "./cron-manager";

export default async function CronPage() {
  await connection();
  let jobs: Awaited<ReturnType<typeof listCronJobs>> = [];
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let error: string | null = null;
  try {
    [jobs, agents] = await Promise.all([
      listCronJobs(),
      listAgents({ activeOnly: false }),
    ]);
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 font-mono text-destructive text-sm">
        {error}
      </div>
    );
  }

  return <CronManager agents={agents} initialJobs={jobs} />;
}
