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
  created_at: string;
  description: string | null;
  icon: string | null;
  id: string;
  is_active: boolean;
  model_id: string;
  model_provider: string;
  name: string;
  system_prompt: string;
  telegram_command: string | null;
  updated_at: string;
}

export type ToolType = "webhook" | "cli" | "internal";

export interface ToolParameter {
  description: string;
  name: string;
  required: boolean;
  type: "string" | "integer" | "number" | "boolean" | "array" | "object";
}

export interface Tool {
  cli_command: string | null;
  created_at: string;
  description: string;
  headers: Record<string, string>;
  http_method: string;
  id: string;
  is_active: boolean;
  name: string;
  parameters: ToolParameter[];
  tool_type: ToolType;
  webhook_url: string | null;
}

export interface AgentKnowledge {
  agent_id: string;
  created_at: string;
  file_content: string;
  file_name: string;
  file_size: number | null;
  id: string;
}

export interface AgentStarter {
  agent_id: string;
  id: string;
  sort_order: number;
  text: string;
}

export interface Skill {
  category: string;
  content: string;
  created_at: string;
  description: string | null;
  id: string;
  is_active: boolean;
  name: string;
}

export interface AgentWithRelations extends Agent {
  knowledge: AgentKnowledge[];
  skills: Skill[];
  starters: AgentStarter[];
  tools: Tool[];
}

export interface UsageLog {
  agent_id: string | null;
  created_at: string;
  duration_ms: number;
  error_message: string | null;
  id: string;
  model_id: string;
  provider: string;
  source: "chat" | "cron" | "telegram" | "video_pipeline";
  status: "success" | "error" | "cached";
  tokens_input: number;
  tokens_output: number;
}

export interface CronJob {
  agent_id: string | null;
  created_at: string;
  id: string;
  instructions: string;
  is_enabled: boolean;
  last_run: string | null;
  last_status: string | null;
  model_id: string | null;
  model_provider: string | null;
  name: string;
  schedule: string; // cron expression
}

export type VideoStatus =
  | "draft"
  | "scripting"
  | "rendering"
  | "assembling"
  | "complete"
  | "error";

export interface VideoSegment {
  duration_seconds: number;
  image_path?: string;
  manim_code?: string;
  narration: string;
  rendered_path?: string;
  segment_number: number;
  visual_description: string;
  visual_type:
    | "tactical_diagram"
    | "character_image"
    | "stat_graphic"
    | "title_card";
}

export interface VideoProject {
  created_at: string;
  duration_seconds: number | null;
  id: string;
  output_url: string | null;
  prompt: string;
  script: string | null;
  segments: VideoSegment[];
  status: VideoStatus;
  title: string;
}
