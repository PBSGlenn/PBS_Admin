// PBS Admin - Multi-Report Generation Service
// Generate multiple report types from consultation transcripts using Claude API
// API calls are made through secure Tauri backend - API key never exposed to browser

import {
  getPromptTemplate,
  generateUserPrompt,
  type PromptTemplate
} from "../prompts/promptTemplates";
import { generateAIReport } from "./aiService";

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
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  comprehensiveClinicalReport?: string;
  /**
   * Authoritative per-pet signalment block, built from the Pet DB record.
   * One line per pet, e.g.:
   *   "Chase — American Staffordshire Terrier, Male Neutered, approximately 6 years old, 30 kg"
   * When supplied, the client-report generator uses this verbatim for the
   * header and does NOT extract signalment from the transcript or the
   * comprehensive clinical report.
   */
  signalment?: string;
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
  clientReport?: ReportGenerationResult;
  practitionerReport?: ReportGenerationResult;
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
  const template = await getPromptTemplate(templateId);

  if (!template) {
    throw new Error(`Prompt template not found: ${templateId}`);
  }

  if (!template.enabled) {
    throw new Error(`Prompt template is disabled: ${templateId}`);
  }

  // Generate user prompt and process system prompt variables
  const { userPrompt, processedSystemPrompt } = await generateUserPrompt({
    templateId,
    clientName: params.clientName,
    petName: params.petName,
    petSpecies: params.petSpecies,
    petBreed: params.petBreed,
    petAge: params.petAge,
    petSex: params.petSex,
    consultationDate: params.consultationDate,
    transcript: params.transcript,
    questionnaire: params.questionnaire,
    vetClinicName: params.vetClinicName,
    clientAddress: params.clientAddress,
    clientPhone: params.clientPhone,
    clientEmail: params.clientEmail,
    comprehensiveClinicalReport: params.comprehensiveClinicalReport,
    signalment: params.signalment,
  });

  // Call Claude API with processed system prompt (variables injected)
  const result = await generateAIReport(
    processedSystemPrompt,
    userPrompt,
    template.maxTokens
  );

  if (!result.success) {
    throw new Error(result.error || "AI generation failed");
  }

  return {
    content: result.content,
    template,
    tokensUsed: {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
      total: result.usage.total_tokens
    }
  };
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
 * Generate client report (client-facing consultation summary, markdown)
 * Saved as DOCX/PDF in client folder, sent to client via email
 */
export async function generateClientReport(
  params: ReportGenerationParams
): Promise<ReportGenerationResult> {
  return generateSingleReport("client-report", params);
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
 * Generate multiple reports with comprehensive clinical report as source of truth.
 *
 * Generation order:
 * 1. Comprehensive clinical report generated FIRST (if enabled)
 * 2. Client report uses comprehensive report as primary source (sequential dependency)
 * 3. Abridged notes, practitioner, and vet reports run in parallel with step 2
 */
export async function generateConsultationReports(
  params: ReportGenerationParams,
  options: {
    generateComprehensive?: boolean;
    generateAbridged?: boolean;
    generateClient?: boolean;
    generatePractitioner?: boolean;
    generateVet?: boolean;
  } = {
    generateComprehensive: true,
    generateAbridged: true,
    generateClient: true,
    generatePractitioner: false,
    generateVet: false
  }
): Promise<MultiReportResult> {
  const errors: string[] = [];
  const multiResult: MultiReportResult = { errors };

  // Step 1: Generate comprehensive clinical report FIRST (if enabled)
  // This becomes the source of truth for the client report
  let comprehensiveContent: string | undefined;

  if (options.generateComprehensive) {
    try {
      const comprehensiveResult = await generateComprehensiveClinicalReport(params);
      multiResult.comprehensiveReport = comprehensiveResult;
      comprehensiveContent = comprehensiveResult.content;
    } catch (error: any) {
      errors.push(`Comprehensive Report: ${error.message}`);
    }
  }

  // Step 2: Generate remaining reports in parallel
  // Client report receives comprehensive content as source of truth
  const parallelPromises: Promise<{ type: string; result: ReportGenerationResult }>[] = [];

  if (options.generateClient) {
    const clientParams = comprehensiveContent
      ? { ...params, comprehensiveClinicalReport: comprehensiveContent }
      : params;
    parallelPromises.push(
      generateClientReport(clientParams)
        .then(result => ({ type: "client", result }))
        .catch(error => {
          errors.push(`Client Report: ${error.message}`);
          return { type: "client", result: null as any };
        })
    );
  }

  if (options.generateAbridged) {
    parallelPromises.push(
      generateAbridgedClinicalNotes(params)
        .then(result => ({ type: "abridged", result }))
        .catch(error => {
          errors.push(`Abridged Notes: ${error.message}`);
          return { type: "abridged", result: null as any };
        })
    );
  }

  if (options.generatePractitioner) {
    parallelPromises.push(
      generateComprehensiveClinicalReport(params)
        .then(result => ({ type: "practitioner", result }))
        .catch(error => {
          errors.push(`Practitioner Report: ${error.message}`);
          return { type: "practitioner", result: null as any };
        })
    );
  }

  if (options.generateVet) {
    parallelPromises.push(
      generateVeterinaryReport(params)
        .then(result => ({ type: "vet", result }))
        .catch(error => {
          errors.push(`Veterinary Report: ${error.message}`);
          return { type: "vet", result: null as any };
        })
    );
  }

  // Execute remaining reports in parallel
  if (parallelPromises.length > 0) {
    const results = await Promise.all(parallelPromises);

    results.forEach(({ type, result }) => {
      if (result) {
        if (type === "abridged") {
          multiResult.abridgedNotes = result;
        } else if (type === "client") {
          multiResult.clientReport = result;
        } else if (type === "practitioner") {
          multiResult.practitionerReport = result;
        } else if (type === "vet") {
          multiResult.vetReport = result;
        }
      }
    });
  }

  return multiResult;
}

/**
 * Estimate token cost for report generation
 * Useful for showing cost estimate before generation
 */
export async function estimateReportCost(
  transcriptLength: number,
  questionnaireLength: number = 0,
  reportTypes: ("comprehensive" | "abridged" | "client" | "vet")[] = ["comprehensive", "abridged", "client"]
): Promise<{
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUSD: number;
}> {
  // Rough estimates:
  // - 1 token ≈ 4 characters
  // - System prompt: ~3000-4000 tokens per template
  // - User prompt: transcript + questionnaire + formatting
  // - Output: varies by template (comprehensive: ~3000-5000, abridged: ~1000-2000, client: ~2500-4000, vet: ~800-1200)

  const transcriptTokens = Math.ceil(transcriptLength / 4);
  const questionnaireTokens = Math.ceil(questionnaireLength / 4);
  const userPromptTokens = transcriptTokens + questionnaireTokens + 200; // +200 for formatting

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const type of reportTypes) {
    const template = await getPromptTemplate(
      type === "comprehensive" ? "comprehensive-clinical" :
      type === "abridged" ? "abridged-notes" :
      type === "client" ? "client-report" :
      "vet-report"
    );

    if (template) {
      const systemPromptTokens = Math.ceil(template.systemPrompt.length / 4);
      totalInputTokens += systemPromptTokens + userPromptTokens;

      // Estimate output tokens based on maxTokens
      const estimatedOutput = Math.ceil(template.maxTokens * 0.6); // Assume 60% of max
      totalOutputTokens += estimatedOutput;
    }
  }

  // Claude Opus 4.6 pricing (February 2026)
  const inputCostPer1M = 15.0;
  const outputCostPer1M = 75.0;

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
