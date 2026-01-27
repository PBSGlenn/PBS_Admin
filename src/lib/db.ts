// PBS Admin - Database Client
// Uses Tauri's SQL plugin to access the SQLite database from the frontend

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

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
      console.log("Database connected successfully:", path);
    } catch (error) {
      console.error("Failed to connect to database:", error);
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
