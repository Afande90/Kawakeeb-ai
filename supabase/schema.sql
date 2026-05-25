-- ═══════════════════════════════════════════════════════════════
-- IBRAHIM AI — Supabase Schema (Phase 1A)
--
-- HOW TO USE:
--   1. Open your Supabase project dashboard
--   2. Left sidebar → SQL Editor → New query
--   3. Paste this ENTIRE file
--   4. Click "Run" (bottom right)
--   5. Verify in the Table Editor that all tables appeared
-- ═══════════════════════════════════════════════════════════════

-- ═══ CORE AGENT SYSTEM ═══

CREATE TABLE IF NOT EXISTS agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful assistant.',
  model_provider TEXT NOT NULL DEFAULT 'google',
  model_id TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  icon TEXT DEFAULT '🤖',
  is_active BOOLEAN DEFAULT true,
  telegram_command TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tool_type TEXT NOT NULL DEFAULT 'webhook',
  webhook_url TEXT,
  cli_command TEXT,
  http_method TEXT DEFAULT 'POST',
  headers JSONB DEFAULT '{}'::jsonb,
  parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tools (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, tool_id)
);

CREATE TABLE IF NOT EXISTS agent_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_starters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ═══ SKILLS SYSTEM ═══

CREATE TABLE IF NOT EXISTS skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

-- ═══ USAGE MONITORING ═══

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  source TEXT DEFAULT 'chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_provider_created
  ON usage_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_agent
  ON usage_logs(agent_id, created_at DESC);

-- ═══ CRON JOBS ═══

CREATE TABLE IF NOT EXISTS cron_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  instructions TEXT NOT NULL,
  model_provider TEXT,
  model_id TEXT,
  is_enabled BOOLEAN DEFAULT false,
  last_run TIMESTAMP WITH TIME ZONE,
  last_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══ VIDEO PIPELINE ═══

CREATE TABLE IF NOT EXISTS video_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  script TEXT,
  segments JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  output_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══ SEED DATA — DEFAULT AGENTS ═══

INSERT INTO agents (name, description, system_prompt, model_provider, model_id, icon, telegram_command)
VALUES
  ('Patient Triage',
   'Assess patient symptoms, determine triage priority, and route to clinical teams at ADTC.',
   'You are a clinical triage assistant for Abu Dhabi Telemedicine Centre (ADTC). You help Patient Care Coordinators assess incoming patient calls by analyzing symptoms, medical history, and urgency level. You assign triage priorities (1-5) following UAE DOH clinical protocols. Always recommend ED for chest pain, stroke symptoms, or breathing difficulty. Be precise and clinical in assessments but provide patient-friendly scripts the coordinator can read to callers.',
   'google', 'gemini-2.5-flash', '🏥', '/triage'),

  ('Job Hunter',
   'Scan UAE healthcare job boards and match positions to your experience.',
   'You are a job search assistant specialized in UAE healthcare positions. You search for Patient Care Coordinator, Clinic Coordinator, and healthcare operations roles in Abu Dhabi, Dubai, and across the UAE. When analyzing job descriptions, extract key requirements and match them against the user profile. Always prioritize roles at CCAD, SSMC, SEHA, Mediclinic, and major UAE healthcare providers.',
   'google', 'gemini-2.5-flash', '🔍', '/jobs'),

  ('CV Builder',
   'Create tailored two-column ReportLab CVs for UAE healthcare positions.',
   'You are a CV specialist for UAE healthcare job applications. You create tailored CVs that mirror exact keywords from job descriptions. Rules: two-column PDF layout (navy sidebar, gold accents), B.Tech degree with NO specialism listed, never include engineering history, never fabricate certifications, always extract and mirror JD keywords into CV bullets.',
   'openrouter', 'qwen/qwen3-coder:free', '📝', '/cv'),

  ('Football Content',
   'Generate match analysis, tactical breakdowns, and social media content.',
   'You are a football content creator specializing in Premier League, Champions League, and Sudanese football coverage. You generate match analysis scripts, tactical breakdowns, transfer news summaries, and social media posts for YouTube, TikTok, and Twitter. Write with passion and insight. Always include specific stats, player names, and formation details. When asked to create a video, generate a full script broken into segments with visual descriptions for each segment.',
   'groq', 'llama-3.3-70b-versatile', '⚽', '/football'),

  ('n8n Automator',
   'Build n8n automation workflows for clients.',
   'You are an n8n automation expert. You help design and build webhook-based automations for small businesses — WhatsApp bots, appointment schedulers, content pipelines, email workflows, and CRM integrations. Be specific about node types, connections, and configuration. Always consider error handling.',
   'openrouter', 'qwen/qwen3-coder:free', '🤖', '/automate'),

  ('Research',
   'Deep web research on any topic with structured reports.',
   'You are a research assistant. You perform thorough research on any topic, compile structured reports with key findings, and cite sources. Present information clearly with sections for summary, key findings, detailed analysis, and sources.',
   'google', 'gemini-2.5-flash', '📡', '/research'),

  ('Coder',
   'Write, debug, and execute code. Generate Manim animations, Python scripts, and automation tools.',
   'You are an expert software engineer. You write clean, well-tested code in Python, JavaScript, and TypeScript. You can generate Manim animations for football tactical diagrams, build automation scripts, create data analysis pipelines, and debug complex issues. When generating Manim code, always use ManimCE (community edition) syntax. When writing any code, include error handling and comments.',
   'openrouter', 'qwen/qwen3-coder:free', '💻', '/code')
