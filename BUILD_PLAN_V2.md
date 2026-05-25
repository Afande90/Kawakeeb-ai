# Ibrahim AI — Multi-Agent Platform Build Plan v2
## Complete System: Agent Framework + Autonomous Bot + Video Pipeline + Telegram + Skills

---

## WHAT WE'RE BUILDING

A unified platform with five integrated systems:

1. **Agent Framework** — Custom chatbot with admin panel, dynamic agents, webhook tools, knowledge bases
2. **Autonomous Bot** — ThePopeBot running 24/7 with cron jobs, swarm monitoring, GitHub Actions compute
3. **Football Video Pipeline** — Automated Tifo-style tactical analysis videos using Manim + OpenMontage + AI TTS
4. **Telegram Integration** — Chat with any agent from your phone
5. **Teachable Skills System** — Markdown skill files that agents can learn and share

---

## TECH STACK

| Component | Tool | Cost |
|-----------|------|------|
| Chatbot Framework | Next.js (Vercel AI Chatbot template) | Free |
| Database | Supabase | Free tier |
| LLM — Primary | Google Gemini 2.5 Flash | Free (1,500 req/day) |
| LLM — Fast | Groq (Llama 3.3 70B) | Free (rate limited) |
| LLM — Coding | OpenRouter (Qwen3 Coder, DeepSeek R1) | Free models |
| LLM — Fallback | Mistral (1B tokens/month free) | Free |
| Autonomous Agent | ThePopeBot | Free (open source) |
| Job Compute | GitHub Actions | Free (2,000 min/month) |
| Tactical Animations | Manim Community Edition | Free (unlimited) |
| Video Assembly | OpenMontage (52 tools, 12 pipelines) | Free (open source) |
| Media Processing | NCA Toolkit (FFmpeg, Whisper) | Free (self-hosted) |
| AI Voiceover | Google Cloud TTS / Edge TTS | Free tier |
| Image Generation | Gemini image gen / Flux via free providers | Free tier |
| Telegram Bot | python-telegram-bot / ThePopeBot built-in | Free |
| Hosting | Vercel (chatbot) + Docker local + GitHub Actions | Free |
| Container Runtime | Docker Desktop on Windows | Free |

**Total monthly cost: $0**

---

## IMPORTANT CONSTRAINTS

- All LLM providers must be free tier — no paid APIs initially
- The system must support switching models per agent
- Tools are dynamic webhook calls stored in database, NOT hardcoded
- Keep existing template auth, chat history, and streaming intact
- Skills are markdown files loadable by any agent
- Video pipeline must produce 10+ minute videos without credit limits
- Telegram must route to the correct agent based on user selection
- Usage monitoring must track all free tier consumption with alerts at 80%

---

## PHASE 1: Database & Multi-Provider Setup

### 1A. Supabase Database Schema

