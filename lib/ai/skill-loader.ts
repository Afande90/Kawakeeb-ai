/**
 * Builds the full system prompt for an agent by stitching together:
 *   - the agent's base system_prompt
 *   - all attached skills (markdown content)
 *   - the knowledge base files
 */

import type { AgentWithRelations } from "@/lib/db/agent-types";

export function buildSystemPrompt(agent: AgentWithRelations): string {
  const parts: string[] = [agent.system_prompt.trim()];

  if (agent.skills.length > 0) {
    parts.push("");
    parts.push("# Available Skills");
    parts.push(
      "You have been trained with the following skills. " +
        "Apply them when the user's request matches their topic."
    );
    for (const skill of agent.skills) {
      parts.push("");
      parts.push(`## Skill: ${skill.name}`);
      if (skill.description) {
        parts.push(`_${skill.description}_`);
      }
      parts.push("");
      parts.push(skill.content);
    }
  }

  if (agent.knowledge.length > 0) {
    parts.push("");
    parts.push("# Knowledge Base");
    parts.push("Reference these documents when relevant:");
    for (const doc of agent.knowledge) {
      parts.push("");
      parts.push(`## ${doc.file_name}`);
      parts.push("```");
      parts.push(doc.file_content);
      parts.push("```");
    }
  }

  return parts.join("\n");
}
