/**
 * CRUD + composition helpers for the agent system.
 * All functions go through the service_role client → bypass RLS.
 * Server-only.
 */

import "server-only";
import { getSupabaseAdmin } from "./supabase-client";
import type {
  Agent,
  AgentKnowledge,
  AgentStarter,
  AgentWithRelations,
  CronJob,
  Skill,
  Tool,
  UsageLog,
  VideoProject,
} from "./agent-types";

// ═══════════════════════════════════════════════════════════════
// Agents
// ═══════════════════════════════════════════════════════════════

export async function listAgents(opts: { activeOnly?: boolean } = {}): Promise<Agent[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from("agents").select("*").order("name");
  if (opts.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getAgent(id: string): Promise<Agent | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("agents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAgentByTelegramCommand(command: string): Promise<Agent | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("agents")
    .select("*")
    .eq("telegram_command", command)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Fetch an agent with all its attached tools, skills, knowledge, and starters.
 * Used by the chat route to build the full agent context.
 */
export async function getAgentWithRelations(id: string): Promise<AgentWithRelations | null> {
  const sb = getSupabaseAdmin();

  const [agentRes, toolsRes, skillsRes, knowledgeRes, startersRes] = await Promise.all([
    sb.from("agents").select("*").eq("id", id).maybeSingle(),
    sb
      .from("agent_tools")
      .select("tool_id, tools(*)")
      .eq("agent_id", id),
    sb
      .from("agent_skills")
      .select("skill_id, skills(*)")
      .eq("agent_id", id),
    sb.from("agent_knowledge").select("*").eq("agent_id", id),
    sb.from("agent_starters").select("*").eq("agent_id", id).order("sort_order"),
  ]);

  if (agentRes.error) throw agentRes.error;
  if (!agentRes.data) return null;

  const tools = ((toolsRes.data ?? []) as Array<{ tools: Tool | null }>)
    .map((r) => r.tools)
    .filter((t): t is Tool => t !== null && (t.is_active ?? true));

  const skills = ((skillsRes.data ?? []) as Array<{ skills: Skill | null }>)
    .map((r) => r.skills)
    .filter((s): s is Skill => s !== null && (s.is_active ?? true));

  return {
    ...(agentRes.data as Agent),
    tools,
    skills,
    knowledge: (knowledgeRes.data ?? []) as AgentKnowledge[],
    starters: (startersRes.data ?? []) as AgentStarter[],
  };
}

export async function createAgent(
  data: Partial<Agent> & Pick<Agent, "name" | "system_prompt">,
): Promise<Agent> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from("agents").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from("agents")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteAgent(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("agents").delete().eq("id", id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// Tools
// ═══════════════════════════════════════════════════════════════

export async function listTools(opts: { activeOnly?: boolean } = {}): Promise<Tool[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from("tools").select("*").order("name");
  if (opts.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTool(id: string): Promise<Tool | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("tools").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTool(
  data: Partial<Tool> & Pick<Tool, "name" | "description" | "tool_type">,
): Promise<Tool> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from("tools").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function attachToolToAgent(agentId: string, toolId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("agent_tools")
    .insert({ agent_id: agentId, tool_id: toolId });
  if (error && error.code !== "23505") throw error; // ignore duplicate
}

export async function detachToolFromAgent(agentId: string, toolId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("agent_tools")
    .delete()
    .eq("agent_id", agentId)
    .eq("tool_id", toolId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// Skills
// ═══════════════════════════════════════════════════════════════

export async function listSkills(opts: { activeOnly?: boolean; category?: string } = {}): Promise<Skill[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from("skills").select("*").order("name");
  if (opts.activeOnly) query = query.eq("is_active", true);
  if (opts.category) query = query.eq("category", opts.category);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createSkill(
  data: Partial<Skill> & Pick<Skill, "name" | "content">,
): Promise<Skill> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from("skills").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function attachSkillToAgent(agentId: string, skillId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("agent_skills")
    .insert({ agent_id: agentId, skill_id: skillId });
  if (error && error.code !== "23505") throw error;
}

export async function detachSkillFromAgent(agentId: string, skillId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("agent_skills")
    .delete()
    .eq("agent_id", agentId)
    .eq("skill_id", skillId);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════════
// Knowledge & Starters
// ═══════════════════════════════════════════════════════════════

export async function addKnowledge(
  agentId: string,
  fileName: string,
  fileContent: string,
): Promise<AgentKnowledge> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("agent_knowledge")
    .insert({
      agent_id: agentId,
      file_name: fileName,
      file_content: fileContent,
      file_size: fileContent.length,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addStarter(
  agentId: string,
  text: string,
  sortOrder = 0,
): Promise<AgentStarter> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("agent_starters")
    .insert({ agent_id: agentId, text, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════
// Usage Logs
// ═══════════════════════════════════════════════════════════════

export async function logUsage(entry: Partial<UsageLog> & Pick<UsageLog, "provider" | "model_id">): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("usage_logs").insert(entry);
  if (error) console.error("[usage] failed to log:", error);
}

export async function getUsageStats(opts: {
  since?: Date;
  provider?: string;
  agentId?: string;
} = {}): Promise<UsageLog[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from("usage_logs").select("*").order("created_at", { ascending: false });
  if (opts.since) query = query.gte("created_at", opts.since.toISOString());
  if (opts.provider) query = query.eq("provider", opts.provider);
  if (opts.agentId) query = query.eq("agent_id", opts.agentId);
  const { data, error } = await query.limit(1000);
  if (error) throw error;
  return data ?? [];
}

// ═══════════════════════════════════════════════════════════════
// Cron Jobs
// ═══════════════════════════════════════════════════════════════

export async function listCronJobs(opts: { enabledOnly?: boolean } = {}): Promise<CronJob[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from("cron_jobs").select("*").order("name");
  if (opts.enabledOnly) query = query.eq("is_enabled", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createCronJob(
  data: Partial<CronJob> & Pick<CronJob, "name" | "schedule" | "instructions">,
): Promise<CronJob> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from("cron_jobs").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateCronJob(id: string, data: Partial<CronJob>): Promise<CronJob> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from("cron_jobs")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

// ═══════════════════════════════════════════════════════════════
// Video Projects
// ═══════════════════════════════════════════════════════════════

export async function createVideoProject(
  data: Partial<VideoProject> & Pick<VideoProject, "title" | "prompt">,
): Promise<VideoProject> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb.from("video_projects").insert(data).select().single();
  if (error) throw error;
  return row;
}

export async function updateVideoProject(id: string, data: Partial<VideoProject>): Promise<VideoProject> {
  const sb = getSupabaseAdmin();
  const { data: row, error } = await sb
    .from("video_projects")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function listVideoProjects(): Promise<VideoProject[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("video_projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
