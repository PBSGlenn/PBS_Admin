/**
 * QuestionnaireLog Service
 * Atomic dedup for Jotform submission processing.
 *
 * Replaces the previous Settings-based Set of processed submission IDs,
 * which had no atomicity guarantees and allowed duplicate processing
 * when the user clicked "Process" twice rapidly.
 *
 * The `submissionId` PRIMARY KEY combined with INSERT OR IGNORE provides
 * a single-writer lock: the first caller acquires the row and proceeds;
 * concurrent callers get rowsAffected=0 and must skip.
 */

import { query, execute } from "../db";

export type QuestionnaireLogStatus = "processing" | "done" | "failed";

export interface QuestionnaireLogRow {
  submissionId: string;
  formId: string;
  status: QuestionnaireLogStatus;
  firstAttemptAt: string;
  lastAttemptAt: string;
  errorMessage: string | null;
}

/**
 * Attempt to claim a submission for processing.
 * Returns true if this caller acquired the lock; false if another caller
 * already has it (either `processing`, `done`, or `failed`).
 *
 * Caller should check `getLog()` after a `false` result to decide whether
 * to skip (done) or allow retry (failed).
 */
export async function tryClaimSubmission(
  submissionId: string,
  formId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await execute(
    `INSERT OR IGNORE INTO QuestionnaireLog
       (submissionId, formId, status, firstAttemptAt, lastAttemptAt)
     VALUES (?, ?, 'processing', ?, ?)`,
    [submissionId, formId, now, now]
  );
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Mark a submission as successfully processed.
 */
export async function markDone(submissionId: string): Promise<void> {
  await execute(
    `UPDATE QuestionnaireLog
       SET status = 'done',
           lastAttemptAt = ?,
           errorMessage = NULL
     WHERE submissionId = ?`,
    [new Date().toISOString(), submissionId]
  );
}

/**
 * Mark a submission as failed; allows retry via `retry()`.
 */
export async function markFailed(submissionId: string, errorMessage: string): Promise<void> {
  await execute(
    `UPDATE QuestionnaireLog
       SET status = 'failed',
           lastAttemptAt = ?,
           errorMessage = ?
     WHERE submissionId = ?`,
    [new Date().toISOString(), errorMessage, submissionId]
  );
}

/**
 * Allow a failed submission to be retried: reset status to 'processing'.
 * Returns true if the row was in 'failed' state and got reset.
 */
export async function retryFailed(submissionId: string): Promise<boolean> {
  const result = await execute(
    `UPDATE QuestionnaireLog
       SET status = 'processing',
           lastAttemptAt = ?
     WHERE submissionId = ? AND status = 'failed'`,
    [new Date().toISOString(), submissionId]
  );
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Delete a log row. Used when migrating from the old Settings-based tracking,
 * and to allow an operator to force-reprocess a submission.
 */
export async function deleteLog(submissionId: string): Promise<void> {
  await execute(`DELETE FROM QuestionnaireLog WHERE submissionId = ?`, [submissionId]);
}

/**
 * Fetch a single log row.
 */
export async function getLog(submissionId: string): Promise<QuestionnaireLogRow | null> {
  const rows = await query<QuestionnaireLogRow>(
    `SELECT * FROM QuestionnaireLog WHERE submissionId = ?`,
    [submissionId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch all submission IDs currently in the log (any status).
 * Used to filter submissions that shouldn't be re-offered in the dashboard.
 */
export async function getAllLoggedIds(): Promise<Set<string>> {
  const rows = await query<{ submissionId: string }>(
    `SELECT submissionId FROM QuestionnaireLog`
  );
  return new Set(rows.map((r) => r.submissionId));
}

/**
 * Fetch all failed submissions — surfaced in the dashboard so the user
 * can retry them manually.
 */
export async function getFailedLogs(): Promise<QuestionnaireLogRow[]> {
  return query<QuestionnaireLogRow>(
    `SELECT * FROM QuestionnaireLog WHERE status = 'failed' ORDER BY lastAttemptAt DESC`
  );
}

/**
 * One-time migration: backfill QuestionnaireLog from the legacy
 * `pbs_admin_processed_jotform_submissions` Setting. Runs as a no-op on
 * subsequent calls because INSERT OR IGNORE leaves existing rows alone.
 * Safe to call repeatedly.
 */
export async function backfillFromLegacySetting(legacyIds: string[]): Promise<number> {
  if (legacyIds.length === 0) return 0;
  const now = new Date().toISOString();
  let inserted = 0;
  for (const id of legacyIds) {
    // formId unknown for legacy entries — use a placeholder
    const result = await execute(
      `INSERT OR IGNORE INTO QuestionnaireLog
         (submissionId, formId, status, firstAttemptAt, lastAttemptAt)
       VALUES (?, ?, 'done', ?, ?)`,
      [id, "legacy", now, now]
    );
    inserted += result.rowsAffected ?? 0;
  }
  return inserted;
}
