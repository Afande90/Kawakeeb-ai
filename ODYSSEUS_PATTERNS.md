# Odysseus Patterns — adoption tracker

Eight production patterns lifted from the Odysseus codebase, mapped onto
KAWAKEEB (this project) and the wider portfolio. Logic ports; the Python code
does not. Golden rule: Patterns 1 & 2 first — they protect everything.

## Status in KAWAKEEB

| # | Pattern | Status | Where |
|---|---------|--------|-------|
| 1 | Agent-ending discipline (clean DONE/BLOCKED/continue; no validation theater; never silent on failure) | ✅ Done | `lib/ai/agent-discipline.ts` → injected by `buildSystemPrompt` |
| 2 | Dead-host circuit breaker (3 strikes → 60s cooldown → route around) | ✅ Done | `lib/ai/circuit-breaker.ts` + `runWithFailover` in `multi-providers.ts` |
| 3 | Multi-format tool parser (native + ```tool fences + [TOOL_CALL]{} + MiniMax XML `<invoke>`) | 🔲 Todo | new `lib/ai/tool-parser.ts`, call before trusting native tool-calls |
| 4 | Context compaction (summarise oldest turns at 85% of window: Goal/Done/State/Next; keep recent verbatim) | 🔲 Todo | new `lib/ai/compactor.ts`, apply in chat + run-agent |
| 5 | Teacher-escalation + skill capture (cheap model runs; on failure-regex, SOTA model fixes AND writes a skill row — only persist if teacher output passes the same regex) | 🔲 Todo (moat, build last) | new `lib/ai/teacher.ts`; writes to `skills` table |
| 6 | Deep-research loop (plan → query → extract goal-relevant facts → fold into report → stop; min 2 / max 8 rounds, max-empty-rounds) | 🔲 Todo | powers Research + Job Hunter agents; new `lib/ai/deep-research.ts` |
| 7 | Background scheduler + singleflight shared cache (fetch-once per tick) | 🟡 Partial | scheduler = cron runner (done). Singleflight cache still todo for tools/data fetches |
| 8 | Visual report generator (research JSON → standalone HTML: auto-TOC, dark/light, collapsible sources, no remote fonts) | 🔲 Todo | new `lib/report/html.ts`; deliverable format for research/dashboards |

## Failure-detection regex (shared by Patterns 1 & 5)

Treat a turn as failed if a tool output matches:
`^Unknown action | ^Failed to | not found | ^Invalid | error:`
or the reply matches:
`"I don't have a tool" | "could you specify" | "unable to"`

## Recommended next order (per Odysseus master build order)

1. ✅ Phase 0 — Patterns 1 + 2 (done)
2. **Pattern 4** (context compaction) — keeps long KAWAKEEB threads from crashing
3. **Pattern 3** (multi-format parser) — needed once agents use more tools / MiniMax routing
4. **Pattern 7 singleflight** — pairs with browser-automation + dashboards to stay under free-tier
5. **Pattern 6 + 8** (deep research + HTML report) — big value for Research / Job Hunter / FBA
6. **Pattern 5** (teacher-escalation) — the moat, build last

## Acceptance tests (from the plan)

- Kill a provider key mid-chat → app keeps responding via fallback, no hang. ✅ (Pattern 2)
- Send a MiniMax XML tool call → parser executes it. (Pattern 3)
- Run a 50-turn thread → no context-limit crash; summary appears. (Pattern 4)
- Force a cheap-model failure → teacher fixes it and a skill row is written. (Pattern 5)
- Ask "is X a viable niche" → research runs ≥2 rounds, stops itself, sourced report. (Patterns 6+8)
