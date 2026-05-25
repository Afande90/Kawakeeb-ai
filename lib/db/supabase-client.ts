/**
 * Supabase client for the agent system (agents, tools, skills, cron jobs, etc.).
 *
 * This is INTENTIONALLY separate from lib/db/queries.ts which uses Drizzle ORM
 * for the template's chat/auth/document tables. Both connect to the same
 * Supabase Postgres instance — they just use different access layers:
 *
 *   - Drizzle (queries.ts)   → chats, messages, users, documents (template features)
 *   - Supabase JS (this file) → agents, tools, skills, cron_jobs, video_projects
 *
 * The service_role key bypasses RLS, so this client must NEVER be exposed to
 * the browser. Only import it from server components, route handlers, or
 * server actions.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
