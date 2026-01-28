// PBS Admin - Email Log Service
// Tracks all sent emails with machine-readable storage in Event notes

import { format } from "date-fns";
import { createEvent, updateEvent, getEventById } from "./eventService";
import type { Event } from "../types";

/**
 * Represents a single email log entry
 */
export interface EmailLogEntry {
  id: string; // Unique ID for this email
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  templateId?: string; // Which email template was used
  templateName?: string; // Human-readable template name
  attachments?: string[]; // File names attached
  sentAt: string; // ISO timestamp
  sentVia: "outlook" | "mailto" | "clipboard" | "manual" | "unknown";
  emailType?:
    | "report"
    | "questionnaire-reminder"
    | "protocol"
    | "follow-up"
    | "general";
}

/**
 * Container for email log entries
 */
export interface EmailLog {
  entries: EmailLogEntry[];
  lastUpdated: string;
}

// Markers for machine-readable log in HTML comments
const EMAIL_LOG_MARKER = "<!--EMAIL_LOG:";
const EMAIL_LOG_END = "-->";
const EMAIL_LOG_REGEX = /<!--EMAIL_LOG:([\s\S]*?)-->/;

/**
 * Parse email log from event notes
 * Extracts the machine-readable JSON from HTML comments
 */
export function parseEmailLog(notes: string | null | undefined): EmailLog {
  if (!notes) {
    return { entries: [], lastUpdated: "" };
  }

  const match = notes.match(EMAIL_LOG_REGEX);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn("Failed to parse email log from notes:", e);
    }
  }

  return { entries: [], lastUpdated: "" };
}

/**
 * Generate a unique ID for an email entry
 */
function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add email entry to existing log
 */
export function addEmailToLog(
  existingLog: EmailLog,
  entry: Omit<EmailLogEntry, "id">
): EmailLog {
  const newEntry: EmailLogEntry = {
    ...entry,
    id: generateEmailId(),
  };

  return {
    entries: [...existingLog.entries, newEntry],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generate HTML display for email log (human-readable table + hidden JSON)
 */
export function generateEmailLogHtml(
  log: EmailLog,
  title: string = "Email Log"
): string {
  let html = `<h2>${title}</h2>`;

  if (log.entries.length === 0) {
    html += `<p><em>No emails sent yet</em></p>`;
  } else {
    html += `<table style="width:100%; border-collapse: collapse; font-size: 11px;">`;
    html += `<tr style="background: #f5f5f5;">
      <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">To</th>
      <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">Subject</th>
      <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">Sent</th>
      <th style="text-align:left; padding:4px; border-bottom:1px solid #ddd;">Via</th>
    </tr>`;

    for (const entry of log.entries) {
      const sentDate = format(new Date(entry.sentAt), "d MMM yyyy HH:mm");
      const attachmentBadge =
        entry.attachments && entry.attachments.length > 0
          ? `<span style="color:#666; font-size:10px;"> (${entry.attachments.length} file${entry.attachments.length > 1 ? "s" : ""})</span>`
          : "";

      const viaLabel =
        entry.sentVia === "outlook"
          ? "Outlook"
          : entry.sentVia === "mailto"
            ? "Email App"
            : entry.sentVia === "clipboard"
              ? "Clipboard"
              : entry.sentVia === "manual"
                ? "Manual"
                : "Unknown";

      html += `<tr>
        <td style="padding:4px; border-bottom:1px solid #eee;">${escapeHtml(entry.to)}</td>
        <td style="padding:4px; border-bottom:1px solid #eee;">${escapeHtml(entry.subject)}${attachmentBadge}</td>
        <td style="padding:4px; border-bottom:1px solid #eee;">${sentDate}</td>
        <td style="padding:4px; border-bottom:1px solid #eee;">${viaLabel}</td>
      </tr>`;
    }

    html += `</table>`;
  }

  // Append machine-readable log in HTML comment
  html += `\n${EMAIL_LOG_MARKER}${JSON.stringify(log)}${EMAIL_LOG_END}`;

  return html;
}

/**
 * Create a new "Note" event to record email sending
 * Used when there's no existing event to attach the log to
 */
export async function createEmailSentEvent(
  clientId: number,
  entry: Omit<EmailLogEntry, "id">,
  parentEventId?: number
): Promise<Event> {
  const log = addEmailToLog({ entries: [], lastUpdated: "" }, entry);
  const notesHtml = generateEmailLogHtml(log, "Email Sent");

  return createEvent({
    clientId,
    eventType: "Note",
    date: new Date().toISOString(),
    notes: notesHtml,
    parentEventId,
  });
}

/**
 * Append email entry to an existing event's log
 * Preserves existing notes content and adds to the log
 */
export async function appendEmailToEvent(
  eventId: number,
  entry: Omit<EmailLogEntry, "id">
): Promise<Event> {
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error("Event not found");
  }

  const existingLog = parseEmailLog(event.notes);
  const updatedLog = addEmailToLog(existingLog, entry);

  // Preserve non-log content from notes
  let baseNotes = event.notes || "";
  // Remove existing email log (we'll replace it)
  baseNotes = baseNotes.replace(EMAIL_LOG_REGEX, "").trim();

  // Generate updated log HTML
  const logHtml = generateEmailLogHtml(updatedLog);

  // Combine: existing content + new log
  const updatedNotes = baseNotes ? `${baseNotes}\n\n${logHtml}` : logHtml;

  const updated = await updateEvent(eventId, { notes: updatedNotes });
  if (!updated) {
    throw new Error("Failed to update event");
  }

  return updated;
}

/**
 * Quick log entry for common email types
 */
export function createEmailLogEntry(
  to: string,
  subject: string,
  sentVia: EmailLogEntry["sentVia"],
  options?: {
    cc?: string;
    bcc?: string;
    templateId?: string;
    templateName?: string;
    attachments?: string[];
    emailType?: EmailLogEntry["emailType"];
  }
): Omit<EmailLogEntry, "id"> {
  return {
    to,
    subject,
    sentVia,
    sentAt: new Date().toISOString(),
    cc: options?.cc,
    bcc: options?.bcc,
    templateId: options?.templateId,
    templateName: options?.templateName,
    attachments: options?.attachments,
    emailType: options?.emailType,
  };
}

/**
 * Escape HTML special characters for safe display
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
