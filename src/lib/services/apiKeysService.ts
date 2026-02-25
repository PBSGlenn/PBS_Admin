// PBS Admin - API Keys Service
// Secure storage and retrieval of API keys from SQLite Settings table
// Keys are stored locally on the user's machine, never sent to cloud

import { getSettingJson, setSettingJson, deleteSetting } from "./settingsService";

const API_KEYS_STORAGE_KEY = 'pbs_admin_api_keys';

export interface ApiKeys {
  anthropicApiKey: string | null;
  resendApiKey: string | null;
  openaiApiKey: string | null;
}

const DEFAULT_API_KEYS: ApiKeys = {
  anthropicApiKey: null,
  resendApiKey: null,
  openaiApiKey: null,
};

/**
 * Get all stored API keys
 */
export async function getApiKeys(): Promise<ApiKeys> {
  return getSettingJson<ApiKeys>(API_KEYS_STORAGE_KEY, DEFAULT_API_KEYS);
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
