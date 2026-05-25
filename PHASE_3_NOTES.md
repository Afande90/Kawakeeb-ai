# Phase 3 — Status & Next Steps

## ✅ What was built

### Admin UI (app/admin/)
| Route | Purpose |
|---|---|
| `/admin` | Overview — counts of agents/skills/tools, quick-start checklist |
| `/admin/agents` | List all agents in a table with status/model/telegram command |
| `/admin/agents/[id]` | Full editor: basics, prompt, attach/detach skills + tools, delete |
| `/admin/skills` | Master-detail UI: sidebar list, inline editor, create/update/delete |
| `/admin/tools` | Master-detail UI: webhook URL / CLI command / parameters as JSON |

### API routes (app/api/)
| Route | Methods | Purpose |
|---|---|---|
| `/api/tools` | GET, POST | List / create |
| `/api/tools/[id]` | GET, PUT, DELETE | Read / update / delete one tool |
| `/api/skills` | GET, POST | List (with category filter) / create |
| `/api/skills/[id]` | GET, PUT, DELETE | Read / update / delete one skill |
| `/api/agents/[id]/skills` | POST | Attach a skill to an agent |
| `/api/agents/[id]/skills/[skillId]` | DELETE | Detach a skill |
| `/api/agents/[id]/tools` | POST | Attach a tool to an agent |
| `/api/agents/[id]/tools/[toolId]` | DELETE | Detach a tool |

### Database helpers added (lib/db/agents.ts)
- `updateTool`, `deleteTool`
- `getSkill`, `updateSkill`, `deleteSkill`

## 🧠 Design decisions

1. **Server components fetch, client components edit.** Each page is a server
   component that loads data with the service-role client and passes it to
   a client editor. This means initial render is fast (SSR) and edits are
   reactive without re-fetching.

2. **Master-detail layout for skills/tools.** Sidebar list on the left,
   editor on the right. Click an item to edit; "+ New" enters create mode.
   Saves update local state without a full reload.

3. **Parameters / headers edited as raw JSON.** A full schema editor is
   complex; raw JSON works fine for the 5 default tools and any new ones.
   Validates on save. Upgrade to a structured editor if you create many tools.

4. **Browser `confirm()` for destructive actions.** Tagged with
   `biome-ignore` comments — fine for v1. Swap to shadcn `<AlertDialog>`
   later if you want polished modal confirmations.

5. **Fail-soft on the Overview page.** If Supabase isn't configured yet,
   shows zeros + a helpful banner instead of crashing.

## 🔲 What YOU need to do (same as before)

1. **Paste `supabase/schema.sql`** into your Supabase SQL Editor
2. **Fill `.env.local`** with at minimum: Supabase (3 vars + POSTGRES_URL), GOOGLE_API_KEY, UPSTASH (2 vars), AUTH_SECRET
3. **Run the dev server**:
   ```powershell
   npm run dev
   ```
4. **Visit `http://localhost:3000/admin`** — you should see your 7 seeded agents.

## ⏭️ Ready for Phase 4 when

- [ ] Admin overview loads without errors and shows non-zero counts
- [ ] You can click an agent in `/admin/agents` and edit its system prompt
- [ ] You can check/uncheck skills on an agent and they save
- [ ] You can create a new skill from `/admin/skills`
- [ ] You can create a webhook tool from `/admin/tools`

Then prompt: "Phase 4". Phase 4 = update the main chat UI to use the new dynamic agent system (agent picker, conversation starters, tool/skill usage indicators).

## ⚠️ Known limitations of Phase 3 (intentional, fix later)

- **No auth gate on `/admin`** — anyone who can reach your dev server can
  edit. Fine for localhost; add a middleware-based password check before
  deploying to production.
- **No conversation starters editor yet** — schema exists, helper exists,
  UI form deferred to Phase 4.
- **No knowledge base file upload UI yet** — same as above.
- **No usage dashboard** — Phase 5.
