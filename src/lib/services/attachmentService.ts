// PBS Admin - Attachment Discovery Service
// Finds files in client folders for email attachments

import { invoke } from "@tauri-apps/api/core";

/**
 * File type classification
 */
export type AttachmentFileType = "pdf" | "docx" | "txt" | "json" | "other";

/**
 * File category based on naming patterns
 */
export type AttachmentCategory =
  | "client-report"
  | "vet-report"
  | "clinical-notes"
  | "transcript"
  | "questionnaire"
  | "prescription"
  | "protocol"
  | "other";

/**
 * Represents a discoverable file in the client folder
 */
export interface AttachmentFile {
  name: string;
  path: string;
  type: AttachmentFileType;
  category: AttachmentCategory;
  date?: string; // YYYYMMDD extracted from filename
  version?: number; // Version number if present (e.g., _v2)
}

/**
 * Options for filtering attachments
 */
export interface AttachmentFilterOptions {
  dateFilter?: string; // YYYYMMDD format
  categoryFilter?: AttachmentCategory;
  extensionFilter?: string[]; // e.g., ['.pdf', '.docx']
  typeFilter?: AttachmentFileType;
}

/**
 * Find files in client folder matching criteria
 * @param clientFolderPath Full path to client folder
 * @param options Optional filters to narrow results
 * @returns List of matching files with metadata
 */
export async function findClientAttachments(
  clientFolderPath: string,
  options?: AttachmentFilterOptions
): Promise<AttachmentFile[]> {
  if (!clientFolderPath) {
    return [];
  }

  try {
    const entries = await invoke<Array<{ name: string; isDirectory: boolean }>>(
      "plugin:fs|read_dir",
      { path: clientFolderPath }
    );

    const files: AttachmentFile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const file = parseFileName(entry.name, clientFolderPath);

      // Apply filters
      if (options?.dateFilter && file.date !== options.dateFilter) {
        continue;
      }
      if (options?.categoryFilter && file.category !== options.categoryFilter) {
        continue;
      }
      if (options?.typeFilter && file.type !== options.typeFilter) {
        continue;
      }
      if (options?.extensionFilter) {
        const ext = "." + file.type;
        if (
          !options.extensionFilter.some(
            (e) => e.toLowerCase() === ext.toLowerCase()
          )
        ) {
          continue;
        }
      }

      files.push(file);
    }

    // Sort by date (newest first), then by version (highest first)
    files.sort((a, b) => {
      if (a.date && b.date) {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
      }
      return (b.version || 0) - (a.version || 0);
    });

    return files;
  } catch (error) {
    console.error("Failed to list client folder:", error);
    return [];
  }
}

/**
 * Parse filename to extract metadata
 */
function parseFileName(name: string, folderPath: string): AttachmentFile {
  const path = `${folderPath}\\${name}`;
  const ext = name.split(".").pop()?.toLowerCase() || "";

  // Determine file type
  let type: AttachmentFileType = "other";
  if (ext === "pdf") type = "pdf";
  else if (ext === "docx") type = "docx";
  else if (ext === "txt") type = "txt";
  else if (ext === "json") type = "json";

  // Determine category from filename patterns
  let category: AttachmentCategory = "other";
  const lowerName = name.toLowerCase();

  if (lowerName.includes("client-report")) {
    category = "client-report";
  } else if (lowerName.includes("vet-report")) {
    category = "vet-report";
  } else if (
    lowerName.includes("clinical") ||
    lowerName.includes("practitioner-report") ||
    lowerName.includes("comprehensive-clinical")
  ) {
    category = "clinical-notes";
  } else if (lowerName.includes("transcript")) {
    category = "transcript";
  } else if (lowerName.includes("questionnaire")) {
    category = "questionnaire";
  } else if (lowerName.includes("prescription")) {
    category = "prescription";
  } else if (lowerName.includes("protocol")) {
    category = "protocol";
  }

  // Extract date (pattern: _YYYYMMDD_)
  const dateMatch = name.match(/_(\d{8})_/);
  const date = dateMatch ? dateMatch[1] : undefined;

  // Extract version (pattern: _v1, _v2, etc.)
  const versionMatch = name.match(/_v(\d+)\./i);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : undefined;

  return { name, path, type, category, date, version };
}

/**
 * Get suggested attachments for a report email
 * Finds the most appropriate file (prefers PDF over DOCX)
 * @param clientFolderPath Path to client folder
 * @param consultationDate Date in YYYYMMDD format
 * @param reportType Type of report to find
 * @returns Array of suggested attachment files (usually 1)
 */
export async function getSuggestedReportAttachments(
  clientFolderPath: string,
  consultationDate: string,
  reportType: "client" | "vet"
): Promise<AttachmentFile[]> {
  const category: AttachmentCategory =
    reportType === "client" ? "client-report" : "vet-report";

  // Find all matching files
  const files = await findClientAttachments(clientFolderPath, {
    dateFilter: consultationDate,
    categoryFilter: category,
  });

  if (files.length === 0) {
    return [];
  }

  // Prefer PDF over DOCX (sorted by version already)
  const pdfs = files.filter((f) => f.type === "pdf");
  if (pdfs.length > 0) {
    return [pdfs[0]]; // Latest version PDF
  }

  const docxs = files.filter((f) => f.type === "docx");
  if (docxs.length > 0) {
    return [docxs[0]]; // Latest version DOCX
  }

  return [];
}

/**
 * Get all reports for a specific consultation date
 * Useful for showing available attachments in the UI
 */
export async function getReportsForConsultation(
  clientFolderPath: string,
  consultationDate: string
): Promise<{
  clientReports: AttachmentFile[];
  vetReports: AttachmentFile[];
  clinicalNotes: AttachmentFile[];
}> {
  const allFiles = await findClientAttachments(clientFolderPath, {
    dateFilter: consultationDate,
  });

  return {
    clientReports: allFiles.filter((f) => f.category === "client-report"),
    vetReports: allFiles.filter((f) => f.category === "vet-report"),
    clinicalNotes: allFiles.filter((f) => f.category === "clinical-notes"),
  };
}

/**
 * Get all questionnaires for a client
 */
export async function getClientQuestionnaires(
  clientFolderPath: string
): Promise<AttachmentFile[]> {
  return findClientAttachments(clientFolderPath, {
    categoryFilter: "questionnaire",
  });
}

/**
 * Get all prescriptions for a client
 */
export async function getClientPrescriptions(
  clientFolderPath: string
): Promise<AttachmentFile[]> {
  return findClientAttachments(clientFolderPath, {
    categoryFilter: "prescription",
  });
}

/**
 * Format attachment file for display
 */
export function formatAttachmentDisplay(file: AttachmentFile): string {
  let display = file.name;

  if (file.version) {
    display += ` (v${file.version})`;
  }

  return display;
}

/**
 * Get just the filename from a full path
 */
export function getFileNameFromPath(path: string): string {
  return path.split("\\").pop() || path.split("/").pop() || path;
}
