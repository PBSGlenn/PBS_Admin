/**
 * SentEmail Service — audit log of outgoing emails sent via Resend.
 *
 * Path A (send-time logging): every successful Resend send writes a row here
 * via `createSentEmail()`. Called from `emailService.sendEmail()` and never
 * allowed to fail the send — log errors to console and move on.
 *
 * Path B (status reconciliation, parked): `updateSentEmailStatus()` is the
 * hook for future Resend webhook / polling sync that upgrades rows to
 * delivered / bounced / complained. Not wired yet.
 */

import { execute, query } from "../db";
import { logger } from "../utils/logger";
import type { SentEmail, SentEmailInput } from "../types";

/**
 * Normalize a recipient (single string, comma/semicolon-separated string,
 * or array of strings) into a JSON-encoded array string for storage.
 *
 *   "a@b.com"                → '["a@b.com"]'
 *   "a@b.com, c@d.com"       → '["a@b.com","c@d.com"]'
 *   ["a@b.com"]              → '["a@b.com"]'
 */
function normalizeToAddress(to: string | string[]): string {
  const list = Array.isArray(to)
    ? to
    : to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return JSON.stringify(list);
}

/**
 * Insert a SentEmail row. Idempotent via `INSERT OR REPLACE` on the primary
 * key (`emailId`), so retrying a failed sync or reprocessing a webhook is
 * safe.
 *
 * `updatedAt` is set to `CURRENT_TIMESTAMP` because the schema declares it
 * NOT NULL with no DEFAULT (Prisma `@updatedAt` only fires on Prisma-client
 * writes — irrelevant here since this app uses raw SQL via the Tauri SQL
 * plugin).
 */
export async function createSentEmail(input: SentEmailInput): Promise<void> {
  const sentAt = input.sentAt ?? new Date().toISOString();
  const toAddress = normalizeToAddress(input.toAddress);
  const status = input.status ?? "sent";

  await execute(
    `
    INSERT OR REPLACE INTO SentEmail (
      emailId, clientId, eventId,
      fromAddress, toAddress, subject,
      emailType, status, sentAt,
      deliveredAt, bouncedAt, errorMessage,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      input.emailId,
      input.clientId ?? null,
      input.eventId ?? null,
      input.fromAddress,
      toAddress,
      input.subject,
      input.emailType ?? null,
      status,
      sentAt,
      input.deliveredAt ?? null,
      input.bouncedAt ?? null,
      input.errorMessage ?? null,
    ]
  );
}

/**
 * Update the delivery status of an existing SentEmail row (used by webhook /
 * polling sync). No-op if the row doesn't exist — callers should `INSERT OR
 * REPLACE` via `createSentEmail()` if they have a full record.
 */
export async function updateSentEmailStatus(
  emailId: string,
  status: string,
  options?: {
    deliveredAt?: string | null;
    bouncedAt?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  const sets: string[] = ["status = ?"];
  const values: any[] = [status];

  if (options?.deliveredAt !== undefined) {
    sets.push("deliveredAt = ?");
    values.push(options.deliveredAt);
  }
  if (options?.bouncedAt !== undefined) {
    sets.push("bouncedAt = ?");
    values.push(options.bouncedAt);
  }
  if (options?.errorMessage !== undefined) {
    sets.push("errorMessage = ?");
    values.push(options.errorMessage);
  }

  values.push(emailId);

  await execute(
    `UPDATE SentEmail SET ${sets.join(", ")}, updatedAt = CURRENT_TIMESTAMP WHERE emailId = ?`,
    values
  );
}

/**
 * Wrapper that logs a sent email but never throws. Use this from email send
 * paths so a logging failure can't break the actual send (the email already
 * went out — we just missed an audit record).
 */
export async function logSentEmailSafe(input: SentEmailInput): Promise<void> {
  try {
    await createSentEmail(input);
  } catch (error) {
    logger.error("[SentEmail] Failed to log sent email (non-fatal):", error);
    console.warn("[SentEmail] Failed to log sent email (non-fatal):", {
      emailId: input.emailId,
      to: input.toAddress,
      subject: input.subject,
      error,
    });
  }
}

/**
 * Fetch a SentEmail by its Resend ID. Returns null if not found.
 */
export async function getSentEmailById(emailId: string): Promise<SentEmail | null> {
  const rows = await query<SentEmail>(
    `SELECT * FROM SentEmail WHERE emailId = ?`,
    [emailId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch all SentEmail rows for a client, newest first.
 */
export async function getSentEmailsForClient(clientId: number, limit = 100): Promise<SentEmail[]> {
  return query<SentEmail>(
    `SELECT * FROM SentEmail WHERE clientId = ? ORDER BY sentAt DESC LIMIT ?`,
    [clientId, limit]
  );
}

/**
 * Fetch all SentEmail rows linked to an event, newest first.
 */
export async function getSentEmailsForEvent(eventId: number, limit = 100): Promise<SentEmail[]> {
  return query<SentEmail>(
    `SELECT * FROM SentEmail WHERE eventId = ? ORDER BY sentAt DESC LIMIT ?`,
    [eventId, limit]
  );
}

/**
 * Parse the JSON-encoded `toAddress` column back into a string[]. Tolerates
 * legacy plain-string values just in case (returns single-element array).
 */
export function parseToAddress(toAddressJson: string): string[] {
  try {
    const parsed = JSON.parse(toAddressJson);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [String(parsed)];
  } catch {
    return [toAddressJson];
  }
}