```sql
-- ═══ CORE AGENT SYSTEM ═══

CREATE TABLE agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL DEFAULT 'You are a helpful assistant.',
  model_provider TEXT NOT NULL DEFAULT 'google',
  model_id TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  icon TEXT DEFAULT '🤖',
  is_active BOOLEAN DEFAULT true,
  telegram_command TEXT, -- e.g. '/triage' to switch to this agent in Telegram
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  tool_type TEXT NOT NULL DEFAULT 'webhook', -- 'webhook', 'cli', 'internal'
  webhook_url TEXT, -- for webhook tools
  cli_command TEXT, -- for CLI tools (manim, higgsfield, etc.)
  http_method TEXT DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  parameters JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE agent_tools (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, tool_id)
);

CREATE TABLE agent_knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE agent_starters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ═══ SKILLS SYSTEM ═══

CREATE TABLE skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- the full markdown skill instructions
  category TEXT DEFAULT 'general', -- 'tactical_analysis', 'coding', 'research', 'content', etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE agent_skills (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

-- ═══ USAGE MONITORING ═══

CREATE TABLE usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  source TEXT DEFAULT 'chat', -- 'chat', 'cron', 'telegram', 'video_pipeline'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══ CRON JOBS ═══

CREATE TABLE cron_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL, -- cron expression
  agent_id UUID REFERENCES agents(id),
  instructions TEXT NOT NULL, -- what the agent should do
  model_provider TEXT, -- override agent's default model for this job
  model_id TEXT,
  is_enabled BOOLEAN DEFAULT false,
  last_run TIMESTAMP WITH TIME ZONE,
  last_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══ VIDEO PIPELINE ═══

CREATE TABLE video_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL, -- the original user request
  script TEXT, -- LLM-generated script
  segments JSONB DEFAULT '[]', -- array of {narration, visual_description, manim_code, duration}
  status TEXT DEFAULT 'draft', -- 'draft', 'scripting', 'rendering', 'assembling', 'complete', 'error'
  output_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══ SEED DATA ═══

-- Default Agents
INSERT INTO agents (name, description, system_prompt, model_provider, model_id, icon, telegram_command) VALUES
('Patient Triage', 'Assess patient symptoms, determine triage priority, and route to clinical teams at ADTC.', 'You are a clinical triage assistant for Abu Dhabi Telemedicine Centre (ADTC). You help Patient Care Coordinators assess incoming patient calls by analyzing symptoms, medical history, and urgency level. You assign triage priorities (1-5) following UAE DOH clinical protocols. Always recommend ED for chest pain, stroke symptoms, or breathing difficulty. Be precise and clinical in assessments but provide patient-friendly scripts the coordinator can read to callers.', 'google', 'gemini-2.5-flash', '🏥', '/triage'),
('Job Hunter', 'Scan UAE healthcare job boards and match positions to your experience.', 'You are a job search assistant specialized in UAE healthcare positions. You search for Patient Care Coordinator, Clinic Coordinator, and healthcare operations roles in Abu Dhabi, Dubai, and across the UAE. When analyzing job descriptions, extract key requirements and match them against the user profile. Always prioritize roles at CCAD, SSMC, SEHA, Mediclinic, and major UAE healthcare providers.', 'google', 'gemini-2.5-flash', '🔍', '/jobs'),
('CV Builder', 'Create tailored two-column ReportLab CVs for UAE healthcare positions.', 'You are a CV specialist for UAE healthcare job applications. You create tailored CVs that mirror exact keywords from job descriptions. Rules: two-column PDF layout (navy sidebar, gold accents), B.Tech degree with NO specialism listed, never include engineering history, never fabricate certifications, always extract and mirror JD keywords into CV bullets.', 'openrouter', 'qwen/qwen3-coder:free', '📝', '/cv'),
('Football Content', 'Generate match analysis, tactical breakdowns, and social media content.', 'You are a football content creator specializing in Premier League, Champions League, and Sudanese football coverage. You generate match analysis scripts, tactical breakdowns, transfer news summaries, and social media posts for YouTube, TikTok, and Twitter. Write with passion and insight. Always include specific stats, player names, and formation details. When asked to create a video, generate a full script broken into segments with visual descriptions for each segment.', 'groq', 'llama-3.3-70b-versatile', '⚽', '/football'),
('n8n Automator', 'Build n8n automation workflows for clients.', 'You are an n8n automation expert. You help design and build webhook-based automations for small businesses — WhatsApp bots, appointment schedulers, content pipelines, email workflows, and CRM integrations. Be specific about node types, connections, and configuration. Always consider error handling.', 'openrouter', 'qwen/qwen3-coder:free', '🤖', '/automate'),
('Research', 'Deep web research on any topic with structured reports.', 'You are a research assistant. You perform thorough research on any topic, compile structured reports with key findings, and cite sources. Present information clearly with sections for summary, key findings, detailed analysis, and sources.', 'google', 'gemini-2.5-flash', '📡', '/research'),
('Coder', 'Write, debug, and execute code. Generate Manim animations, Python scripts, and automation tools.', 'You are an expert software engineer. You write clean, well-tested code in Python, JavaScript, and TypeScript. You can generate Manim animations for football tactical diagrams, build automation scripts, create data analysis pipelines, and debug complex issues. When generating Manim code, always use ManimCE (community edition) syntax. When writing any code, include error handling and comments.', 'openrouter', 'qwen/qwen3-coder:free', '💻', '/code');

-- Default Skills
INSERT INTO skills (name, description, content, category) VALUES
('Football Pressing Analysis', 'How to analyze and compare pressing systems in football', E'# Football Pressing Analysis Framework\n\n## Key Metrics to Evaluate\n- PPDA (Passes Per Defensive Action): Lower = more aggressive press\n- High press percentage: How often the team presses in the opponent''s third\n- Press triggers: What specific events cause the team to initiate pressing\n- Press traps: Where the team tries to win the ball\n- Recovery time: How quickly they transition after losing the ball\n\n## Comparison Framework\nWhen comparing two managers'' pressing systems:\n1. Start with formation and base shape\n2. Identify the first line of press (who initiates)\n3. Map the press triggers (CB receives, GK plays short, etc.)\n4. Show the cover shadows and passing lane blocks\n5. Highlight the pressing trap zones\n6. Compare intensity metrics (PPDA, high press %)\n7. Note the differences in rest defense during the press\n\n## Manim Visualization Guidelines\n- Use a green pitch background (#2d5a27)\n- Home team: red circles, Away team: blue circles\n- Press direction arrows: yellow with 0.3 opacity\n- Cover shadow zones: gray with 0.15 opacity\n- Press trap zone: orange highlight\n- Player labels: white text, 0.3 font size\n- Animate arrows appearing sequentially to show press flow', 'tactical_analysis'),
('Manim Football Diagrams', 'How to generate football pitch diagrams and tactical animations using ManimCE', E'# Manim Football Diagram Generation\n\n## Pitch Setup\n```python\nfrom manim import *\n\nclass FootballPitch(Scene):\n    def construct(self):\n        # Pitch dimensions (scaled to fit scene)\n        pitch = Rectangle(width=10.5, height=6.8, color=WHITE, stroke_width=2)\n        pitch.set_fill(\"#2d5a27\", opacity=1)\n        center_circle = Circle(radius=0.915, color=WHITE, stroke_width=1.5)\n        center_line = Line(UP * 3.4, DOWN * 3.4, color=WHITE, stroke_width=1.5)\n        halfway_dot = Dot(ORIGIN, radius=0.05, color=WHITE)\n        self.add(pitch, center_circle, center_line, halfway_dot)\n```\n\n## Player Representation\n- Use `Dot(radius=0.15)` for players\n- Home team: RED, Away team: BLUE\n- Add `Text(\"Name\", font_size=10)` labels below each dot\n- Group player + label as a VGroup for easy animation\n\n## Animation Patterns\n- Formation display: FadeIn all players simultaneously\n- Press movement: Use `player.animate.move_to(target)` with run_time=1.5\n- Arrow trails: Create `Arrow(start, end)` and use `GrowArrow`\n- Zone highlighting: `Rectangle` with low opacity, use `FadeIn`\n- Transition between formations: `Transform(old_group, new_group)`\n\n## Video Segment Structure\n- Each segment should be a separate Manim Scene class\n- Duration per segment: 15-30 seconds\n- Resolution: 1920x1080 (config.pixel_height=1080, config.pixel_width=1920)\n- FPS: 30', 'coding'),
('Shannon Lens', 'Evaluate content through information theory — signal density, noise ratio, redundancy, and channel capacity', E'# Shannon Lens — Information-Theoretic Content Analysis\n\n## Core Principle\nEvery piece of content has a signal-to-noise ratio. The goal is to maximize information density (signal) while minimizing padding, repetition, and filler (noise).\n\n## Framework\n\n### 1. Signal Identification\n- What is the core insight or claim?\n- Can it be stated in one sentence?\n- If removed, would the content lose its value?\n\n### 2. Noise Detection\n- Filler phrases that add no information\n- Redundant restatements of the same point\n- Tangents that don''t serve the core argument\n- Hedging language that reduces clarity\n\n### 3. Channel Capacity Matching\n- Is the complexity appropriate for the audience?\n- Is the format (video/text/diagram) the right channel for this information?\n- Would a different format transmit the same signal with less noise?\n\n### 4. Compression Test\n- Can this 10-minute video be a 3-minute video without losing signal?\n- If yes, the original has 70% noise\n- Tifo-style content passes this test — high density, low noise\n\n### 5. Redundancy Audit (for reliability)\n- Some redundancy is intentional — repeating key points for retention\n- Distinguish intentional redundancy (good) from lazy repetition (noise)\n\n## Application to Football Content\n- Every segment must introduce new information or a new visual\n- If a segment doesn''t change the viewer''s understanding, cut it\n- Stat graphics should show numbers the narration doesn''t say (complementary channels)\n- Formation diagrams should move — static frames waste the video channel''s capacity', 'content');

