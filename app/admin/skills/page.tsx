/**
 * Skills page — server-rendered list, client editor in a dialog.
 */

import { listSkills } from "@/lib/db/agents";
import { SkillsManager } from "./skills-manager";

export default async function SkillsPage() {
  let skills: Awaited<ReturnType<typeof listSkills>> = [];
  let error: string | null = null;
  try {
    skills = await listSkills({ activeOnly: false });
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

  return <SkillsManager initialSkills={skills} />;
}
