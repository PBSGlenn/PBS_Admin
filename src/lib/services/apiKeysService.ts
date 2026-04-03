// PBS Admin - API Keys Service
// Secure storage and retrieval of API keys from SQLite Settings table
// Keys are stored locally on the user's machine, never sent to cloud

import { getSettingJson, setSettingJson, deleteSetting } from "./settingsService";
import { ApiKeysSchema, AIModelConfigSchema, safeParse } from "../schemas";

const API_KEYS_STORAGE_KEY = 'pbs_admin_api_keys';

export interface ApiKeys {
  anthropicApiKey: string | null;
  resendApiKey: string | null;
  openaiApiKey: string | null;
  perplexityApiKey: string | null;
}

const DEFAULT_API_KEYS: ApiKeys = {
  anthropicApiKey: null,
  resendApiKey: null,
  openaiApiKey: null,
  perplexityApiKey: null,
};

/**
 * Get all stored API keys
 */
export async function getApiKeys(): Promise<ApiKeys> {
  const raw = await getSettingJson<ApiKeys>(API_KEYS_STORAGE_KEY, DEFAULT_API_KEYS);
  return safeParse(ApiKeysSchema, raw, DEFAULT_API_KEYS, "API keys");
}

/**
 * Save API keys
 */
export async function saveApiKeys(keys: Partial<ApiKeys>): Promise<void> {
  const current = await getApiKeys();
  const updated = { ...current, ...keys };
  await setSettingJson(API_KEYS_STORAGE_KEY, updated);
}

/**
 * Get Anthropic API key
 * Falls back to environment variable for development
 */
export async function getAnthropicApiKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.anthropicApiKey) {
    return keys.anthropicApiKey;
  }
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (envKey) {
    return envKey;
  }
  return null;
}

/**
 * Get OpenAI API key
 * Falls back to environment variable for development
 */
export async function getOpenAIApiKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.openaiApiKey) {
    return keys.openaiApiKey;
  }
  const envKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (envKey) {
    return envKey;
  }
  return null;
}

/**
 * Check if OpenAI API key is configured
 */
export async function isOpenAIConfigured(): Promise<boolean> {
  return (await getOpenAIApiKey()) !== null;
}

/**
 * Get Resend API key
 * Falls back to environment variable for development
 */
export async function getResendApiKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.resendApiKey) {
    return keys.resendApiKey;
  }
  const envKey = import.meta.env.VITE_RESEND_API_KEY;
  if (envKey) {
    return envKey;
  }
  return null;
}

/**
 * Check if Anthropic API key is configured
 */
export async function isAnthropicConfigured(): Promise<boolean> {
  return (await getAnthropicApiKey()) !== null;
}

/**
 * Check if Resend API key is configured
 */
export async function isResendConfigured(): Promise<boolean> {
  return (await getResendApiKey()) !== null;
}

/**
 * Get Perplexity API key
 * Falls back to environment variable for development
 */
export async function getPerplexityApiKey(): Promise<string | null> {
  const keys = await getApiKeys();
  if (keys.perplexityApiKey) {
    return keys.perplexityApiKey;
  }
  const envKey = import.meta.env.VITE_PERPLEXITY_API_KEY;
  if (envKey) {
    return envKey;
  }
  return null;
}

/**
 * Check if Perplexity API key is configured
 */
export async function isPerplexityConfigured(): Promise<boolean> {
  return (await getPerplexityApiKey()) !== null;
}

/**
 * Clear all stored API keys
 */
export async function clearApiKeys(): Promise<void> {
  await deleteSetting(API_KEYS_STORAGE_KEY);
}

/**
 * Mask API key for display (show first 8 and last 4 characters)
 */
export function maskApiKey(key: string | null): string {
  if (!key) return '';
  if (key.length <= 12) return '••••••••';
  return `${key.substring(0, 8)}••••${key.substring(key.length - 4)}`;
}

// ============================================================================
// AI MODEL CONFIGURATION
// ============================================================================

const AI_MODEL_CONFIG_KEY = 'pbs_admin_ai_model_config';

export interface AIModelConfig {
  /** Model for report generation (Claude Opus) */
  reportModel: string;
  /** Model for task extraction (Claude Sonnet - lighter/cheaper) */
  taskExtractionModel: string;
}

const DEFAULT_AI_MODEL_CONFIG: AIModelConfig = {
  reportModel: "claude-opus-4-6",
  taskExtractionModel: "claude-sonnet-4-5-20250929",
};

// Map of deprecated model IDs to their current replacements
const DEPRECATED_MODEL_IDS: Record<string, string> = {
  "claude-opus-4-6-20260205": "claude-opus-4-6",
};

/** Get current AI model configuration */
export async function getAIModelConfig(): Promise<AIModelConfig> {
  const raw = await getSettingJson<AIModelConfig>(AI_MODEL_CONFIG_KEY, DEFAULT_AI_MODEL_CONFIG);
  const config = safeParse(AIModelConfigSchema, raw, DEFAULT_AI_MODEL_CONFIG, "AI model config");

  // Auto-fix deprecated model IDs
  let updated = false;
  if (DEPRECATED_MODEL_IDS[config.reportModel]) {
    config.reportModel = DEPRECATED_MODEL_IDS[config.reportModel];
    updated = true;
  }
  if (DEPRECATED_MODEL_IDS[config.taskExtractionModel]) {
    config.taskExtractionModel = DEPRECATED_MODEL_IDS[config.taskExtractionModel];
    updated = true;
  }
  if (updated) {
    await setSettingJson(AI_MODEL_CONFIG_KEY, config);
  }

  return config;
}

/** Save AI model configuration */
export async function saveAIModelConfig(config: Partial<AIModelConfig>): Promise<void> {
  const current = await getAIModelConfig();
  await setSettingJson(AI_MODEL_CONFIG_KEY, { ...current, ...config });
}

/** Get the default model config (for reset functionality) */
export function getDefaultAIModelConfig(): AIModelConfig {
  return { ...DEFAULT_AI_MODEL_CONFIG };
}
