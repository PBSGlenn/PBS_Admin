// PBS Admin - Database Client
// Uses Tauri's SQL plugin to access the SQLite database from the frontend

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "./utils/logger";
import { initSettingsTable, migrateFromLocalStorage, getSetting, setSetting, getSettingJson, setSettingJson } from "./services/settingsService";

let db: Database | null = null;
let dbPath: string | null = null;

/**
 * Get the database path from the Tauri backend
 * Database is stored in Documents/PBS_Admin/data/pbs_admin.db
 */
async function getDatabasePath(): Promise<string> {
  if (!dbPath) {
    dbPath = await invoke<string>("get_database_path");
  }
  return dbPath;
}

/**
 * Get or create the database connection
 * Uses dynamic path from Tauri backend (Documents/PBS_Admin/data/)
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    try {
      console.log("[DB] Getting database path...");
      const path = await getDatabasePath();
      console.log("[DB] Database path:", path);
      // Convert Windows backslashes to forward slashes for SQLite URL
      const normalizedPath = path.replace(/\\/g, '/');
      const connectionString = `sqlite:${normalizedPath}`;
      console.log("[DB] Connection string:", connectionString);
      db = await Database.load(connectionString);
      console.log("[DB] Database connected successfully");
      logger.info("Database connected successfully:", path);

      // Ensure Settings table exists and migrate localStorage data
      await initSettingsTable();
      await migrateFromLocalStorage();

      // Normalize any inconsistent timestamps in the database (one-time)
      await normalizeTimestampData(db);

      // Apply any pending schema migrations not covered by Prisma (one-time)
      await applyPendingSchemaChanges(db);
      await applyPendingSchemaChanges_v2(db);

      // Upgrade stale custom prompt templates (one-time per version)
      await upgradePromptTemplates();

      // Initialize FTS5 full-text search for clients
      await initClientFTS(db);
    } catch (error) {
      console.error("[DB] Failed to connect to database:", error);
      logger.error("Failed to connect to database:", error);
      throw error;
    }
  }
  return db;
}

/**
 * Execute a SELECT query and return results
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const database = await getDatabase();
  const result = await database.select<T[]>(sql, params);
  return result;
}

/**
 * Execute an INSERT/UPDATE/DELETE query
 */
export async function execute(sql: string, params: any[] = []): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const database = await getDatabase();
  const result = await database.execute(sql, params);
  return {
    rowsAffected: result.rowsAffected,
    lastInsertId: result.lastInsertId,
  };
}

/**
 * Execute multiple operations within a transaction
 * If any operation fails, all changes are rolled back
 *
 * Usage:
 * ```typescript
 * const result = await withTransaction(async () => {
 *   const client = await createClient(clientData);
 *   const pet = await createPet({ clientId: client.clientId, ...petData });
 *   const event = await createEvent({ clientId: client.clientId, ...eventData });
 *   return { client, pet, event };
 * });
 * ```
 */
export async function withTransaction<T>(
  operations: () => Promise<T>
): Promise<T> {
  const database = await getDatabase();

  try {
    // Begin transaction
    await database.execute("BEGIN TRANSACTION");
    logger.debug("Transaction started");

    // Execute all operations
    const result = await operations();

    // Commit if all operations succeeded
    await database.execute("COMMIT");
    logger.debug("Transaction committed");

    return result;
  } catch (error) {
    // Rollback on any error
    try {
      await database.execute("ROLLBACK");
      logger.debug("Transaction rolled back");
    } catch (rollbackError) {
      logger.error("Failed to rollback transaction:", rollbackError);
    }

    // Re-throw the original error
    throw error;
  }
}

/**
 * Execute a batch of SQL statements within a single transaction
 * More efficient for multiple independent writes
 *
 * Usage:
 * ```typescript
 * await executeBatch([
 *   { sql: "INSERT INTO Task ...", params: [...] },
 *   { sql: "INSERT INTO Task ...", params: [...] },
 *   { sql: "INSERT INTO Task ...", params: [...] },
 * ]);
 * ```
 */