-- Default Tools
INSERT INTO tools (name, description, tool_type, webhook_url, http_method, parameters) VALUES
('brave_search', 'Search the web for current information using Brave Search API', 'webhook', 'https://api.search.brave.com/res/v1/web/search', 'GET', '[{"name":"q","type":"string","required":true,"description":"Search query"},{"name":"count","type":"integer","required":false,"description":"Number of results (default 5)"}]'),
('generate_manim_video', 'Generate a Manim animation from Python code and render it as a video file', 'cli', NULL, 'CLI', '[{"name":"code","type":"string","required":true,"description":"Full ManimCE Python code with Scene class"},{"name":"quality","type":"string","required":false,"description":"low_quality, medium_quality, or high_quality (default medium)"},{"name":"format","type":"string","required":false,"description":"mp4 or gif (default mp4)"}]'),
('generate_tts', 'Generate text-to-speech audio from text using Edge TTS (free, no API key)', 'cli', NULL, 'CLI', '[{"name":"text","type":"string","required":true,"description":"Text to convert to speech"},{"name":"voice","type":"string","required":false,"description":"Voice name (default en-GB-RyanNeural)"},{"name":"rate","type":"string","required":false,"description":"Speed adjustment e.g. +10% or -5%"}]'),
('generate_image', 'Generate an image using Gemini or Flux image generation', 'webhook', 'internal://image-generator', 'POST', '[{"name":"prompt","type":"string","required":true,"description":"Image generation prompt"},{"name":"style","type":"string","required":false,"description":"illustrated, photorealistic, flat-vector, diagram"},{"name":"aspect_ratio","type":"string","required":false,"description":"16:9, 9:16, 1:1"}]'),
('assemble_video', 'Stitch multiple video clips, images, and audio into a final video using MoviePy/OpenMontage', 'cli', NULL, 'CLI', '[{"name":"segments","type":"array","required":true,"description":"Array of {type: video|image, path, duration_seconds}"},{"name":"audio_path","type":"string","required":false,"description":"Path to voiceover audio file"},{"name":"output_format","type":"string","required":false,"description":"mp4 (default)"},{"name":"resolution","type":"string","required":false,"description":"1920x1080 (default)"}]');
```

### 1B. Install Dependencies
```bash
npm install @supabase/supabase-js @ai-sdk/google @ai-sdk/openai
```

### 1C. Environment Variables
Add to `.env.local`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM Providers (all free tier)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional
BRAVE_SEARCH_API_KEY=your_brave_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### 1D. Multi-Provider System
Create `lib/ai/providers.ts`:
- Google provider via `@ai-sdk/google`
- Groq provider via `@ai-sdk/openai` with baseURL `https://api.groq.com/openai/v1`
- OpenRouter provider via `@ai-sdk/openai` with baseURL `https://openrouter.ai/api/v1`
- Mistral provider via `@ai-sdk/openai` with baseURL `https://api.mistral.ai/v1`
- `getModel(provider, modelId)` function returning the correct model
- Fallback chain: if provider returns 429/503, try next in chain
- Chain order: Gemini → Groq → OpenRouter → Mistral

