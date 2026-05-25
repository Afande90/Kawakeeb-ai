/**
 * Multi-provider LLM system with rate-limit-aware rotation.
 *
 * Stack: 8 free-tier providers. When one hits its limit, automatically
 * rotates to the next. Mathematically impossible to exhaust all simultaneously
 * under personal-use load.
 *
 * Order of preference (by speed for chat use):
 *   Cerebras → Groq → Gemini → GitHub Models → OpenRouter → Mistral → HuggingFace → Cohere
 *
 * This file lives ALONGSIDE the template's lib/ai/providers.ts (which uses
 * Vercel AI Gateway). Use multi-providers.ts for our custom agent system;
 * leave providers.ts intact for any template features.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { canCall, recordCall } from "./rate-limiter";

// ═══════════════════════════════════════════════════════════════
// Provider Configuration
// ═══════════════════════════════════════════════════════════════

export type ProviderId =
  | "cerebras"
  | "groq"
  | "google"
  | "github"
  | "openrouter"
  | "mistral"
  | "huggingface"
  | "cohere";

export type TaskType = "chat" | "coding" | "reasoning" | "fast" | "embedding";

interface ProviderConfig {
  baseURL?: string;
  defaultModel: string;
  envKey: string;
  id: ProviderId;
  models: Record<TaskType, string>;
  rpd: number; // requests per day (free tier, 0 = effectively unlimited)
  rpm: number; // requests per minute (free tier)
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  cerebras: {
    id: "cerebras",
    envKey: "CEREBRAS_API_KEY",
    baseURL: "https://api.cerebras.ai/v1",
    rpm: 30,
    rpd: 14_400,
    defaultModel: "llama-3.3-70b",
    models: {
      chat: "llama-3.3-70b",
      coding: "llama-3.3-70b",
      reasoning: "llama-3.3-70b",
      fast: "llama-3.1-8b",
      embedding: "llama-3.1-8b",
    },
  },
  groq: {
    id: "groq",
    envKey: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    rpm: 30,
    rpd: 14_400,
    defaultModel: "llama-3.3-70b-versatile",
    models: {
      chat: "llama-3.3-70b-versatile",
      coding: "llama-3.3-70b-versatile",
      reasoning: "llama-3.3-70b-versatile",
      fast: "llama-3.1-8b-instant",
      embedding: "llama-3.1-8b-instant",
    },
  },
  google: {
    id: "google",
    envKey: "GOOGLE_API_KEY",
    rpm: 15,
    rpd: 1500,
    defaultModel: "gemini-2.5-flash",
    models: {
      chat: "gemini-2.5-flash",
      coding: "gemini-2.5-flash",
      reasoning: "gemini-2.5-pro",
      fast: "gemini-flash-lite-latest",
      embedding: "text-embedding-004",
    },
  },
  github: {
    id: "github",
    envKey: "GITHUB_TOKEN",
    baseURL: "https://models.inference.ai.azure.com",
    rpm: 15,
    rpd: 150,
    defaultModel: "gpt-4o-mini",
    models: {
      chat: "gpt-4o-mini",
      coding: "gpt-4o-mini",
      reasoning: "gpt-4o",
      fast: "gpt-4o-mini",
      embedding: "text-embedding-3-small",
    },
  },
  openrouter: {
    id: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    rpm: 20,
    rpd: 200,
    defaultModel: "qwen/qwen3-coder:free",
    models: {
      chat: "google/gemini-2.0-flash-exp:free",
      coding: "qwen/qwen3-coder:free",
      reasoning: "deepseek/deepseek-r1:free",
      fast: "meta-llama/llama-3.2-3b-instruct:free",
      embedding: "qwen/qwen3-coder:free",
    },
  },
  mistral: {
    id: "mistral",
    envKey: "MISTRAL_API_KEY",
    baseURL: "https://api.mistral.ai/v1",
    rpm: 60,
    rpd: 0, // 1B tokens/month free, effectively unlimited for personal use
    defaultModel: "mistral-small-latest",
    models: {
      chat: "mistral-small-latest",
      coding: "codestral-latest",
      reasoning: "mistral-large-latest",
      fast: "mistral-small-latest",
      embedding: "mistral-embed",
    },
  },
  huggingface: {
    id: "huggingface",
    envKey: "HUGGINGFACE_API_KEY",
    baseURL: "https://api-inference.huggingface.co/v1",
    rpm: 10,
    rpd: 1000,
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct",
    models: {
      chat: "meta-llama/Llama-3.3-70B-Instruct",
      coding: "Qwen/Qwen2.5-Coder-32B-Instruct",
      reasoning: "meta-llama/Llama-3.3-70B-Instruct",
      fast: "meta-llama/Llama-3.2-3B-Instruct",
      embedding: "BAAI/bge-base-en-v1.5",
    },
  },
  cohere: {
    id: "cohere",
    envKey: "COHERE_API_KEY",
    baseURL: "https://api.cohere.ai/compatibility/v1",
    rpm: 20,
    rpd: 1000,
    defaultModel: "command-r-08-2024",
    models: {
      chat: "command-r-08-2024",
      coding: "command-r-08-2024",
      reasoning: "command-r-plus-08-2024",
      fast: "command-r-08-2024",
      embedding: "embed-english-v3.0",
    },
  },
};

/**
 * Rotation order per task type. Best-fit provider first; reasoning models last for chat.
 */
