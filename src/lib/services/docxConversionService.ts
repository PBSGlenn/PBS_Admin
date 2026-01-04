// PBS Admin - DOCX Conversion Service
// Convert markdown reports to Word documents using Pandoc

import { invoke } from "@tauri-apps/api/core";

export interface DocxConversionOptions {
  mdFilePath: string;
  clientId: number;
  clientSurname: string;
  consultationDate: string; // YYYYMMDD format
  version: number;
  clientFolderPath: string;
  templateName?: string; // Optional: defaults to "General_PBS_Letterhead.docx"
}

export interface DocxConversionFromContentOptions {
  markdownContent: string;
  clientId: number;
  clientSurname: string;
  consultationDate: string; // YYYYMMDD format
  reportType: 'clientReport' | 'practitionerReport' | 'vetReport';
  version: number;
  clientFolderPath: string;
  templateName?: string; // Optional: defaults to "General_PBS_Letterhead.docx"
}

export interface DocxConversionResult {
  docxFilePath: string;
  docxFileName: string;
  success: boolean;
  error?: string;
}

/**
 * Convert markdown report to DOCX using Pandoc with letterhead template
 */
export async function convertReportToDocx(
  options: DocxConversionOptions
): Promise<DocxConversionResult> {
  const {
    mdFilePath,
    clientId,
    clientSurname,
    consultationDate,
    version,
    clientFolderPath,
    templateName = "General_PBS_Letterhead.docx",
  } = options;

  try {
    // Get templates folder path
    const templatesPath = await invoke<string>("get_templates_path");

    // Build template file path
    const templateFilePath = `${templatesPath}\\${templateName}`;

    // Generate output filename: {surname}_{YYYYMMDD}_consultation-report_v{version}.docx
    const docxFileName = `${clientSurname.toLowerCase()}_${consultationDate}_consultation-report_v${version}.docx`;
    const docxFilePath = `${clientFolderPath}\\${docxFileName}`;

    // Run Pandoc conversion
    await invoke<string>("run_pandoc", {
      inputPath: mdFilePath,
      outputPath: docxFilePath,
      templatePath: templateFilePath,
    });

    // Note: Event tracking removed - calling code (panels) handle their own tracking

    return {
      docxFilePath,
      docxFileName,
      success: true,
    };
  } catch (error) {
    console.error("DOCX conversion failed:", error);
    return {
      docxFilePath: "",
      docxFileName: "",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert markdown content directly to DOCX (skip intermediate .md file)
 * Uses Pandoc stdin input to avoid creating temporary markdown files
 */
export async function convertReportToDocxDirectly(
  options: DocxConversionFromContentOptions
): Promise<DocxConversionResult> {
  const {
    markdownContent,
    clientId,
    clientSurname,
    consultationDate,
    reportType,
    version,
    clientFolderPath,
    templateName = "General_PBS_Letterhead.docx",
  } = options;

  try {
    // Get templates folder path
    const templatesPath = await invoke<string>("get_templates_path");

    // Build template file path
    const templateFilePath = `${templatesPath}\\${templateName}`;

    // Determine report type suffix
    const reportSuffix = reportType === 'clientReport'
      ? 'client-report'
      : reportType === 'practitionerReport'
      ? 'practitioner-report'
      : 'vet-report';

    // Generate output filename: {surname}_{YYYYMMDD}_{report-type}_v{version}.docx
    const docxFileName = `${clientSurname.toLowerCase()}_${consultationDate}_${reportSuffix}_v${version}.docx`;
    const docxFilePath = `${clientFolderPath}\\${docxFileName}`;

    // Run Pandoc with stdin input (markdown content passed directly, no intermediate file)
    await invoke<string>("run_pandoc_from_stdin", {
      markdownContent,
      outputPath: docxFilePath,
      templatePath: templateFilePath,
    });

    // Note: Event tracking removed - calling code (panels) handle their own tracking

    return {
      docxFilePath,
      docxFileName,
      success: true,
    };
  } catch (error) {
    console.error("DOCX conversion failed:", error);
    return {
      docxFilePath: "",
      docxFileName: "",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if Pandoc is installed
 */
export async function checkPandocInstalled(): Promise<boolean> {
  try {
    // Try to run pandoc with --version
    await invoke<string>("run_pandoc", {
      inputPath: "--version",
      outputPath: "",
      templatePath: null,
    });
    return true;
  } catch (error) {
    // If error contains "Is pandoc installed?", it's not installed
    const errorMsg = error instanceof Error ? error.message : String(error);
    return !errorMsg.includes("Is pandoc installed?");
  }
}

/**
 * Get templates folder path
 */
export async function getTemplatesPath(): Promise<string> {
  return invoke<string>("get_templates_path");
}

/**
 * Check if a template file exists
 */
export async function checkTemplateExists(templateName: string): Promise<boolean> {
  try {
    const templatesPath = await getTemplatesPath();
    const templateFilePath = `${templatesPath}\\${templateName}`;

    // Try to list files in templates folder
    const files = await invoke<string[]>("list_files", {
      directory: templatesPath,
      pattern: templateName,
    });

    return files.length > 0;
  } catch (error) {
    console.error("Failed to check template:", error);
    return false;
  }
}
