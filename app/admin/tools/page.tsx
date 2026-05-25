/**
 * Tools page — server-renders list, hands off to client editor.
 */

import { listTools } from "@/lib/db/agents";
import { ToolsManager } from "./tools-manager";

export default async function ToolsPage() {
  let tools: Awaited<ReturnType<typeof listTools>> = [];
  let error: string | null = null;
  try {
    tools = await listTools({ activeOnly: false });
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

  return <ToolsManager initialTools={tools} />;
}