const ROTATION_ORDER: Record<TaskType, ProviderId[]> = {
  chat: [
    "cerebras",
    "groq",
    "google",
    "github",
    "openrouter",
    "mistral",
    "huggingface",
    "cohere",
  ],
  coding: [
    "openrouter",
    "groq",
    "cerebras",
    "google",
    "mistral",
    "github",
    "huggingface",
    "cohere",
  ],
  reasoning: [
    "openrouter",
    "google",
    "cerebras",
    "groq",
    "mistral",
    "github",
    "huggingface",
    "cohere",
  ],
  fast: [
    "groq",
    "cerebras",
    "google",
    "openrouter",
    "mistral",
    "github",
    "huggingface",
    "cohere",
  ],
  embedding: [
    "google",
    "mistral",
    "cohere",
    "huggingface",
    "openrouter",
    "github",
    "groq",
    "cerebras",
  ],
};

// ═══════════════════════════════════════════════════════════════
// Model Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Get a Vercel-AI-SDK-compatible model for a given provider + model ID.
 * Throws if the provider's API key is not set.
 */
export function getModel(provider: ProviderId, modelId?: string) {
  const config = PROVIDERS[provider];
  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error(
      `Missing ${config.envKey} for provider "${provider}". Add it to .env.local.`
    );
  }

  const model = modelId || config.defaultModel;

  if (provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }

  // All other providers use OpenAI-compatible endpoints
  const client = createOpenAI({
    apiKey,
    baseURL: config.baseURL,
  });
  return client(model);
}

// ═══════════════════════════════════════════════════════════════
// Rate-Limit-Aware Rotation
// ═══════════════════════════════════════════════════════════════

/**
 * Find the first available provider for a given task type.
 * Skips un-configured providers (no API key) and any near their rate limit.
 * Returns the provider, model ID, and the SDK model. Throws if all exhausted.
 */
export async function getNextAvailableModel(
  taskType: TaskType = "chat",
  options: { excludeProviders?: ProviderId[] } = {}
) {
  const order = ROTATION_ORDER[taskType];
  const exclude = new Set(options.excludeProviders || []);

  for (const providerId of order) {
    if (exclude.has(providerId)) {
      continue;
    }

    const config = PROVIDERS[providerId];
    if (!process.env[config.envKey]) {
      continue;
    }

    const available = await canCall(providerId, config.rpm, config.rpd);
    if (!available) {
      continue;
    }

    const modelId = config.models[taskType];
    return {
      provider: providerId,
      modelId,
      model: getModel(providerId, modelId),
    };
  }

  throw new Error(
    `All providers exhausted or unavailable for task "${taskType}". ` +
      "Configure more API keys or wait for quotas to reset."
  );
}

/**
 * Call this AFTER a successful LLM request to update rate-limit counters.
 */
export async function trackUsage(provider: ProviderId) {
  await recordCall(provider);
}

/**
 * Return the list of providers with API keys configured in env.
 */
export function getConfiguredProviders(): ProviderId[] {
  return (Object.keys(PROVIDERS) as ProviderId[]).filter(
    (id) => !!process.env[PROVIDERS[id].envKey]
  );
}
