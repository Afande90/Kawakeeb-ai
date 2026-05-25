/**
 * Agents list — view all agents, link to edit pages.
 */

import Link from "next/link";
import { listAgents } from "@/lib/db/agents";

export default async function AgentsListPage() {
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let error: string | null = null;
  try {
    agents = await listAgents({ activeOnly: false });
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Agents</h1>
          <p className="mt-1 text-muted-foreground">
            {agents.length} configured
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 font-mono text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/30 text-left text-muted-foreground text-sm">
            <tr>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Telegram</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {agents.map((agent) => (
              <tr className="hover:bg-muted/30" key={agent.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{agent.icon ?? "🤖"}</span>
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      {agent.description && (
                        <p className="text-muted-foreground text-xs">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                    {agent.model_provider}/{agent.model_id}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground text-sm">
                  {agent.telegram_command ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {agent.is_active ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Disabled</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    className="text-sm underline hover:text-foreground"
                    href={`/admin/agents/${agent.id}`}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {agents.length === 0 && !error && (
              <tr>
                <td
                  className="px-4 py-12 text-center text-muted-foreground text-sm"
                  colSpan={5}
                >
                  No agents yet. Run the SQL in supabase/schema.sql to seed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
