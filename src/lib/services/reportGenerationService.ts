// PBS Admin - Report Generation Service
// Uses Claude Sonnet 4.5 API to generate consultation reports and follow-up emails

import Anthropic from "@anthropic-ai/sdk";
import { REPORT_SYSTEM_PROMPT, generateReportPrompt } from "../prompts/report-system-prompt";

// API configuration
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5-20250929";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true, // Required for browser usage in Tauri
});

export interface ReportGenerationParams {
  clientName: string;
  petName: string;
  petSpecies: string;
  consultationDate: string;
  transcript: string;
}

export interface GeneratedReport {
  report: string; // Markdown content for practitioner records
  followUpEmail: {
    subject: string;
    body: string;
  };
}

/**
 * Generate consultation report and follow-up email using Claude API
 * Uses prompt caching for cost efficiency on the system prompt
 */
export async function generateConsultationReport(
  params: ReportGenerationParams
): Promise<GeneratedReport> {
  if (!API_KEY) {
    throw new Error("VITE_ANTHROPIC_API_KEY not configured in .env file");
  }

  try {
    const userPrompt = generateReportPrompt(params);

    // Call Claude API with prompt caching
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: REPORT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }, // Cache system prompt
        },
      ],
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in API response");
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse JSON from API response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratedReport;

    // Validate response structure
    if (!parsed.report || !parsed.followUpEmail?.subject || !parsed.followUpEmail?.body) {
      throw new Error("Invalid response structure from API");
    }

    return parsed;
  } catch (error) {
    console.error("Failed to generate consultation report:", error);
    throw error;
  }
}

/**
 * Get token usage and cost estimate for a generation
 * Helpful for debugging and monitoring costs
 */
export function estimateTokenCost(transcriptLength: number): {
  estimatedTokens: number;
  estimatedCostUSD: number;
} {
  // Rough estimate: 1 token ≈ 4 characters
  const estimatedInputTokens = transcriptLength / 4 + 1000; // +1000 for system prompt
  const estimatedOutputTokens = 2000; // Average report length

  // Claude Sonnet 4.5 pricing (as of March 2024)
  const inputCostPer1M = 3.0; // $3 per million input tokens
  const outputCostPer1M = 15.0; // $15 per million output tokens

  const inputCost = (estimatedInputTokens / 1_000_000) * inputCostPer1M;
  const outputCost = (estimatedOutputTokens / 1_000_000) * outputCostPer1M;

  return {
    estimatedTokens: Math.round(estimatedInputTokens + estimatedOutputTokens),
    estimatedCostUSD: Number((inputCost + outputCost).toFixed(4)),
  };
}