---

## PHASE 2: Dynamic Chat Route

### 2A. Modify chat API route
Update `app/(chat)/api/chat/route.ts`:
1. Accept `agentId` in request body
2. Fetch agent from Supabase with joined tools and skills
3. Build system prompt = agent.system_prompt + attached skill contents + knowledge base context
4. Use agent's model_provider/model_id via the provider system
5. Convert database tools into Vercel AI SDK tool definitions
6. For webhook tools: HTTP call to webhook_url
7. For CLI tools: execute command in subprocess
8. For internal tools: call internal handler function
9. Log usage to usage_logs table
10. Stream response back

### 2B. Supabase Client
Create `lib/db/supabase.ts` with helpers:
- `getAgent(id)`, `getAgentWithToolsAndSkills(id)`, `listAgents()`
- `createAgent()`, `updateAgent()`, `deleteAgent()`
- `listTools()`, `createTool()`, `updateTool()`
- `listSkills()`, `createSkill()`, `attachSkillToAgent()`
- `logUsage()`, `getUsageStats()`
- `listCronJobs()`, `createCronJob()`, `updateCronJob()`
- `createVideoProject()`, `updateVideoProject()`

---

## PHASE 3: Admin Panel

### 3A. Admin UI at `/admin`
Three tabs matching Stephen's exact layout:

