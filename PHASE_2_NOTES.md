# Phase 2 — Status & Next Steps

## ✅ What was built

### Database layer (lib/db/)
| File | Purpose |
|---|---|
| `supabase-client.ts` | Service-role Supabase client (server-only, cached) |
| `agent-types.ts` | TypeScript types matching the SQL schema |
| `agents.ts` | CRUD + composition helpers for agents/tools/skills/knowledge/cron/video |

### AI layer additions (lib/ai/)
| File | Purpose |
|---|---|
| `skill-loader.ts` | Stitches agent system_prompt + skills + knowledge into one prompt |
| `tool-executor.ts` | Converts DB-defined tools (webhook/CLI/internal) → AI SDK tool defs |

### API routes (app/api/)
| Route | Methods | Purpose |
|---|---|---|
| `/api/agents` | GET, POST | List all agents / create new agent |
| `/api/agents/[id]` | GET, PUT, DELETE | Fetch with relations / update / delete |
| `/api/agent-chat` | POST | Dynamic chat with any agent (cache + rotation + tools + logging) |

## 🧠 Design decisions

1. **`agent-chat` is a separate route from the template's `/api/chat`.**
   The template's chat route handles auth, chat history persistence, artifacts,
   etc. — modifying it risks breaking template features. Our route runs in
   parallel and is stateless. Phase 4 will add a UI that calls `agent-chat`.

2. **Two database access layers coexist.**
   The template uses Drizzle ORM (`lib/db/queries.ts`) for its chat/auth tables.
   Our agent system uses `@supabase/supabase-js` (`lib/db/agents.ts`) for the
   agent tables. Both point to the same Supabase Postgres. No conflict.

3. **Cache only fires for stateless single-turn requests with no tools.**
   Multi-turn conversations and tool-using runs are never cached because
   their state diverges turn-by-turn. Cache hit rate will be high for cron
   jobs and FAQ-style queries.

4. **Fallback rotation on missing provider key.**
   If an agent is configured for, say, OpenRouter but you haven't set
   `OPENROUTER_API_KEY`, the chat route automatically rotates to the next
   available provider instead of erroring.

5. **Tool execution security.**
   - Webhook tools: arguments JSON-stringified or URL-encoded, custom headers from DB
   - CLI tools: placeholder substitution with shell-quoting — STILL risky for arbitrary user
     input; treat CLI tools as trusted-only (admin-defined commands, not LLM-invented ones)
   - Internal tools: registry pattern — only handlers you explicitly register are callable

## 🔲 What YOU need to do (same as Phase 1, plus)

1. **Paste `supabase/schema.sql` into Supabase SQL Editor** (if you haven't)
2. **Fill `.env.local`** — at minimum: Supabase (3 vars), `POSTGRES_URL`, `GOOGLE_API_KEY`, `AUTH_SECRET`, Upstash (2 vars)
3. **Test it works**:
   ```powershell
   npm run dev
   ```
   Then in another terminal or browser, hit `http://localhost:3000/api/agents` — you should see your 7 seeded agents as JSON.

## ⏭️ Ready for Phase 3 when

- [ ] `GET /api/agents` returns the seeded agents
- [ ] You can pick an agent ID from the response and `GET /api/agents/<id>` returns it with its relations
- [ ] Optional: try POST to `/api/agent-chat` with `{ agentId, messages: [{role:"user", parts:[{type:"text", text:"hello"}]}] }` — should stream a Gemini response

Then prompt: "Execute Phase 3 from BUILD_PLAN_V2.md." Phase 3 = admin panel UI for managing agents/tools/skills.
