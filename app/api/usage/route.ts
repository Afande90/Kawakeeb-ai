/**
 * GET /api/usage?days=7
 *
 * Returns aggregated usage stats for the dashboard:
 *  - totals (calls, input/output tokens)
 *  - per-provider breakdown
 *  - per-agent breakdown
 *  - per-day series
 *  - live rate-limit usage from Redis (per provider)
 */

import type { NextRequest } from "next/server";
import { PROVIDERS, type ProviderId } from "@/lib/ai/multi-providers";
import { getUsage } from "@/lib/ai/rate-limiter";
import { getUsageStats } from "@/lib/db/agents";

export async function GET(req: NextRequest) {
  try {
    const days = Number(req.nextUrl.searchParams.get("days") ?? "7");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const logs = await getUsageStats({ since });

    const totals = {
      calls: logs.length,
      tokensInput: 0,
      tokensOutput: 0,
      errors: 0,
    };

    const byProvider: Record<
      string,
      { calls: number; tokensInput: number; tokensOutput: number }
    > = {};
    const byAgent: Record<
      string,
      { calls: number; tokensInput: number; tokensOutput: number }
    > = {};
    const byDay: Record<string, number> = {};

    for (const log of logs) {
      totals.tokensInput += log.tokens_input;
      totals.tokensOutput += log.tokens_output;
      if (log.status === "error") {
        totals.errors += 1;
      }

      if (!byProvider[log.provider]) {
        byProvider[log.provider] = {
          calls: 0,
          tokensInput: 0,
          tokensOutput: 0,
        };
      }
      const p = byProvider[log.provider];
      p.calls += 1;
      p.tokensInput += log.tokens_input;
      p.tokensOutput += log.tokens_output;

      const agentKey = log.agent_id ?? "unknown";
      if (!byAgent[agentKey]) {
        byAgent[agentKey] = { calls: 0, tokensInput: 0, tokensOutput: 0 };
      }
      const a = byAgent[agentKey];
      a.calls += 1;
      a.tokensInput += log.tokens_input;
      a.tokensOutput += log.tokens_output;

      const day = log.created_at.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    // Live rate-limit usage from Redis for configured providers.
    const configured = (Object.keys(PROVIDERS) as ProviderId[]).filter(
      (id) => !!process.env[PROVIDERS[id].envKey]
    );
    const liveLimits = await Promise.all(
      configured.map(async (id) => {
        const usage = await getUsage(id);
        return {
          provider: id,
          perMinute: usage.perMinute,
          perDay: usage.perDay,
          rpm: PROVIDERS[id].rpm,
          rpd: PROVIDERS[id].rpd,
        };
      })
    );

    return Response.json({
      days,
      totals,
      byProvider,
      byAgent,
      byDay,
      liveLimits,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
