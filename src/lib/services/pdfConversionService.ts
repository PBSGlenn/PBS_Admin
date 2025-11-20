// PBS Admin - PDF Conversion Service
// Convert DOCX reports to PDF using MS Word COM automation

import { invoke } from "@tauri-apps/api/core";
import { createEvent } from "./eventService";
import { format } from "date-fns";

export interface PdfConversionOptions {
  docxFilePath: string;
  clientId: number;
  clientFolderPath: string;
  petName: string;
  consultationDate: string; // ISO string
}

export interface PdfConversionResult {
  pdfFilePath: string;
  pdfFileName: string;
  success: boolean;
  error?: string;
}

/**
 * Convert DOCX report to PDF using MS Word
 * Creates client-friendly filename: {PetName}_Consultation_Report_{Date}.pdf
 */
export async function convertReportToPdf(
  options: PdfConversionOptions
): Promise<PdfConversionResult> {
  const {
    docxFilePath,
    clientId,
    clientFolderPath,
    petName,
    consultationDate,
  } = options;

  try {
    // Generate client-friendly PDF filename
    const dateFormatted = format(new Date(consultationDate), "ddMMMyyyy"); // e.g., "17Nov2025"
    const pdfFileName = `${petName}_Consultation_Report_${dateFormatted}.pdf`;
    const pdfFilePath = `${clientFolderPath}\\${pdfFileName}`;

    // Run Word COM automation via PowerShell
    await invoke<string>("convert_docx_to_pdf", {
      docxPath: docxFilePath,
      pdfPath: pdfFilePath,
    });

    // Create event tracking the conversion
    await createEvent({
      clientId,
      eventType: "Note",
      date: new Date().toISOString(),
      notes: `<h2>Consultation Report Converted to PDF</h2><p><strong>File:</strong> ${pdfFileName}</p><p><strong>Source:</strong> ${docxFilePath.split('\\').pop()}</p><p>Report converted to PDF for client delivery.</p>`,
    });

    return {
      pdfFilePath,
      pdfFileName,
      success: true,
    };
  } catch (error) {
    console.error("PDF conversion failed:", error);
    return {
      pdfFilePath: "",
      pdfFileName: "",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
