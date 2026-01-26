/**
 * Email Service for PBS Admin
 * Sends emails via Resend API with support for attachments
 */

import { invoke } from "@tauri-apps/api/core";

// Email signature HTML with logo
const EMAIL_SIGNATURE = `
<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p style="margin: 0 0 10px 0;">
    <strong>Glenn Tobiansky</strong>
  </p>
  <p style="margin: 0 0 5px 0;">
    <a href="https://petbehaviourservices.com.au" style="color: #0066cc; text-decoration: none;">petbehaviourservices.com.au</a>
  </p>
  <p style="margin: 0 0 15px 0;">
    <a href="tel:0413387833" style="color: #333; text-decoration: none;">0413 387833</a>
  </p>
  <img src="https://petbehaviourservices.com.au/images/pbs-logo.webp" alt="Pet Behaviour Services" width="120" style="display: block; margin-top: 10px;" />
</div>
`;

export interface EmailOptions {
  to: string;
  subject: string;
  body: string; // Plain text or HTML body content (signature will be appended)
  attachments?: string[]; // Array of file paths to attach
  includeSignature?: boolean; // Default: true
}

export interface EmailResult {
  success: boolean;
  id?: string;
  to?: string;
  subject?: string;
  error?: string;
}

/**
 * Get the Resend API key from environment
 */
function getResendApiKey(): string {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_RESEND_API_KEY not configured in environment");
  }
  return apiKey;
}

/**
 * Get the from email address
 */
function getFromEmail(): string {
  return import.meta.env.VITE_EMAIL_FROM || "glenn@petbehaviourservices.com.au";
}

/**
 * Convert plain text to HTML paragraphs
 */
function textToHtml(text: string): string {
  // Split by double newlines for paragraphs
  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map(p => {
      // Convert single newlines to <br>
      const withBreaks = p.trim().replace(/\n/g, '<br>');
      return `<p style="margin: 0 0 16px 0; line-height: 1.5;">${withBreaks}</p>`;
    })
    .join('\n');
}

/**
 * Build the full HTML email body with styling and signature
 */
function buildHtmlBody(content: string, includeSignature: boolean = true): string {
  // Check if content is already HTML
  const isHtml = content.trim().startsWith('<') || content.includes('<p>') || content.includes('<br');

  const htmlContent = isHtml ? content : textToHtml(content);

  const signature = includeSignature ? EMAIL_SIGNATURE : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #333; max-width: 600px; margin: 0; padding: 20px;">
  ${htmlContent}
  ${signature}
</body>
</html>
`;
}

/**
 * Send an email via Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, body, attachments, includeSignature = true } = options;

  try {
    const apiKey = getResendApiKey();
    const from = getFromEmail();
    const htmlBody = buildHtmlBody(body, includeSignature);

    console.log("Sending email:", { to, subject, attachmentCount: attachments?.length || 0 });

    const result = await invoke<{
      success: boolean;
      id: string;
      to: string;
      subject: string;
    }>("send_email", {
      apiKey,
      from,
      to,
      subject,
      htmlBody,
      attachmentPaths: attachments || null,
    });

    return {
      success: result.success,
      id: result.id,
      to: result.to,
      subject: result.subject,
    };
  } catch (error) {
    console.error("Email send failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a consultation report email with PDF attachment
 */
export async function sendConsultationReport(
  clientEmail: string,
  clientFirstName: string,
  petName: string,
  consultationDate: string,
  pdfPath: string,
  customBody?: string
): Promise<EmailResult> {
  const defaultBody = `Dear ${clientFirstName},

Thank you for your recent consultation regarding ${petName} on ${consultationDate}.

Please find attached the consultation report for your records. This document contains the information we discussed during our session, including recommendations and next steps.

If you have any questions about the report or would like to discuss anything further, please don't hesitate to get in touch.

Kind regards,`;

  return sendEmail({
    to: clientEmail,
    subject: `${petName} - Consultation Report`,
    body: customBody || defaultBody,
    attachments: [pdfPath],
    includeSignature: true,
  });
}

/**
 * Send a veterinary report email with PDF attachment
 */
export async function sendVetReport(
  vetEmail: string,
  vetClinicName: string,
  clientName: string,
  petName: string,
  consultationDate: string,
  pdfPath: string,
  customBody?: string
): Promise<EmailResult> {
  const defaultBody = `Dear Colleagues at ${vetClinicName},

Please find attached my behaviour consultation report for ${petName} (${clientName}), seen on ${consultationDate}.

I would be happy to discuss this case further if you have any questions or would like additional information.

Kind regards,`;

  return sendEmail({
    to: vetEmail,
    subject: `Behaviour Report: ${petName} (${clientName})`,
    body: customBody || defaultBody,
    attachments: [pdfPath],
    includeSignature: true,
  });
}

/**
 * Send a questionnaire reminder email
 */
export async function sendQuestionnaireReminder(
  clientEmail: string,
  clientFirstName: string,
  petName: string,
  petSpecies: "dog" | "cat",
  consultationDate: string,
  formUrl: string
): Promise<EmailResult> {
  const body = `Dear ${clientFirstName},

This is a friendly reminder about your upcoming consultation for ${petName} on ${consultationDate}.

To help me prepare for our session, please complete the ${petSpecies} behaviour questionnaire if you haven't already:

${formUrl}

The questionnaire should take about 15-20 minutes to complete. Please try to submit it at least 48 hours before our appointment so I have time to review your responses.

If you have any questions or need to reschedule, please let me know.

Kind regards,`;

  return sendEmail({
    to: clientEmail,
    subject: `Reminder: Please complete the questionnaire for ${petName}`,
    body,
    includeSignature: true,
  });
}

/**
 * Get the email signature HTML (for preview purposes)
 */
export function getEmailSignature(): string {
  return EMAIL_SIGNATURE;
}

/**
 * Check if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  try {
    getResendApiKey();
    return true;
  } catch {
    return false;
  }
}
