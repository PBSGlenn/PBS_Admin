// PBS Admin - Database Client
// Uses Tauri's SQL plugin to access the SQLite database from the frontend

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "./utils/logger";

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
      const path = await getDatabasePath();
      db = await Database.load(`sqlite:${path}`);
      logger.info("Database connected successfully:", path);
    } catch (error) {
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
