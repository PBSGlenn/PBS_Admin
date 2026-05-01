// PBS Admin - Client History Service
// Build and export a household-level patient history document for sending to
// vets, clients, or other parties. Operates per-Client (not per-Pet) because
// the schema models events at the client level. Selection of which events to
// include is done by the user in the ClientHistoryDialog.

import { invoke } from "@tauri-apps/api/core";
import { exists } from "@tauri-apps/plugin-fs";
import { format } from "date-fns";

import type { Client, Event, Pet } from "../types";
import { buildSignalmentBlock } from "../utils/petSignalmentUtils";
import { htmlToMarkdown } from "../utils/htmlToMarkdown";
import { formatDate } from "../utils/dateUtils";
import { logger } from "../utils/logger";

export type HistoryAudience = "client" | "vet" | "other";

export interface HistoryAddressee {
  name?: string;
  clinic?: string;
  email?: string;
}

export interface BuildHistoryMarkdownOptions {
  client: Client;
  pets: Pet[];
  events: Event[]; // already filtered + ordered (chronological asc)
  audience: HistoryAudience;
  addressee?: HistoryAddressee;
  coverNote?: string;
  dateFrom?: string | null; // ISO date string
  dateTo?: string | null;   // ISO date string
}

export interface GenerateHistoryDocxOptions extends BuildHistoryMarkdownOptions {
  clientFolderPath: string;
  templateName?: string; // defaults to General_PBS_Letterhead.docx
}

export interface GenerateHistoryDocxResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  markdown?: string;
  error?: string;
}

export interface GenerateHistoryPdfOptions {
  docxFilePath: string;
  clientFolderPath: string;
  clientSurname: string;
  audience: HistoryAudience;
}

export interface GenerateHistoryPdfResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

/** Build the markdown document for a patient history export. */
export function buildHistoryMarkdown(options: BuildHistoryMarkdownOptions): string {
  const { client, pets, events, audience, addressee, coverNote, dateFrom, dateTo } = options;
  const lines: string[] = [];

  const today = format(new Date(), "d MMMM yyyy");
  lines.push(today);
  lines.push("");

  // Addressee block — for vet/other audience, lead with who the document is for.
  if (audience !== "client" && (addressee?.name || addressee?.clinic)) {
    if (addressee.name) lines.push(addressee.name);
    if (addressee.clinic) lines.push(addressee.clinic);
    lines.push("");
  }

  const clientFullName = `${client.firstName} ${client.lastName}`.trim();
  lines.push(`# Patient History — ${clientFullName}`);
  lines.push("");

  // Household pets — authoritative signalment block from the Pet DB record.
  if (pets.length > 0) {
    lines.push("## Household");
    lines.push("");
    const signalment = buildSignalmentBlock(pets);
    // Render each pet on its own line with a leading bullet.
    for (const line of signalment.split("\n")) {
      if (line.trim()) lines.push(`- ${line}`);
    }
    lines.push("");
  }

  // Optional cover note from the user.
  if (coverNote && coverNote.trim()) {
    lines.push("## Note");
    lines.push("");
    lines.push(coverNote.trim());
    lines.push("");
  }

  // History summary line.
  lines.push("## History");
  lines.push("");
  lines.push(`*${buildRangeSummary(events.length, dateFrom, dateTo)}*`);
  lines.push("");

  if (events.length === 0) {
    lines.push("_No events match the selected criteria._");
    lines.push("");
  } else {
    // Render each event chronologically.
    for (const event of events) {
      const dateStr = formatDate(event.date, "d MMM yyyy");
      lines.push(`### ${dateStr} — ${event.eventType}`);
      lines.push("");
      const md = htmlToMarkdown(event.notes);
      if (md) {
        lines.push(md);
      } else {
        lines.push("_(no notes)_");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildRangeSummary(count: number, dateFrom?: string | null, dateTo?: string | null): string {
  const eventLabel = count === 1 ? "event" : "events";
  if (dateFrom && dateTo) {
    return `${count} ${eventLabel}, ${formatDate(dateFrom, "d MMM yyyy")} to ${formatDate(dateTo, "d MMM yyyy")}`;
  }
  if (dateFrom) {
    return `${count} ${eventLabel} from ${formatDate(dateFrom, "d MMM yyyy")} onward`;
  }
  if (dateTo) {
    return `${count} ${eventLabel} up to ${formatDate(dateTo, "d MMM yyyy")}`;
  }
  return `${count} ${eventLabel}, all dates`;
}

/**
 * Pick the next available filename for a history export, auto-versioning if a
 * file with the base name already exists. Mirrors the pattern used by
 * transcriptFileService.
 */
async function nextHistoryFilePath(
  folderPath: string,
  surname: string,
  audience: HistoryAudience,
  ext: "docx" | "pdf"
): Promise<{ filePath: string; fileName: string }> {
  const today = format(new Date(), "yyyyMMdd");
  const base = `${surname.toLowerCase()}_${today}_history_${audience}`;
  const baseFileName = `${base}.${ext}`;
  const basePath = `${folderPath}\\${baseFileName}`;

  if (!(await exists(basePath))) {
    return { filePath: basePath, fileName: baseFileName };
  }

  let version = 2;
  while (true) {
    const versionedName = `${base}_v${version}.${ext}`;
    const versionedPath = `${folderPath}\\${versionedName}`;
    if (!(await exists(versionedPath))) {
      return { filePath: versionedPath, fileName: versionedName };
    }
    version++;
  }
}

/**
 * Generate the patient history DOCX. Builds the markdown, runs Pandoc with the
 * letterhead reference doc, and saves to the client folder with a versioned
 * filename.
 */
export async function generateHistoryDocx(
  options: GenerateHistoryDocxOptions
): Promise<GenerateHistoryDocxResult> {
  const { client, clientFolderPath, audience, templateName = "General_PBS_Letterhead.docx" } = options;

  if (!clientFolderPath) {
    return { success: false, error: "Client folder is not set. Create one first." };
  }

  if (!(await exists(clientFolderPath))) {
    return { success: false, error: "Client folder does not exist on disk." };
  }

  try {
    const markdown = buildHistoryMarkdown(options);

    const templatesPath = await invoke<string>("get_templates_path");
    const templateFilePath = `${templatesPath}\\${templateName}`;

    const { filePath, fileName } = await nextHistoryFilePath(
      clientFolderPath,
      client.lastName,
      audience,
      "docx"
    );

    await invoke<string>("run_pandoc_from_stdin", {
      markdownContent: markdown,
      outputPath: filePath,
      templatePath: templateFilePath,
    });

    return { success: true, filePath, fileName, markdown };
  } catch (error) {
    logger.error("Failed to generate history DOCX:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert a generated history DOCX to PDF using MS Word COM automation.
 * Filename mirrors the DOCX with a .pdf extension and its own version
 * sequence (so re-converting after edits doesn't clobber a previous PDF).
 */
export async function generateHistoryPdf(
  options: GenerateHistoryPdfOptions
): Promise<GenerateHistoryPdfResult> {
  const { docxFilePath, clientFolderPath, clientSurname, audience } = options;

  if (!docxFilePath) {
    return { success: false, error: "DOCX file path is required." };
  }

  try {
    const { filePath, fileName } = await nextHistoryFilePath(
      clientFolderPath,
      clientSurname,
      audience,
      "pdf"
    );

    await invoke<string>("convert_docx_to_pdf", {
      docxPath: docxFilePath,
      pdfPath: filePath,
    });

    return { success: true, filePath, fileName };
  } catch (error) {
    logger.error("Failed to convert history DOCX to PDF:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