**General tab:** App name, default model, Telegram bot status

**Agents tab:**
- Agent list/selector
- Edit Agent form: Name, Description (optional), System Prompt (with Expand button), Model Provider dropdown, Model ID dropdown, Conversation Starters with "+ Add Suggestion", Knowledge Base Files with "+ Add File", Attached Skills checklist, Attached Tools checklist
- Hint texts matching Stephen's UI

**Tools tab:**
- Tool list with name, type, method
- Edit: Tool Name, Description, Type (webhook/CLI/internal), Webhook URL, HTTP Method, Headers, Parameters table
- "+ Add Tool" button

**Skills tab (NEW — not in Stephen's version):**
- Skill list with name, category, description
- Edit: Name, Description, Category dropdown, Content (markdown editor)
- "+ Create Skill" button
- "Teach from conversation" button — extracts instructions from a chat and saves as a skill

### 3B. API Routes
```
GET/POST   /api/agents
GET/PUT/DEL /api/agents/[id]
POST       /api/agents/[id]/tools      — attach tool
DELETE     /api/agents/[id]/tools/[tid] — detach tool
POST       /api/agents/[id]/skills     — attach skill
DELETE     /api/agents/[id]/skills/[sid] — detach skill
POST       /api/agents/[id]/knowledge  — upload file
POST       /api/agents/[id]/starters   — add starter
GET/POST   /api/tools
GET/PUT/DEL /api/tools/[id]
GET/POST   /api/skills
GET/PUT/DEL /api/skills/[id]
GET/POST   /api/cron-jobs
GET/PUT/DEL /api/cron-jobs/[id]
GET        /api/usage                  — usage stats
```

---

## PHASE 4: Chat Interface Updates

### 4A. Agent Selector
- Sidebar shows "My Agents" list with icon, name, description
- Click to switch active agent
- Top bar shows active agent name, icon, model badge
- Input bar shows current agent + model label
- Agent's conversation starters appear when starting new chat

### 4B. Tool & Skill Display
- Tool usage shown as green badge: "→ tool_name"
- Skill being used shown as subtle indicator
- Chat history grouped by date, remembers which agent was used

---

## PHASE 5: Usage Monitoring Dashboard

### 5A. Dashboard at `/admin/usage`
- Total calls today / this week / this month per provider
- Token consumption bars per provider
- Free tier progress meters:
  - Gemini: X / 1,500 requests today (progress bar)
  - Groq: current rate usage indicator
  - OpenRouter: estimated usage
  - GitHub Actions: X / 2,000 minutes this month
- Alert banner when any provider exceeds 80%
- Rate limit error log
- Per-agent usage breakdown

---

## PHASE 6: Telegram Integration

### 6A. Telegram Bot Setup
Create a Telegram bot via BotFather. Add bot token to env.

### 6B. Telegram webhook handler
Create `/api/telegram/webhook` route:
1. Receive Telegram message
2. Check for agent switch commands (/triage, /jobs, /football, etc.)
3. Route message to the selected agent
4. Stream response back to Telegram chat
5. Support file uploads (images, PDFs) for analysis
6. Log usage with source='telegram'

### 6C. Commands
- `/agents` — list available agents
- `/triage` `/jobs` `/cv` `/football` `/automate` `/research` `/code` — switch agent
- `/status` — show current agent + usage stats
- `/cron` — list cron jobs and their statuses

---

## PHASE 7: Football Video Pipeline

### 7A. Install Manim + OpenMontage
```bash
pip install manim --break-system-packages
pip install moviepy edge-tts --break-system-packages
# Clone OpenMontage for advanced assembly
git clone https://github.com/calesthio/OpenMontage.git /home/tools/openmontage
```

### 7B. Video Generation Pipeline
When a user asks the Football Content agent to "create a video":

**Step 1 — Script Generation (LLM)**
Agent writes a full script broken into 20-30 segments. Each segment has:
```json
{
  "segment_number": 1,
  "narration": "Michael Carrick's Middlesbrough have been one of the most interesting tactical stories in the Championship this season.",
  "visual_type": "character_image",
  "visual_description": "Illustrated portrait of Michael Carrick in flat vector art style, navy background, Middlesbrough FC colors",
  "duration_seconds": 8
}
```

**Step 2 — Asset Generation (parallel)**
- For `visual_type: "tactical_diagram"` → Generate Manim Python code → Render with ManimCE
- For `visual_type: "character_image"` → Generate via Gemini image API or Flux free tier
- For `visual_type: "stat_graphic"` → Generate via Manim (bar charts, tables)
- For `visual_type: "title_card"` → Generate via Manim (text animation)

**Step 3 — Voiceover (Edge TTS, completely free)**
```python
import edge_tts
communicate = edge_tts.Communicate(full_narration_text, "en-GB-RyanNeural")
await communicate.save("voiceover.mp3")
```
Edge TTS is Microsoft's free TTS — no API key, no limits, high quality voices.

**Step 4 — Assembly (MoviePy)**
```python
from moviepy.editor import *
clips = []
for segment in segments:
    if segment.visual_type == "tactical_diagram":
        clip = VideoFileClip(segment.rendered_path)
    else:
        clip = ImageClip(segment.image_path).set_duration(segment.duration)
    clips.append(clip)
final = concatenate_videoclips(clips)
audio = AudioFileClip("voiceover.mp3")
final = final.set_audio(audio)
final.write_videofile("output.mp4", fps=30)
```

**Step 5 — Save and notify**
Store output URL in video_projects table. Send notification via Telegram.

### 7C. Video Agent Tool
The `Football Content` agent gets these tools:
- `generate_manim_video` — renders Manim code as video
- `generate_tts` — creates voiceover from text
- `generate_image` — creates character illustrations
- `assemble_video` — stitches everything together

The agent orchestrates the pipeline by calling tools in sequence.

---

## PHASE 8: Cron Jobs & Swarm

### 8A. Cron job execution
Create a lightweight cron runner that:
1. Reads enabled cron jobs from Supabase
2. At each scheduled time, creates a GitHub Actions workflow dispatch
3. The GitHub Action runs the agent with the cron job's instructions
4. Results are saved to Supabase and notification sent

### 8B. Swarm monitoring at `/admin/swarm`
- List of all job runs with status (success/failure/skipped)
- Time ago, duration, agent used
- Click to view job output
- Refresh button

### 8C. Notifications at `/admin/notifications`
- Job completion summaries
- Rate limit warnings
- Video generation completion
- New job postings found

---

## PHASE 9: Provider Fallback & Smart Routing

### 9A. Automatic failover
If primary provider returns 429/503:
1. Log the error in usage_logs
2. Try next provider in chain: Gemini → Groq → OpenRouter → Mistral
3. If all fail, queue the request and retry in 60 seconds
4. Notify user of degraded service

### 9B. Per-cron-job model override
Each cron job can specify its own model_provider and model_id:
- Job scanner: Gemini Flash (free, good at search summarization)
- CV generation: Qwen3 Coder via OpenRouter (free, good at structured writing)
- Football scripts: Llama 3.3 via Groq (free, fast, creative)
- Code generation: DeepSeek R1 via OpenRouter (free, best at reasoning)

---

## FILE STRUCTURE

```
lib/
  db/
    supabase.ts              — Supabase client + all helper functions
  ai/
    providers.ts             — Multi-provider setup with fallback
    tools-executor.ts        — Execute webhook/CLI/internal tools
    usage-logger.ts          — Log all LLM calls
    skills-loader.ts         — Load and inject skills into prompts
  video/
    script-generator.ts      — LLM generates video scripts
    manim-renderer.ts        — Execute Manim code and return video path
    tts-generator.ts         — Edge TTS voiceover generation
    video-assembler.ts       — MoviePy assembly of final video
    pipeline.ts              — Orchestrate the full pipeline
app/
  (chat)/
    api/
      chat/
        route.ts             — MODIFIED: dynamic agent + skills + tools
    page.tsx                 — MODIFIED: agent selector, starters
  admin/
    page.tsx                 — Admin panel (General, Agents, Tools, Skills tabs)
    usage/
      page.tsx               — Usage monitoring dashboard
    swarm/
      page.tsx               — Job monitoring
    notifications/
      page.tsx               — Notification feed
  api/
    agents/                  — Agent CRUD
    tools/                   — Tool CRUD
    skills/                  — Skill CRUD
    cron-jobs/               — Cron job CRUD
    telegram/
      webhook/
        route.ts             — Telegram message handler
    video/
      generate/
        route.ts             — Trigger video pipeline
      [id]/
        route.ts             — Check video status
    usage/
      route.ts               — Usage stats API
components/
  agent-selector.tsx
  agent-editor.tsx
  tool-editor.tsx
  skill-editor.tsx
  usage-dashboard.tsx
  swarm-monitor.tsx
  notification-feed.tsx
```

---

## EXECUTION ORDER FOR CLAUDE CODE

Give Claude Code these commands one phase at a time:

```
Phase 1: "Read BUILD_PLAN_V2.md. Execute Phase 1 only. Set up Supabase schema, install dependencies, create multi-provider system, add environment variable template."

Phase 2: "Read BUILD_PLAN_V2.md. Execute Phase 2. Create the Supabase client helpers and modify the chat route for dynamic agent loading with skills and tools."

Phase 3: "Read BUILD_PLAN_V2.md. Execute Phase 3. Build the admin panel at /admin with General, Agents, Tools, and Skills tabs. Include all API routes."

Phase 4: "Read BUILD_PLAN_V2.md. Execute Phase 4. Update the chat interface with agent selector, tool usage display, and conversation starters."

Phase 5: "Read BUILD_PLAN_V2.md. Execute Phase 5. Build the usage monitoring dashboard with free tier progress meters."

Phase 6: "Read BUILD_PLAN_V2.md. Execute Phase 6. Set up Telegram bot integration with agent switching commands."

Phase 7: "Read BUILD_PLAN_V2.md. Execute Phase 7. Build the football video pipeline with Manim, Edge TTS, and MoviePy assembly."

Phase 8: "Read BUILD_PLAN_V2.md. Execute Phase 8. Build cron job execution via GitHub Actions, swarm monitor, and notification system."

Phase 9: "Read BUILD_PLAN_V2.md. Execute Phase 9. Add provider fallback chain and per-job model overrides."
```

---

## PREREQUISITES CHECKLIST

Before starting, you need:
- [ ] Docker Desktop installed on Windows
- [ ] Node.js (LTS) installed
- [ ] Git installed
- [ ] Python 3.12+ installed
- [ ] GitHub account with fine-grained token
- [ ] Supabase account (free) — create project, get URL + service role key
- [ ] Google AI Studio account — get Gemini API key
- [ ] Groq account — get API key
- [ ] OpenRouter account — get API key
- [ ] Brave Search account (free) — get API key
- [ ] Telegram bot created via @BotFather — get bot token
- [ ] Vercel chatbot template cloned locally
