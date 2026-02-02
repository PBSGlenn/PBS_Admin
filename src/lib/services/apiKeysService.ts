// PBS Admin - API Keys Service
// Secure storage and retrieval of API keys from localStorage
// Keys are stored locally on the user's machine, never sent to cloud

const API_KEYS_STORAGE_KEY = 'pbs_admin_api_keys';

export interface ApiKeys {
  anthropicApiKey: string | null;
  resendApiKey: string | null;
}

const DEFAULT_API_KEYS: ApiKeys = {
  anthropicApiKey: null,
  resendApiKey: null,
};

/**
 * Get all stored API keys
 */
export function getApiKeys(): ApiKeys {
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_API_KEYS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load API keys from localStorage:', error);
  }
  return DEFAULT_API_KEYS;
}

/**
 * Save API keys to localStorage
 */
export function saveApiKeys(keys: Partial<ApiKeys>): void {
  try {
    const current = getApiKeys();
    const updated = { ...current, ...keys };
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save API keys to localStorage:', error);
    throw new Error('Failed to save API keys');
  }
}

/**
 * Get Anthropic API key
 * Falls back to environment variable for development
 */
export function getAnthropicApiKey(): string | null {
  const keys = getApiKeys();
  // First check localStorage (user-configured)
  if (keys.anthropicApiKey) {
    return keys.anthropicApiKey;
  }
  // Fall back to environment variable (development)
  const envKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (envKey) {
    return envKey;
  }
  return null;
}

/**
 * Get Resend API key
 * Falls back to environment variable for development
 */
export function getResendApiKey(): string | null {
  const keys = getApiKeys();
  // First check localStorage (user-configured)
  if (keys.resendApiKey) {
    return keys.resendApiKey;
  }
  // Fall back to environment variable (development)
  const envKey = import.meta.env.VITE_RESEND_API_KEY;
  if (envKey) {
    return envKey;
  }
  return null;
}

/**
 * Check if Anthropic API key is configured
 */
export function isAnthropicConfigured(): boolean {
  return getAnthropicApiKey() !== null;
}

/**
 * Check if Resend API key is configured
 */
export function isResendConfigured(): boolean {
  return getResendApiKey() !== null;
}

/**
 * Clear all stored API keys
 */
export function clearApiKeys(): void {
  localStorage.removeItem(API_KEYS_STORAGE_KEY);
}

/**
 * Mask API key for display (show first 8 and last 4 characters)
 */
export function maskApiKey(key: string | null): string {
  if (!key) return '';
  if (key.length <= 12) return '••••••••';
  return `${key.substring(0, 8)}••••${key.substring(key.length - 4)}`;
}
