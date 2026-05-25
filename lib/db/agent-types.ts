/**
 * TypeScript types matching the Supabase schema in supabase/schema.sql.
 * Keep these in sync if you change the SQL.
 */

export type ProviderId =
  | "cerebras"
  | "groq"
  | "google"
  | "github"
  | "openrouter"
  | "mistral"
  | "huggingface"
  | "cohere";

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  model_provider: string;
  model_id: string;
  icon: string | null;
  is_active: boolean;
  telegram_command: string | null;
  created_at: string;
  updated_at: string;
}

export type ToolType = "webhook" | "cli" | "internal";

export interface ToolParameter {
  name: string;
  type: "string" | "integer" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  tool_type: ToolType;
  webhook_url: string | null;
  cli_command: string | null;
  http_method: string;
  headers: Record<string, string>;
  parameters: ToolParameter[];
  is_active: boolean;
  created_at: string;
}

export interface AgentKnowledge {
  id: string;
  agent_id: string;
  file_name: string;
  file_content: string;
  file_size: number | null;
  created_at: string;
}

export interface AgentStarter {
  id: string;
  agent_id: string;
  text: string;
  sort_order: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface AgentWithRelations extends Agent {
  tools: Tool[];
  skills: Skill[];
  knowledge: AgentKnowledge[];
  starters: AgentStarter[];
}

export interface UsageLog {
  id: string;
  provider: string;
  model_id: string;
  agent_id: string | null;
  tokens_input: number;
  tokens_output: number;
  duration_ms: number;
  status: "success" | "error" | "cached";
  error_message: string | null;
  source: "chat" | "cron" | "telegram" | "video_pipeline";
  created_at: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // cron expression
  agent_id: string | null;
  instructions: string;
  model_provider: string | null;
  model_id: string | null;
  is_enabled: boolean;
  last_run: string | null;
  last_status: string | null;
  created_at: string;
}

export type VideoStatus =
  | "draft"
  | "scripting"
  | "rendering"
  | "assembling"
  | "complete"
  | "error";

export interface VideoSegment {
  segment_number: number;
  narration: string;
  visual_type:
    | "tactical_diagram"
    | "character_image"
    | "stat_graphic"
    | "title_card";
  visual_description: string;
  duration_seconds: number;
  manim_code?: string;
  rendered_path?: string;
  image_path?: string;
}

export interface VideoProject {
  id: string;
  title: string;
  prompt: string;
  script: string | null;
  segments: VideoSegment[];
  status: VideoStatus;
  output_url: string | null;
  duration_seconds: number | null;
  created_at: string;
}
