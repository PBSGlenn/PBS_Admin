// PBS Admin - Report Generation Service
// Uses Claude API to generate consultation reports and follow-up emails
// API calls are made through secure Tauri backend - API key never exposed to browser

import { REPORT_SYSTEM_PROMPT, generateReportPrompt } from "../prompts/report-system-prompt";
import { generateAIReport } from "./aiService";

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
 * API call made through secure Tauri backend
 */
export async function generateConsultationReport(
  params: ReportGenerationParams
): Promise<GeneratedReport> {
  const userPrompt = generateReportPrompt(params);

  // Call Claude API through secure Tauri backend
  const result = await generateAIReport(REPORT_SYSTEM_PROMPT, userPrompt, 4096);

  if (!result.success) {
    throw new Error(result.error || "AI generation failed");
  }

  // Parse JSON response
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse JSON from API response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedReport;

  // Validate response structure
  if (!parsed.report || !parsed.followUpEmail?.subject || !parsed.followUpEmail?.body) {
    throw new Error("Invalid response structure from API");
  }

  return parsed;
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
