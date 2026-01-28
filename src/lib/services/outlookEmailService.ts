// PBS Admin - Outlook Email Service
// Handles Outlook COM automation for sending emails with attachments

import { invoke } from "@tauri-apps/api/core";

export interface OutlookEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: string[];
}

export interface EmailSendResult {
  success: boolean;
  method: "outlook" | "mailto" | "clipboard";
  error?: string;
}

/**
 * Check if Microsoft Outlook is available on this system
 * @returns true if Outlook COM is available, false otherwise
 */
export async function checkOutlookAvailable(): Promise<boolean> {
  try {
    const result = await invoke<string>("check_outlook_available");
    return result === "available";
  } catch (error) {
    console.warn("Failed to check Outlook availability:", error);
    return false;
  }
}

/**
 * Open Outlook with a pre-filled draft email
 * User will see the draft and can review/edit before sending
 * @param params Email parameters including optional attachments
 * @returns Result indicating success or failure with method used
 */
export async function openOutlookDraft(
  params: OutlookEmailParams
): Promise<EmailSendResult> {
  try {
    await invoke("open_outlook_draft", { params });
    return { success: true, method: "outlook" };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      method: "outlook",
      error: errorMsg,
    };
  }
}

/**
 * Fallback to mailto: link (does not support attachments)
 * Opens the default email client with pre-filled fields
 * @param params Email parameters (attachments will be ignored)
 * @returns Result indicating success or failure
 */
export async function openMailtoLink(
  params: OutlookEmailParams
): Promise<EmailSendResult> {
  try {
    const mailtoUrl = buildMailtoUrl(params);
    await invoke("plugin:opener|open_url", { url: mailtoUrl });
    return { success: true, method: "mailto" };
  } catch (error) {
    return {
      success: false,
      method: "mailto",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Copy email content to clipboard for pasting into web email clients
 * @param params Email parameters
 * @returns Result indicating success or failure
 */
export async function copyEmailToClipboard(
  params: OutlookEmailParams
): Promise<EmailSendResult> {
  try {
    const emailContent = formatEmailForClipboard(params);
    await navigator.clipboard.writeText(emailContent);
    return { success: true, method: "clipboard" };
  } catch (error) {
    return {
      success: false,
      method: "clipboard",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Smart email sending - tries Outlook first, falls back gracefully
 * @param params Email parameters
 * @param preferOutlook If true, try Outlook first (default: true)
 * @returns Result with the method that was used
 */
export async function sendEmail(
  params: OutlookEmailParams,
  preferOutlook: boolean = true
): Promise<EmailSendResult> {
  // If we have attachments, we need Outlook
  const hasAttachments = params.attachments && params.attachments.length > 0;

  if (preferOutlook || hasAttachments) {
    const outlookAvailable = await checkOutlookAvailable();

    if (outlookAvailable) {
      const result = await openOutlookDraft(params);
      if (result.success) {
        return result;
      }
      // If Outlook failed, try mailto as fallback (without attachments)
      console.warn("Outlook failed, falling back to mailto:", result.error);
    }
  }

  // Fallback to mailto (attachments will not work)
  if (hasAttachments) {
    console.warn(
      "Attachments cannot be included with mailto: link. User must attach manually."
    );
  }

  return openMailtoLink(params);
}

/**
 * Build a mailto: URL from email parameters
 */
function buildMailtoUrl(params: OutlookEmailParams): string {
  const parts = [`mailto:${encodeURIComponent(params.to)}`];
  const queryParams: string[] = [];

  if (params.subject) {
    queryParams.push(`subject=${encodeURIComponent(params.subject)}`);
  }
  if (params.body) {
    queryParams.push(`body=${encodeURIComponent(params.body)}`);
  }
  if (params.cc) {
    queryParams.push(`cc=${encodeURIComponent(params.cc)}`);
  }
  if (params.bcc) {
    queryParams.push(`bcc=${encodeURIComponent(params.bcc)}`);
  }

  if (queryParams.length > 0) {
    return `${parts[0]}?${queryParams.join("&")}`;
  }

  return parts[0];
}

/**
 * Format email content for clipboard (for pasting into Gmail, etc.)
 */
function formatEmailForClipboard(params: OutlookEmailParams): string {
  let content = `To: ${params.to}\n`;

  if (params.cc) {
    content += `CC: ${params.cc}\n`;
  }
  if (params.bcc) {
    content += `BCC: ${params.bcc}\n`;
  }

  content += `Subject: ${params.subject}\n\n${params.body}`;

  if (params.attachments && params.attachments.length > 0) {
    content += `\n\n---\nAttachments to include:\n`;
    params.attachments.forEach((path) => {
      const fileName = path.split("\\").pop() || path;
      content += `- ${fileName}\n`;
    });
  }

  return content;
}