ON CONFLICT DO NOTHING;

-- ═══ SEED DATA — DEFAULT SKILLS ═══

INSERT INTO skills (name, description, content, category)
VALUES
  ('Football Pressing Analysis',
   'How to analyze and compare pressing systems in football',
   E'# Football Pressing Analysis Framework\n\n## Key Metrics to Evaluate\n- PPDA (Passes Per Defensive Action): Lower = more aggressive press\n- High press percentage: How often the team presses in the opponent''s third\n- Press triggers: What specific events cause the team to initiate pressing\n- Press traps: Where the team tries to win the ball\n- Recovery time: How quickly they transition after losing the ball\n\n## Comparison Framework\nWhen comparing two managers'' pressing systems:\n1. Start with formation and base shape\n2. Identify the first line of press (who initiates)\n3. Map the press triggers (CB receives, GK plays short, etc.)\n4. Show the cover shadows and passing lane blocks\n5. Highlight the pressing trap zones\n6. Compare intensity metrics (PPDA, high press %)\n7. Note the differences in rest defense during the press',
   'tactical_analysis'),

  ('Shannon Lens',
   'Evaluate content through information theory — signal density, noise ratio, redundancy, and channel capacity',
   E'# Shannon Lens — Information-Theoretic Content Analysis\n\n## Core Principle\nEvery piece of content has a signal-to-noise ratio. The goal is to maximize information density (signal) while minimizing padding, repetition, and filler (noise).\n\n## Framework\n\n### 1. Signal Identification\n- What is the core insight or claim?\n- Can it be stated in one sentence?\n- If removed, would the content lose its value?\n\n### 2. Noise Detection\n- Filler phrases that add no information\n- Redundant restatements of the same point\n- Tangents that don''t serve the core argument\n- Hedging language that reduces clarity\n\n### 3. Channel Capacity Matching\n- Is the complexity appropriate for the audience?\n- Is the format (video/text/diagram) the right channel for this information?\n- Would a different format transmit the same signal with less noise?\n\n### 4. Compression Test\n- Can this 10-minute video be a 3-minute video without losing signal?\n- If yes, the original has 70% noise',
   'content')
ON CONFLICT DO NOTHING;

-- ═══ SEED DATA — DEFAULT TOOLS ═══

INSERT INTO tools (name, description, tool_type, webhook_url, http_method, parameters)
VALUES
  ('brave_search',
   'Search the web for current information using Brave Search API',
   'webhook',
   'https://api.search.brave.com/res/v1/web/search',
   'GET',
   '[{"name":"q","type":"string","required":true,"description":"Search query"},{"name":"count","type":"integer","required":false,"description":"Number of results (default 5)"}]'::jsonb),

  ('generate_manim_video',
   'Generate a Manim animation from Python code and render it as a video file',
   'cli',
   NULL,
   'CLI',
   '[{"name":"code","type":"string","required":true,"description":"Full ManimCE Python code with Scene class"},{"name":"quality","type":"string","required":false,"description":"low/medium/high"}]'::jsonb),

  ('generate_tts',
   'Generate text-to-speech audio using Edge TTS (free)',
   'cli',
   NULL,
   'CLI',
   '[{"name":"text","type":"string","required":true,"description":"Text to convert"},{"name":"voice","type":"string","required":false,"description":"Voice name"}]'::jsonb)
ON CONFLICT DO NOTHING;

-- ═══ DONE ═══
-- Verify in the Table Editor that you see:
--   agents, tools, agent_tools, agent_knowledge, agent_starters,
--   skills, agent_skills, usage_logs, cron_jobs, video_projects
