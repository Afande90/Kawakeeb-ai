# Kawakeeb AI — Backlog (deferred work, do not forget)

## 🌐 Browser automation skills (DEFERRED — requested 2026-05)

Two downloaded tools to integrate when we tackle web automation. Both do
the same job (let an agent drive a real browser); pick ONE.

### Option A — Webwright (Microsoft) ⭐ recommended for us
- Source: `C:\Users\Eng Ibrahim\Downloads\Webwright-main.zip`
- What it is: gives an LLM a terminal to launch Playwright browser sessions
  and complete a web task end-to-end as a re-runnable Python script.
- Why it fits: ~1.5k LoC (light), supports **OpenRouter free models**, and
  ships a `skills/webwright/` folder explicitly designed to load into
  **Hermes / Claude Code / Codex** style agents. Closest match to our
  skill+tool architecture.
- Integration plan:
  1. Copy `skills/webwright/SKILL.md` content → insert as a new row in our
     `skills` table (category `automation`).
  2. Add a `cli` tool `run_webwright` in /admin/tools that shells out to the
     Webwright runner script with `{{task}}` placeholder.
  3. Attach skill + tool to **Job Hunter** (scrape job boards) and
     **Research** (multi-site web tasks).
  4. Requires: `pip install playwright && playwright install chromium`
     (~400MB) — only when we actually turn this on.

### Option B — browser-use (heavier)
- Source: `C:\Users\Eng Ibrahim\Downloads\browser-use-main.zip`
- What it is: popular Python web-automation agent framework.
- Trade-off: more capable/polished but heavier (full framework + Playwright
  Chromium). On an 8GB laptop, prefer Webwright unless we hit Webwright limits.
- Has its own `AGENTS.md` / `CLAUDE.md` describing tool surface.

### Decision when we resume
- Default to **Webwright** (lighter, free-model friendly, skill-native).
- Keep browser-use zip as fallback.
- Target agents: Job Hunter, Research. Maybe Coder later.

---

## Other deferred items
- Phase 5: Usage dashboard (token/cost meters from usage_logs + Redis)
- Phase 6: Telegram bot (telegraf already installed; wire /api/telegram/webhook)
- Phase 7: Football video pipeline (Manim + Edge TTS + MoviePy, local-first)
- Phase 8: Cron jobs (scheduled agent runs via GitHub Actions)
- Security: add a password/middleware gate to /admin before any public deploy
- Add more LLM provider keys (Cerebras, OpenRouter, Mistral, HF, Cohere) to
  widen the free-tier fallback chain
