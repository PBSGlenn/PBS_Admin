// PBS Admin - Database Client
// Uses Tauri's SQL plugin to access the SQLite database from the frontend

import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

/**
 * Get or create the database connection
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    try {
      // Use absolute path to the migrated database
      db = await Database.load("sqlite:C:\\Dev\\PBS_Admin\\prisma\\dev.db");
      console.log("Database connected successfully");
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
