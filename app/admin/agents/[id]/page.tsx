/**
 * Edit a single agent — name, model, prompt, attached skills, attached tools.
 * Server loads the agent + all skills + all tools, hands them to the client editor.
 */

import { notFound } from "next/navigation";
import { getAgentWithRelations, listSkills, listTools } from "@/lib/db/agents";
import { AgentEditor } from "./agent-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAgentPage({ params }: PageProps) {
  const { id } = await params;
  const [agent, allSkills, allTools] = await Promise.all([
    getAgentWithRelations(id),
    listSkills({ activeOnly: false }),
    listTools({ activeOnly: false }),
  ]);

  if (!agent) {
    notFound();
  }

  return (
    <AgentEditor agent={agent} allSkills={allSkills} allTools={allTools} />
  );
}