export async function executeBatch(
  statements: Array<{ sql: string; params?: any[] }>
): Promise<Array<{ rowsAffected: number; lastInsertId?: number }>> {
  const database = await getDatabase();
  const results: Array<{ rowsAffected: number; lastInsertId?: number }> = [];

  try {
    await database.execute("BEGIN TRANSACTION");

    for (const stmt of statements) {
      const result = await database.execute(stmt.sql, stmt.params || []);
      results.push({
        rowsAffected: result.rowsAffected,
        lastInsertId: result.lastInsertId,
      });
    }

    await database.execute("COMMIT");
    logger.debug(`Batch executed: ${statements.length} statements`);

    return results;
  } catch (error) {
    try {
      await database.execute("ROLLBACK");
      logger.debug("Batch transaction rolled back");
    } catch (rollbackError) {
      logger.error("Failed to rollback batch transaction:", rollbackError);
    }
    throw error;
  }
}

/**
 * Normalize inconsistent timestamp data (one-time migration).
 *
 * Fixes two issues found in the post-audit verification:
 * 1. Client/Pet/Event/Task createdAt/updatedAt have mixed types:
 *    - Integer epoch milliseconds (from old Prisma Client)
 *    - Text in various formats (from raw SQL CURRENT_TIMESTAMP)
 *    Normalizes all to CURRENT_TIMESTAMP text format: "YYYY-MM-DD HH:MM:SS"
 *
 * 2. Event.date has mixed ISO 8601 formats:
 *    - "2025-09-28T17:55:55+10:00" (with timezone offset)
 *    - "2025-10-31T03:25:00.000Z" (UTC with Z suffix)
 *    - "2025-11-13T05:20:37.724+00:00" (explicit +00:00)
 *    Normalizes all to UTC Z-suffix format to match dateToISO() output.
 */
async function normalizeTimestampData(database: Database): Promise<void> {
  const SENTINEL = "_migration_normalize_timestamps_v1";
  const done = await getSetting(SENTINEL);
  if (done) return;

  logger.info("[DB] Normalizing timestamp data (one-time migration)...");

  try {
    await database.execute("BEGIN TRANSACTION");

    // --- Fix 1: Convert integer epoch ms to text for createdAt/updatedAt ---
    const tables = ["Client", "Pet", "Event", "Task"];
    let totalFixed = 0;

    for (const table of tables) {
      // Convert integer createdAt (epoch ms) to "YYYY-MM-DD HH:MM:SS" UTC text
      const r1 = await database.execute(`
        UPDATE ${table}
        SET createdAt = datetime(createdAt / 1000, 'unixepoch')
        WHERE typeof(createdAt) = 'integer'
      `);

      // Convert integer updatedAt (epoch ms) to "YYYY-MM-DD HH:MM:SS" UTC text
      const r2 = await database.execute(`
        UPDATE ${table}
        SET updatedAt = datetime(updatedAt / 1000, 'unixepoch')
        WHERE typeof(updatedAt) = 'integer'
      `);

      totalFixed += r1.rowsAffected + r2.rowsAffected;
    }

    logger.info(`[DB] Fixed ${totalFixed} integer timestamps across ${tables.length} tables`);

    // --- Fix 2: Normalize Event.date to UTC Z-suffix ISO 8601 ---
    // Convert dates with timezone offsets (e.g. +10:00, +00:00) to UTC Z-suffix
    // SQLite's strftime handles timezone conversion automatically
    const r3 = await database.execute(`
      UPDATE Event
      SET date = strftime('%Y-%m-%dT%H:%M:%fZ', date)
      WHERE date IS NOT NULL
        AND date NOT LIKE '%Z'
        AND (date LIKE '%+%' OR date LIKE '%-%:%')
    `);

    // Also normalize dates that have +00:00 (redundant, but ensures Z suffix)
    const r4 = await database.execute(`
      UPDATE Event
      SET date = REPLACE(date, '+00:00', 'Z')
      WHERE date LIKE '%+00:00'
    `);

    logger.info(`[DB] Normalized ${r3.rowsAffected + r4.rowsAffected} event dates to UTC Z-suffix`);

    // Also normalize Task.dueDate and Task.completedOn
    const r5 = await database.execute(`
      UPDATE Task
      SET dueDate = strftime('%Y-%m-%dT%H:%M:%fZ', dueDate)
      WHERE dueDate IS NOT NULL
        AND dueDate NOT LIKE '%Z'
        AND (dueDate LIKE '%+%' OR dueDate LIKE '%-%:%')
    `);

    const r6 = await database.execute(`
      UPDATE Task
      SET completedOn = strftime('%Y-%m-%dT%H:%M:%fZ', completedOn)
      WHERE completedOn IS NOT NULL
        AND completedOn NOT LIKE '%Z'
        AND (completedOn LIKE '%+%' OR completedOn LIKE '%-%:%')
    `);

    logger.info(`[DB] Normalized ${r5.rowsAffected + r6.rowsAffected} task dates to UTC Z-suffix`);

    await database.execute("COMMIT");

    // Mark migration as complete
    await setSetting(SENTINEL, new Date().toISOString());
    logger.info("[DB] Timestamp normalization complete");
  } catch (error) {
    try {
      await database.execute("ROLLBACK");
    } catch {
      // Rollback may fail if transaction wasn't started
    }
    logger.error("[DB] Timestamp normalization failed (non-fatal, will retry on next startup):", error);
    console.warn("[DB] Timestamp normalization failed:", error);
  }
}

