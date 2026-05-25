# Phase 1 — Status & Next Steps

## ✅ What was built

| File | Purpose |
|---|---|
| `.env.local` | Environment variable placeholders for all 13 services |
| `lib/ai/multi-providers.ts` | 8-provider LLM system with rate-limit-aware rotation (1D + 1E) |
| `lib/ai/cache.ts` | Upstash Redis cache layer, SHA-256 keys, 24h TTL (1F) |
| `lib/ai/rate-limiter.ts` | Pre-flight RPM/RPD checker per provider (1G) |
| `supabase/schema.sql` | Full database schema + seed data (1A) |

Packages installed (1B): `@supabase/supabase-js`, `@ai-sdk/google`, `@ai-sdk/openai`, `@upstash/redis`, `telegraf`.

## 🔲 What YOU need to do

### 1. Paste the SQL into Supabase
1. Open your Supabase project → SQL Editor → New query
2. Open `supabase/schema.sql` in this project
3. Copy the entire file content → paste into Supabase SQL Editor
4. Click **Run**
5. Verify in Table Editor that all 10 tables appeared

### 2. Fill in .env.local
Open `.env.local` and paste values from `keys.txt`:
- All `SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_URL`
- `GOOGLE_API_KEY` (you have this)
- `GROQ_API_KEY` (you have this)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (you have these)
- `GITHUB_TOKEN` — generate at github.com → Settings → Developer settings → Personal access tokens → Fine-grained
- `AUTH_SECRET` — run in PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))`

**Other providers (CEREBRAS, OPENROUTER, MISTRAL, HUGGINGFACE, COHERE) can stay empty for now** — the system will skip un-configured providers automatically. Add them later for more fallback capacity.

### 3. Verify the dev server still runs
```powershell
cd "C:\Users\Eng Ibrahim\ibrahim-ai"
npm run dev
```
Visit http://localhost:3000 — the chatbot template should still load (we haven't touched it yet, only added our files alongside).

## 🧠 Design decisions you should review

1. **`multi-providers.ts` (not `providers.ts`)** — template already had its own `providers.ts` using Vercel AI Gateway. I left it untouched and put our custom system in a parallel file. Phase 2 will modify the chat route to use our file instead.

2. **Rate-limit safety buffer = 80%** — we stop calling a provider at 80% of its limit to leave room for race conditions. Adjust `SAFETY_BUFFER` in `rate-limiter.ts` if you want it tighter or looser.

3. **Fail-open if Redis is unreachable** — if Upstash is down, rate-limiter assumes calls are OK rather than blocking everything. Trade-off: brief over-call possible during Redis outages, but the app never goes down.

4. **Embedding rotation order** — Google (`text-embedding-004`) is first because it's the best free embedding model. Others are fallbacks but their embeddings have different dimensions, so mixing them needs care in Phase 2 if you build RAG.

5. **GitHub Models RPD = 150** — this is the documented free preview limit. May change as Microsoft moves it out of preview.

6. **Mistral RPD = 0 (unlimited)** — Mistral free tier is 1B tokens/month, which is effectively unlimited for personal use. The rate-limiter treats 0 as "no daily cap, only per-minute applies."

## ⏭️ Ready for Phase 2 when

- [ ] SQL successfully pasted into Supabase (all 10 tables visible)
- [ ] `.env.local` has at minimum: Supabase + Google + one other LLM provider + Upstash
- [ ] `npm run dev` starts without errors
- [ ] You've reviewed the design decisions above

Then prompt: "Execute Phase 2 from BUILD_PLAN_V2.md."
