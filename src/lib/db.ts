// PBS Admin - Database Client
// Uses Tauri's SQL plugin to access the SQLite database from the frontend

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "./utils/logger";
import { initSettingsTable, migrateFromLocalStorage } from "./services/settingsService";

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
 * Initialize FTS5 virtual table for client search.
 * Creates the table, sync triggers, and populates from existing data.
 * Idempotent — safe to call on every startup.
 */
async function initClientFTS(database: Database): Promise<void> {
  try {
    // Create FTS5 virtual table (IF NOT EXISTS not supported for FTS5, so check first)
    const tables = await database.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ClientFTS'"
    );

    if (tables.length === 0) {
      logger.info("[FTS] Creating ClientFTS virtual table...");

      // FTS5 virtual table indexing searchable client fields + pet names
      await database.execute(`
        CREATE VIRTUAL TABLE ClientFTS USING fts5(
          clientId UNINDEXED,
          firstName,
          lastName,
          email,
          mobile,
          city,
          petNames,
          content='',
          tokenize='unicode61 remove_diacritics 2'
        )
      `);

      // Populate from existing data (join pet names as comma-separated)
      await database.execute(`
        INSERT INTO ClientFTS(clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
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

      logger.info("[FTS] ClientFTS populated with existing data");
    }

    // Create triggers (DROP IF EXISTS + CREATE for idempotency)
    // Trigger: After INSERT on Client
    await database.execute(`DROP TRIGGER IF EXISTS ClientFTS_insert`);
    await database.execute(`
      CREATE TRIGGER ClientFTS_insert AFTER INSERT ON Client
      BEGIN
        INSERT INTO ClientFTS(clientId, firstName, lastName, email, mobile, city, petNames)
        VALUES (
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

    // Trigger: After UPDATE on Client — delete old row, insert new
    await database.execute(`DROP TRIGGER IF EXISTS ClientFTS_update`);
    await database.execute(`
      CREATE TRIGGER ClientFTS_update AFTER UPDATE ON Client
      BEGIN
        DELETE FROM ClientFTS WHERE clientId = OLD.clientId;
        INSERT INTO ClientFTS(clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
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
    await database.execute(`DROP TRIGGER IF EXISTS ClientFTS_delete`);
    await database.execute(`
      CREATE TRIGGER ClientFTS_delete AFTER DELETE ON Client
      BEGIN
        DELETE FROM ClientFTS WHERE clientId = OLD.clientId;
      END
    `);

    // Trigger: After INSERT on Pet — update parent client's petNames
    await database.execute(`DROP TRIGGER IF EXISTS ClientFTS_pet_insert`);
    await database.execute(`
      CREATE TRIGGER ClientFTS_pet_insert AFTER INSERT ON Pet
      BEGIN
        DELETE FROM ClientFTS WHERE clientId = NEW.clientId;
        INSERT INTO ClientFTS(clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
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
    await database.execute(`DROP TRIGGER IF EXISTS ClientFTS_pet_update`);
    await database.execute(`
      CREATE TRIGGER ClientFTS_pet_update AFTER UPDATE ON Pet
      BEGIN
        DELETE FROM ClientFTS WHERE clientId = NEW.clientId;
        INSERT INTO ClientFTS(clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
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
    await database.execute(`DROP TRIGGER IF EXISTS ClientFTS_pet_delete`);
    await database.execute(`
      CREATE TRIGGER ClientFTS_pet_delete AFTER DELETE ON Pet
      BEGIN
        DELETE FROM ClientFTS WHERE clientId = OLD.clientId;
        INSERT OR IGNORE INTO ClientFTS(clientId, firstName, lastName, email, mobile, city, petNames)
        SELECT
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
