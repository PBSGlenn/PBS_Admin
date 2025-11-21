// PBS Admin - Multi-Report Generation Service
// Generate multiple report types from consultation transcripts using Claude API

import Anthropic from "@anthropic-ai/sdk";
import {
  getPromptTemplate,
  generateUserPrompt,
  type PromptTemplate
} from "../prompts/promptTemplates";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

export interface ReportGenerationParams {
  clientName: string;
  petName: string;
  petSpecies: string;
  petBreed?: string;
  petAge?: string;
  petSex?: string;
  consultationDate: string;
  transcript: string;
  questionnaire?: string;
  vetClinicName?: string;
}

export interface ReportGenerationResult {
  content: string;
  template: PromptTemplate;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  error?: string;
}

export interface MultiReportResult {
  comprehensiveReport?: ReportGenerationResult;
  abridgedNotes?: ReportGenerationResult;
  vetReport?: ReportGenerationResult;
  errors: string[];
}

/**
 * Generate a single report using specified prompt template
 */
async function generateSingleReport(
  templateId: string,
  params: ReportGenerationParams
): Promise<ReportGenerationResult> {
  const template = getPromptTemplate(templateId);

  if (!template) {
    throw new Error(`Prompt template not found: ${templateId}`);
  }

  if (!template.enabled) {
    throw new Error(`Prompt template is disabled: ${templateId}`);
  }

  try {
    // Generate user prompt with parameters
    const userPrompt = generateUserPrompt({
      templateId,
      clientName: params.clientName,
      petName: params.petName,
      petSpecies: params.petSpecies,
      consultationDate: params.consultationDate,
      transcript: params.transcript,
      questionnaire: params.questionnaire,
      vetClinicName: params.vetClinicName
    });

    // Call Claude API with prompt caching
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: template.maxTokens,
      system: [
        {
          type: "text",
          text: template.systemPrompt,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    });

    // Extract content from response
    const content = response.content[0].type === "text"
      ? response.content[0].text
      : "";

    // Calculate token usage
    const tokensUsed = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens
    };

    return {
      content,
      template,
      tokensUsed
    };
  } catch (error) {
    console.error(`Failed to generate report (${templateId}):`, error);
    throw error;
  }
}

/**
 * Generate comprehensive clinical report (3-5 pages, markdown)
 * Saved as DOCX in client folder
 */
export async function generateComprehensiveClinicalReport(
  params: ReportGenerationParams
): Promise<ReportGenerationResult> {
  return generateSingleReport("comprehensive-clinical", params);
}

/**
 * Generate abridged clinical notes (1-2 pages, HTML)
 * Saved directly to Event notes field
 */
export async function generateAbridgedClinicalNotes(
  params: ReportGenerationParams
): Promise<ReportGenerationResult> {
  return generateSingleReport("abridged-notes", params);
}

/**
 * Generate veterinary report (3/4-1 page, markdown)
 * Saved as DOCX in client folder, sent to vet
 */
export async function generateVeterinaryReport(
  params: ReportGenerationParams
): Promise<ReportGenerationResult> {
  if (!params.vetClinicName) {
    throw new Error("Vet clinic name is required for veterinary reports");
  }
  return generateSingleReport("vet-report", params);
}

/**
 * Generate multiple reports in parallel
 * Used during consultation event creation
 */
export async function generateConsultationReports(
  params: ReportGenerationParams,
  options: {
    generateComprehensive?: boolean;
    generateAbridged?: boolean;
    generateVet?: boolean;
  } = {
    generateComprehensive: true,
    generateAbridged: true,
    generateVet: false
  }
): Promise<MultiReportResult> {
  const errors: string[] = [];
  const promises: Promise<{ type: string; result: ReportGenerationResult }>[] = [];

  // Queue report generation tasks
  if (options.generateComprehensive) {
    promises.push(
      generateComprehensiveClinicalReport(params)
        .then(result => ({ type: "comprehensive", result }))
        .catch(error => {
          errors.push(`Comprehensive Report: ${error.message}`);
          return { type: "comprehensive", result: null as any };
        })
    );
  }

  if (options.generateAbridged) {
    promises.push(
      generateAbridgedClinicalNotes(params)
        .then(result => ({ type: "abridged", result }))
        .catch(error => {
          errors.push(`Abridged Notes: ${error.message}`);
          return { type: "abridged", result: null as any };
        })
    );
  }

  if (options.generateVet) {
    promises.push(
      generateVeterinaryReport(params)
        .then(result => ({ type: "vet", result }))
        .catch(error => {
          errors.push(`Veterinary Report: ${error.message}`);
          return { type: "vet", result: null as any };
        })
    );
  }

  // Execute all in parallel
  const results = await Promise.all(promises);

  // Organize results by type
  const multiResult: MultiReportResult = { errors };

  results.forEach(({ type, result }) => {
    if (result) {
      if (type === "comprehensive") {
        multiResult.comprehensiveReport = result;
      } else if (type === "abridged") {
        multiResult.abridgedNotes = result;
      } else if (type === "vet") {
        multiResult.vetReport = result;
      }
    }
  });

  return multiResult;
}

