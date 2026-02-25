// PBS Admin - Settings Service
// Key-value settings storage in SQLite, replacing localStorage
// All settings are stored as JSON strings in a Settings table

import { query, execute } from "../db";
import { logger } from "../utils/logger";

// All known localStorage keys to migrate
const LOCALSTORAGE_KEYS = [
  "pbs_admin_backup_settings",
  "pbs_admin_processed_jotform_submissions",
  "pbs_admin_vet_clinics",
  "pbs_admin_transcription_stats",
  "pbs_admin_api_keys",
  "pbs_admin_minimize_to_tray",
  "pbs_admin_email_templates",
  "pbs_admin_prescription_template",
  "pbs_admin_prompt_templates",
  "pbs_admin_medication_last_update_check",
  "pbs_admin_medication_update_history",
  "pbs_admin_custom_medication_brands",
];

const MIGRATION_SENTINEL = "_migration_localstorage_complete";

/**
 * Create the Settings table if it doesn't exist
 */
export async function initSettingsTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS Settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>(
    "SELECT value FROM Settings WHERE key = ?",
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

/**
 * Set a setting value (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO Settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')`,
    [key, value]
  );
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<boolean> {
  const result = await execute("DELETE FROM Settings WHERE key = ?", [key]);
  return result.rowsAffected > 0;
}

/**
 * Get a setting parsed as JSON with a default fallback
 */
export async function getSettingJson<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await getSetting(key);
  if (raw === null) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.error(`Failed to parse setting "${key}" as JSON`);
    return defaultValue;
  }
}

/**
 * Set a setting as a JSON-stringified value
 */
export async function setSettingJson<T>(key: string, value: T): Promise<void> {
  await setSetting(key, JSON.stringify(value));
}

/**
 * One-time migration from localStorage to Settings table.
 * Reads all known localStorage keys and copies them to SQLite.
 * Idempotent: checks a sentinel key to avoid re-running.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  // Check if migration already done
  const sentinel = await getSetting(MIGRATION_SENTINEL);
  if (sentinel) return;

  logger.info("Starting one-time localStorage → SQLite migration...");
  let migrated = 0;

  for (const key of LOCALSTORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        await setSetting(key, value);
        migrated++;
      }
    } catch (error) {
      logger.error(`Failed to migrate localStorage key "${key}":`, error);
    }
  }

  // Set sentinel to prevent re-migration
  await setSetting(MIGRATION_SENTINEL, new Date().toISOString());
  logger.info(`localStorage migration complete: ${migrated} keys migrated`);
}
