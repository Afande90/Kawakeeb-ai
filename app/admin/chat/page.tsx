/**
 * Agent chat playground — pick an agent, talk to it.
 * Server loads the active agents; the client component handles streaming.
 */

import { listAgents } from "@/lib/db/agents";
import { ChatPlayground } from "./chat-ui";

export default async function ChatPage() {
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let error: string | null = null;
  try {
    agents = await listAgents({ activeOnly: true });
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

  return <ChatPlayground agents={agents} />;
}
