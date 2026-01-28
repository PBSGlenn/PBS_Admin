// PBS Admin - AI Service
// Secure AI API calls through Tauri backend (API key never exposed to frontend)
// Includes rate limiting to prevent accidental API overuse

import { invoke } from "@tauri-apps/api/core";
import { logger } from "../utils/logger";

export interface AIGenerationResult {
  success: boolean;
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

// Rate limiting state
let lastRequestTime = 0;
let requestsInLastMinute = 0;
let requestsThisMinuteReset = Date.now();

const RATE_LIMIT = {
  minIntervalMs: 2000,      // Minimum 2 seconds between requests
  maxPerMinute: 10,         // Maximum 10 requests per minute
  cooldownMs: 60000,        // 1 minute cooldown if limit exceeded
};

/**
 * Check and update rate limit state
 * Returns error message if rate limited, null if OK to proceed
 */
function checkRateLimit(): string | null {
  const now = Date.now();

  // Reset minute counter if needed
  if (now - requestsThisMinuteReset > 60000) {
    requestsInLastMinute = 0;
    requestsThisMinuteReset = now;
  }

  // Check minimum interval
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT.minIntervalMs) {
    return `Please wait ${Math.ceil((RATE_LIMIT.minIntervalMs - timeSinceLastRequest) / 1000)} seconds before making another request`;
  }

  // Check per-minute limit
  if (requestsInLastMinute >= RATE_LIMIT.maxPerMinute) {
    const timeUntilReset = Math.ceil((60000 - (now - requestsThisMinuteReset)) / 1000);
    return `Rate limit reached (${RATE_LIMIT.maxPerMinute} requests/minute). Please wait ${timeUntilReset} seconds`;
  }

  return null;
}

/**
 * Update rate limit state after successful request
 */
function recordRequest(): void {
  lastRequestTime = Date.now();
  requestsInLastMinute++;
}

/**
 * Generate AI content using Claude API through secure Tauri backend
 * The API key is stored securely on the backend and never exposed to the browser
 * Includes rate limiting to prevent accidental API overuse
 */
export async function generateAIReport(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4000
): Promise<AIGenerationResult> {
  // Check rate limit before making request
  const rateLimitError = checkRateLimit();
  if (rateLimitError) {
    return {
      success: false,
      content: "",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      error: rateLimitError,
    };
  }

  try {
    const result = await invoke<{
      success: boolean;
      content: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    }>("generate_ai_report", {
      systemPrompt,
      userPrompt,
      maxTokens,
    });

    // Record successful request for rate limiting
    recordRequest();

    return {
      success: true,
      content: result.content,
      usage: result.usage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("AI generation failed:", errorMessage);
    return {
      success: false,
      content: "",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      error: errorMessage,
    };
  }
}

/**
 * Check if AI service is available (API key configured)
 */
export async function isAIServiceAvailable(): Promise<boolean> {
  try {
    // Try a minimal request to check if API key is configured
    // This is a lightweight check - actual generation will validate fully
    const result = await invoke<{ success: boolean }>("generate_ai_report", {
      systemPrompt: "test",
      userPrompt: "test",
      maxTokens: 1,
    });
    return true;
  } catch (error) {
    const errorMessage = String(error);
    // If the error is about API key, service is not available
    if (errorMessage.includes("API key not configured")) {
      return false;
    }
    // Other errors (like rate limiting) mean the service is available
    return true;
  }
}