/**
 * Estimate token cost for report generation
 * Useful for showing cost estimate before generation
 */
export function estimateReportCost(
  transcriptLength: number,
  questionnaireLength: number = 0,
  reportTypes: ("comprehensive" | "abridged" | "vet")[] = ["comprehensive", "abridged"]
): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
} {
  // Rough estimates:
  // - 1 token ≈ 4 characters
  // - System prompt: ~3000-4000 tokens per template
  // - User prompt: transcript + questionnaire + formatting
  // - Output: varies by template (comprehensive: ~3000-5000, abridged: ~1000-2000, vet: ~800-1200)

  const transcriptTokens = Math.ceil(transcriptLength / 4);
  const questionnaireTokens = Math.ceil(questionnaireLength / 4);
  const userPromptTokens = transcriptTokens + questionnaireTokens + 200; // +200 for formatting

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  reportTypes.forEach(type => {
    const template = getPromptTemplate(
      type === "comprehensive" ? "comprehensive-clinical" :
      type === "abridged" ? "abridged-notes" :
      "vet-report"
    );

    if (template) {
      const systemPromptTokens = Math.ceil(template.systemPrompt.length / 4);
      totalInputTokens += systemPromptTokens + userPromptTokens;

      // Estimate output tokens based on maxTokens
      const estimatedOutput = Math.ceil(template.maxTokens * 0.6); // Assume 60% of max
      totalOutputTokens += estimatedOutput;
    }
  });

  // Pricing (as of 2024, approximate):
  // Claude Sonnet 4: ~$3/million input tokens, ~$15/million output tokens
  const inputCostPer1M = 3.0;
  const outputCostPer1M = 15.0;

  const inputCostUSD = (totalInputTokens / 1_000_000) * inputCostPer1M;
  const outputCostUSD = (totalOutputTokens / 1_000_000) * outputCostPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  return {
    estimatedInputTokens: totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    estimatedCostUSD: parseFloat(totalCostUSD.toFixed(4))
  };
}

/**
 * Parse questionnaire JSON from file
 * Extracts key information for report generation
 */
export function parseQuestionnaireData(questionnaireJson: string): string {
  try {
    const data = JSON.parse(questionnaireJson);

    // Format questionnaire data for AI consumption
    let formatted = "# Client Questionnaire Data\n\n";

    // Extract common fields (adjust based on your questionnaire structure)
    if (data.answers) {
      Object.entries(data.answers).forEach(([qid, answer]: [string, any]) => {
        if (answer && typeof answer === "object" && answer.answer) {
          formatted += `**Q${qid}:** ${answer.answer}\n`;
        } else if (answer) {
          formatted += `**Q${qid}:** ${answer}\n`;
        }
      });
    } else {
      // If raw format, just stringify
      formatted += JSON.stringify(data, null, 2);
    }

    return formatted;
  } catch (error) {
    console.error("Failed to parse questionnaire:", error);
    return questionnaireJson; // Return raw if parsing fails
  }
}

/**
 * Validate report generation parameters
 */
export function validateReportParams(params: ReportGenerationParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!params.clientName?.trim()) {
    errors.push("Client name is required");
  }

  if (!params.petName?.trim()) {
    errors.push("Pet name is required");
  }

  if (!params.petSpecies?.trim()) {
    errors.push("Pet species is required");
  }

  if (!params.consultationDate?.trim()) {
    errors.push("Consultation date is required");
  }

  if (!params.transcript?.trim()) {
    errors.push("Consultation transcript is required");
  }

  if (params.transcript && params.transcript.length < 100) {
    errors.push("Transcript seems too short (minimum 100 characters)");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