/**
 * Apply pending schema changes that weren't deployed via Prisma migrate.
 *
 * Prisma migrations target prisma/dev.db (DATABASE_URL="file:./dev.db"),
 * but the production database lives in Documents/PBS_Admin/data/pbs_admin.db.
 * This function applies schema changes that exist as migration SQL files
 * but were never applied to the production database.
 *
 * Idempotent — uses IF NOT EXISTS and sentinel to avoid re-running.
 */
async function applyPendingSchemaChanges(database: Database): Promise<void> {
  const SENTINEL = "_migration_schema_changes_v1";
  const done = await getSetting(SENTINEL);
  if (done) return;

  logger.info("[DB] Applying pending schema changes...");

  try {
    await database.execute("BEGIN TRANSACTION");

    // Migration 20260225100056: Add UNIQUE constraint on Client.email
    // Drop the old non-unique index and create a unique one
    await database.execute(`DROP INDEX IF EXISTS "Client_email_idx"`);
    await database.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "Client_email_key" ON "Client"("email")`);

    // Migration 20260225102000: Add missing indexes
    await database.execute(`CREATE INDEX IF NOT EXISTS "Event_processingState_idx" ON "Event"("processingState")`);
    await database.execute(`CREATE INDEX IF NOT EXISTS "Task_automatedAction_idx" ON "Task"("automatedAction")`);

    await database.execute("COMMIT");

    await setSetting(SENTINEL, new Date().toISOString());
    logger.info("[DB] Pending schema changes applied (UNIQUE email, processingState index, automatedAction index)");
  } catch (error) {
    try {
      await database.execute("ROLLBACK");
    } catch {
      // Rollback may fail if transaction wasn't started
    }
    logger.error("[DB] Schema changes failed (non-fatal, will retry on next startup):", error);
    console.warn("[DB] Schema changes failed:", error);
  }
}

/**
 * Schema changes v2: Add bookingReference and trainingPackageId columns to Event.
 * Also backfills bookingReference from existing Event.notes HTML.
 */
async function applyPendingSchemaChanges_v2(database: Database): Promise<void> {
  const SENTINEL = "_migration_schema_changes_v2";
  const done = await getSetting(SENTINEL);
  if (done) return;

  logger.info("[DB] Applying pending schema changes v2 (bookingReference, trainingPackageId)...");

  try {
    // Add columns (ALTER TABLE ADD COLUMN is idempotent-ish in SQLite — errors if exists, so catch per-column)
    for (const col of ["bookingReference", "trainingPackageId"]) {
      try {
        await database.execute(`ALTER TABLE Event ADD COLUMN ${col} TEXT`);
      } catch {
        // Column already exists — safe to ignore
      }
    }

    // Add index for dedup lookups
    await database.execute(`CREATE INDEX IF NOT EXISTS "Event_bookingReference_idx" ON "Event"("bookingReference")`);

    // Backfill bookingReference from Event.notes HTML
    const eventsWithRefs = await database.select<{ eventId: number; notes: string }[]>(
      `SELECT eventId, notes FROM Event WHERE notes LIKE '%Booking Reference:%' AND (bookingReference IS NULL OR bookingReference = '')`
    );

    let backfilled = 0;
    for (const event of eventsWithRefs) {
      // Match both PBS-XXX and BKXXXXXX formats
      const match = event.notes.match(/Booking Reference:<\/strong>\s*(\S+?)(?:<|$)/i);
      if (match) {
        const ref = match[1];
        await database.execute(
          `UPDATE Event SET bookingReference = ? WHERE eventId = ?`,
          [ref, event.eventId]
        );
        backfilled++;
      }
    }

    await setSetting(SENTINEL, new Date().toISOString());
    logger.info(`[DB] Schema changes v2 applied (bookingReference, trainingPackageId columns + ${backfilled} events backfilled)`);
  } catch (error) {
    logger.error("[DB] Schema changes v2 failed (non-fatal, will retry on next startup):", error);
    console.warn("[DB] Schema changes v2 failed:", error);
  }
}

/**
 * Initialize FTS5 virtual table for client search.
 * Creates the table, sync triggers, and populates from existing data.
 * Idempotent — safe to call on every startup.
 */
async function initClientFTS(database: Database): Promise<void> {
  try {
    // Always drop and recreate the FTS table on startup.
    // Previously used content='' (contentless), which broke DELETE inside
    // triggers and corrupted transactions. Now uses a regular FTS5 table
    // with rowid = clientId for reliable deletion.
    await database.execute(`DROP TABLE IF EXISTS ClientFTS`);

    // Drop all triggers before recreating
    for (const name of [
      'ClientFTS_insert', 'ClientFTS_update', 'ClientFTS_delete',
      'ClientFTS_pet_insert', 'ClientFTS_pet_update', 'ClientFTS_pet_delete',
    ]) {
      await database.execute(`DROP TRIGGER IF EXISTS ${name}`);
    }

    // FTS5 table WITHOUT content='' — stores own content, supports DELETE by rowid
    await database.execute(`
      CREATE VIRTUAL TABLE ClientFTS USING fts5(
        clientId UNINDEXED,
        firstName,
        lastName,
        email,
        mobile,
        city,
        petNames,
        tokenize='unicode61 remove_diacritics 2'
      )
    `);

    // Populate with rowid = clientId for fast, reliable deletion
    await database.execute(`
      INSERT INTO ClientFTS(rowid, clientId, firstName, lastName, email, mobile, city, petNames)
      SELECT
        c.clientId,
        c.clientId,
        COALESCE(c.firstName, ''),
        COALESCE(c.lastName, ''),
        COALESCE(c.email, ''),
        COALESCE(c.mobile, ''),
        COALESCE(c.city, ''),
        COALESCE(GROUP_CONCAT(p.name, ', '), '')
      FROM Client c
      LEFT JOIN Pet p ON c.clientId = p.clientId
      GROUP BY c.clientId
    `);
    logger.info("[FTS] ClientFTS index rebuilt");

    // All triggers use DELETE by rowid (always works in FTS5)

    // Trigger: After INSERT on Client
    await database.execute(`
      CREATE TRIGGER ClientFTS_insert AFTER INSERT ON Client
      BEGIN
        INSERT INTO ClientFTS(rowid, clientId, firstName, lastName, email, mobile, city, petNames)
        VALUES (
          NEW.clientId,
          NEW.clientId,
          COALESCE(NEW.firstName, ''),
          COALESCE(NEW.lastName, ''),
          COALESCE(NEW.email, ''),
          COALESCE(NEW.mobile, ''),
          COALESCE(NEW.city, ''),
          ''
        );
      END
    `);

    // Trigger: After UPDATE on Client — delete old row by rowid, insert new
    await database.execute(`
      CREATE TRIGGER ClientFTS_update AFTER UPDATE ON Client
      BEGIN
        DELETE FROM ClientFTS WHERE rowid = OLD.clientId;
        INSERT INTO ClientFTS(rowid, clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
          NEW.clientId,
          NEW.clientId,
          COALESCE(NEW.firstName, ''),
          COALESCE(NEW.lastName, ''),
          COALESCE(NEW.email, ''),
          COALESCE(NEW.mobile, ''),
          COALESCE(NEW.city, ''),
          COALESCE(GROUP_CONCAT(p.name, ', '), '')
        FROM (SELECT 1) dummy
        LEFT JOIN Pet p ON p.clientId = NEW.clientId;
      END
    `);

    // Trigger: After DELETE on Client
    await database.execute(`
      CREATE TRIGGER ClientFTS_delete AFTER DELETE ON Client
      BEGIN
        DELETE FROM ClientFTS WHERE rowid = OLD.clientId;
      END
    `);

    // Trigger: After INSERT on Pet — update parent client's petNames
    await database.execute(`
      CREATE TRIGGER ClientFTS_pet_insert AFTER INSERT ON Pet
      BEGIN
        DELETE FROM ClientFTS WHERE rowid = NEW.clientId;
        INSERT INTO ClientFTS(rowid, clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
          c.clientId,
          c.clientId,
          COALESCE(c.firstName, ''),
          COALESCE(c.lastName, ''),
          COALESCE(c.email, ''),
          COALESCE(c.mobile, ''),
          COALESCE(c.city, ''),
          COALESCE(GROUP_CONCAT(p.name, ', '), '')
        FROM Client c
        LEFT JOIN Pet p ON c.clientId = p.clientId
        WHERE c.clientId = NEW.clientId
        GROUP BY c.clientId;
      END
    `);

    // Trigger: After UPDATE on Pet
    await database.execute(`
      CREATE TRIGGER ClientFTS_pet_update AFTER UPDATE ON Pet
      BEGIN
        DELETE FROM ClientFTS WHERE rowid = NEW.clientId;
        INSERT INTO ClientFTS(rowid, clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
          c.clientId,
          c.clientId,
          COALESCE(c.firstName, ''),
          COALESCE(c.lastName, ''),
          COALESCE(c.email, ''),
          COALESCE(c.mobile, ''),
          COALESCE(c.city, ''),
          COALESCE(GROUP_CONCAT(p.name, ', '), '')
        FROM Client c
        LEFT JOIN Pet p ON c.clientId = p.clientId
        WHERE c.clientId = NEW.clientId
        GROUP BY c.clientId;
      END
    `);

    // Trigger: After DELETE on Pet
    await database.execute(`
      CREATE TRIGGER ClientFTS_pet_delete AFTER DELETE ON Pet
      BEGIN
        DELETE FROM ClientFTS WHERE rowid = OLD.clientId;
        INSERT OR IGNORE INTO ClientFTS(rowid, clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
          c.clientId,
          c.clientId,
          COALESCE(c.firstName, ''),
          COALESCE(c.lastName, ''),
          COALESCE(c.email, ''),
          COALESCE(c.mobile, ''),
          COALESCE(c.city, ''),
          COALESCE(GROUP_CONCAT(p.name, ', '), '')
        FROM Client c
        LEFT JOIN Pet p ON c.clientId = p.clientId
        WHERE c.clientId = OLD.clientId
        GROUP BY c.clientId;
      END
    `);

    logger.info("[FTS] Client FTS5 triggers initialized");
  } catch (error) {
    // FTS5 not available — log and continue without full-text search
    logger.error("[FTS] Failed to initialize FTS5 (search will fall back to LIKE):", error);
    console.warn("[FTS] FTS5 initialization failed:", error);
  }
}

/**
 * Upgrade stale custom prompt templates on startup.
 *
 * When a default prompt template is revised in code, any custom override
 * stored in SQLite will still contain the old version. This migration
 * detects stale overrides and replaces them with the current default.
 *
 * Each upgrade round is tracked by a versioned sentinel key so it only
 * runs once per code release.
 */
async function upgradePromptTemplates(): Promise<void> {
  const SENTINEL = "_migration_prompt_templates_v3"; // bump version for each new upgrade
  const done = await getSetting(SENTINEL);
  if (done) return;

  try {
    const { DEFAULT_PROMPT_TEMPLATES } = await import("./prompts/promptTemplates");
    const SETTINGS_KEY = "pbs_admin_prompt_templates";
    const customTemplates = await getSettingJson<Array<{ id: string; systemPrompt?: string; [key: string]: unknown }>>(SETTINGS_KEY, []);

    if (customTemplates.length === 0) {
      await setSetting(SENTINEL, "done");
      return;
    }

    let updated = false;

    for (let i = 0; i < customTemplates.length; i++) {
      const custom = customTemplates[i];
      const defaultTemplate = DEFAULT_PROMPT_TEMPLATES.find((t: { id: string }) => t.id === custom.id);
      if (!defaultTemplate) continue;

      // v2: Detect stale vet-report: old prompt had "STANDARD DOSES" or "3/4 to 1 page"
      if (
        custom.id === "vet-report" &&
        custom.systemPrompt &&
        (custom.systemPrompt.includes("STANDARD DOSES") ||
         custom.systemPrompt.includes("3/4 to 1 page"))
      ) {
        logger.info(`[DB] Upgrading stale custom prompt template: ${custom.id}`);
        customTemplates[i] = {
          ...defaultTemplate,
          updatedAt: new Date().toISOString(),
          createdAt: (custom as Record<string, unknown>).createdAt as string || new Date().toISOString(),
        };
        updated = true;
      }

      // v3: Fix BVSc missing from closing credentials in any custom template
      if (
        custom.systemPrompt &&
        custom.systemPrompt.includes("Glenn Tobiansky") &&
        custom.systemPrompt.includes("MANZCVS") &&
        !custom.systemPrompt.includes("BVSc")
      ) {
        logger.info(`[DB] Adding BVSc to credentials in custom template: ${custom.id}`);
        // Fix closing signature blocks: "Dr. Glenn Tobiansky\nMANZCVS" → "Dr. Glenn Tobiansky\nBVSc, MANZCVS"
        customTemplates[i] = {
          ...custom,
          systemPrompt: custom.systemPrompt
            .replace(
              /(\*\*Dr\. Glenn Tobiansky\*\*\n)(MANZCVS)/g,
              "$1BVSc, $2"
            )
            .replace(
              /(Dr\. Glenn Tobiansky,?\s+)(MANZCVS)/g,
              "$1BVSc, $2"
            )
            .replace(
              /(behaviourist \()(MANZCVS)/g,
              "$1BVSc, $2"
            ),
          updatedAt: new Date().toISOString(),
        };
        updated = true;
      }
    }

    if (updated) {
      await setSettingJson(SETTINGS_KEY, customTemplates);
      logger.info("[DB] Prompt template upgrade complete");
    }

    await setSetting(SENTINEL, "done");
  } catch (error) {
    logger.error("[DB] Failed to upgrade prompt templates:", error);
    // Non-fatal — app continues with whatever templates exist
  }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

/**
 * Get the current database path (for display/debugging)
 */
export async function getCurrentDatabasePath(): Promise<string> {
  return getDatabasePath();
}
