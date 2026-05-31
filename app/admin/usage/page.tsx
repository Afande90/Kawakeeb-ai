/**
 * Usage dashboard — totals, free-tier meters, per-provider and per-agent
 * breakdowns, and a simple daily activity series. Server-rendered.
 */

import { PROVIDERS, type ProviderId } from "@/lib/ai/multi-providers";
import { getUsage } from "@/lib/ai/rate-limiter";
import { getUsageStats, listAgents } from "@/lib/db/agents";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}k`;
  }
  return String(n);
}

export default async function UsagePage() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let logs: Awaited<ReturnType<typeof getUsageStats>> = [];
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let error: string | null = null;
  try {
    [logs, agents] = await Promise.all([
      getUsageStats({ since }),
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

  const agentName = new Map(agents.map((a) => [a.id, a]));

  // Aggregate
  let totalIn = 0;
  let totalOut = 0;
  let errors = 0;
  const byProvider = new Map<string, { calls: number; tokens: number }>();
  const byAgent = new Map<string, { calls: number; tokens: number }>();
  for (const log of logs) {
    totalIn += log.tokens_input;
    totalOut += log.tokens_output;
    if (log.status === "error") {
      errors += 1;
    }
    const p = byProvider.get(log.provider) ?? { calls: 0, tokens: 0 };
    p.calls += 1;
    p.tokens += log.tokens_input + log.tokens_output;
    byProvider.set(log.provider, p);

    const aKey = log.agent_id ?? "unknown";
    const a = byAgent.get(aKey) ?? { calls: 0, tokens: 0 };
    a.calls += 1;
    a.tokens += log.tokens_input + log.tokens_output;
    byAgent.set(aKey, a);
  }

  // Live free-tier meters from Redis
  const configured = (Object.keys(PROVIDERS) as ProviderId[]).filter(
    (id) => !!process.env[PROVIDERS[id].envKey]
  );
  const meters = await Promise.all(
    configured.map(async (id) => {
      const u = await getUsage(id);
      return { id, ...u, rpm: PROVIDERS[id].rpm, rpd: PROVIDERS[id].rpd };
    })
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-bold text-3xl tracking-tight">Usage</h1>
        <p className="mt-1 text-muted-foreground">Last 7 days</p>
      </header>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Calls" value={fmt(logs.length)} />
        <Stat label="Input tokens" value={fmt(totalIn)} />
        <Stat label="Output tokens" value={fmt(totalOut)} />
        <Stat
          label="Errors"
          tone={errors > 0 ? "warn" : "ok"}
          value={String(errors)}
        />
      </div>

      {/* Free-tier meters */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold">Free-tier usage (live, today)</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Per-day request counts from the rate limiter. Empty bars = Redis not
          configured or no calls yet.
        </p>
        <div className="mt-4 space-y-3">
          {meters.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No providers configured.
            </p>
          )}
          {meters.map((m) => {
            const cap = m.rpd > 0 ? m.rpd : null;
            const pct = cap ? Math.min(100, (m.perDay / cap) * 100) : 0;
            const warn = pct >= 80;
            return (
              <div key={m.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{m.id}</span>
                  <span className="text-muted-foreground">
                    {m.perDay}
                    {cap ? ` / ${cap}` : " (no daily cap)"} today
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      warn ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{ width: `${cap ? pct : 4}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Per provider */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold">By provider</h2>
        <Table
          rows={[...byProvider.entries()]
            .sort((a, b) => b[1].calls - a[1].calls)
            .map(([name, v]) => ({
              label: name,
              calls: v.calls,
              tokens: v.tokens,
            }))}
        />
      </section>

      {/* Per agent */}
      <section className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold">By agent</h2>
        <Table
          rows={[...byAgent.entries()]
            .sort((a, b) => b[1].calls - a[1].calls)
            .map(([id, v]) => {
              const ag = agentName.get(id);
              return {
                label: ag ? `${ag.icon ?? "🤖"} ${ag.name}` : id,
                calls: v.calls,
                tokens: v.tokens,
              };
            })}
        />
      </section>

      {logs.length === 0 && (
        <p className="text-center text-muted-foreground text-sm">
          No usage yet. Chat with an agent to generate data.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={`mt-1 font-bold text-2xl ${
          tone === "warn" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Table({
  rows,
}: {
  rows: { label: string; calls: number; tokens: number }[];
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-muted-foreground text-sm">No data yet.</p>;
  }
  return (
    <table className="mt-3 w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">Name</th>
          <th className="py-2 text-right font-medium">Calls</th>
          <th className="py-2 text-right font-medium">Tokens</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-2">{r.label}</td>
            <td className="py-2 text-right">{r.calls}</td>
            <td className="py-2 text-right">
              {r.tokens >= 1000 ? `${(r.tokens / 1000).toFixed(1)}k` : r.tokens}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
