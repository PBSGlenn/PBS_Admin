// PBS Admin - DOCX Conversion Service
// Convert markdown reports to Word documents using Pandoc

import { invoke } from "@tauri-apps/api/core";
import { createEvent } from "./eventService";

export interface DocxConversionOptions {
  mdFilePath: string;
  clientId: number;
  clientSurname: string;
  consultationDate: string; // YYYYMMDD format
  version: number;
  clientFolderPath: string;
  templateName?: string; // Optional: defaults to "consultation-report-template.docx"
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
    templateName = "consultation-report-template.docx",
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

    // Create event tracking the conversion
    await createEvent({
      clientId,
      eventType: "Note",
      date: new Date().toISOString(),
      notes: `<h2>Consultation Report Converted to DOCX</h2><p><strong>File:</strong> ${docxFileName}</p><p><strong>Source:</strong> ${mdFilePath.split('\\').pop()}</p><p><strong>Template:</strong> ${templateName}</p><p>Report converted to Word document with letterhead template.</p>`,
    });

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
