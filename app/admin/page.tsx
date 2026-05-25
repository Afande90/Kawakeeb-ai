/**
 * Admin overview — quick counts and shortcuts.
 */

import Link from "next/link";
import { listAgents, listSkills, listTools } from "@/lib/db/agents";

export default async function AdminOverviewPage() {
  // Fail-soft: if Supabase isn't configured yet, show zeros instead of crashing
  let agentCount = 0;
  let skillCount = 0;
  let toolCount = 0;
  let configError: string | null = null;

  try {
    const [agents, skills, tools] = await Promise.all([
      listAgents(),
      listSkills(),
      listTools(),
    ]);
    agentCount = agents.length;
    skillCount = skills.length;
    toolCount = tools.length;
  } catch (err: unknown) {
    configError = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-bold text-3xl tracking-tight">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your agents, skills, and tools.
        </p>
      </header>

      {configError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">
            Supabase is not configured yet.
          </p>
          <p className="mt-1 text-muted-foreground">
            Fill in <code>.env.local</code> with your Supabase URL and
            service-role key, then run the SQL in{" "}
            <code>supabase/schema.sql</code>.
          </p>
          <p className="mt-2 font-mono text-muted-foreground text-xs">
            {configError}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard href="/admin/agents" label="Agents" value={agentCount} />
        <StatCard href="/admin/skills" label="Skills" value={skillCount} />
        <StatCard href="/admin/tools" label="Tools" value={toolCount} />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold text-lg">Quick start</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground text-sm">
          <li>
            Paste <code className="text-foreground">supabase/schema.sql</code>{" "}
            into the Supabase SQL Editor to create tables + seed agents.
          </li>
          <li>
            Fill in <code className="text-foreground">.env.local</code> with
            your Supabase, Gemini, and (optionally) Groq / Upstash keys.
          </li>
          <li>
            Visit{" "}
            <Link className="text-foreground underline" href="/admin/agents">
              Agents
            </Link>{" "}
            to verify the 7 seeded agents appeared.
          </li>
          <li>
            Test the chat: POST to{" "}
            <code className="text-foreground">/api/agent-chat</code> with an
            agent ID and a message.
          </li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  return (
    <Link
      className="block rounded-lg border bg-card p-6 transition-colors hover:bg-muted/50"
      href={href}
    >
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 font-bold text-3xl">{value}</p>
    </Link>
  );
}
