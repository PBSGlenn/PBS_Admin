// PBS Admin - Backup Service
// Handles database backup and restore operations

import { invoke } from "@tauri-apps/api/core";
import { format } from "date-fns";
import { logger } from "../utils/logger";

export interface BackupInfo {
  fileName: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  error?: string;
}

/**
 * Create a backup of the database
 * Saves to Documents/PBS_Admin/Backups/ with timestamp
 */
export async function createBackup(): Promise<BackupResult> {
  try {
    const result = await invoke<{ file_path: string; file_name: string }>("create_database_backup");
    return {
      success: true,
      filePath: result.file_path,
      fileName: result.file_name,
    };
  } catch (error) {
    logger.error("Backup failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Restore database from a backup file
 * WARNING: This will overwrite the current database!
 */
export async function restoreBackup(backupFilePath: string): Promise<RestoreResult> {
  try {
    await invoke<string>("restore_database_backup", { backupPath: backupFilePath });
    return { success: true };
  } catch (error) {
    logger.error("Restore failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List available backup files
 */
export async function listBackups(): Promise<BackupInfo[]> {
  try {
    const backups = await invoke<BackupInfo[]>("list_database_backups");
    return backups;
  } catch (error) {
    logger.error("Failed to list backups:", error);
    return [];
  }
}

/**
 * Get the backups folder path
 */
export async function getBackupsPath(): Promise<string> {
  try {
    return await invoke<string>("get_backups_path");
  } catch (error) {
    logger.error("Failed to get backups path:", error);
    return "";
  }
}

/**
 * Delete a backup file
 */
export async function deleteBackup(backupFilePath: string): Promise<boolean> {
  try {
    await invoke<string>("delete_backup_file", { backupPath: backupFilePath });
    return true;
  } catch (error) {
    logger.error("Failed to delete backup:", error);
    return false;
  }
}

/**
 * Format backup filename with timestamp
 */
export function formatBackupFileName(): string {
  const timestamp = format(new Date(), "yyyy-MM-dd-HHmmss");
  return `pbs-admin-backup-${timestamp}.db`;
}

/**
 * Parse backup info from filename
 */
export function parseBackupFileName(fileName: string): { date: Date | null } {
  // Format: pbs-admin-backup-YYYY-MM-DD-HHmmss.db
  const match = fileName.match(/pbs-admin-backup-(\d{4}-\d{2}-\d{2}-\d{6})\.db/);
  if (match) {
    const dateStr = match[1];
    // Parse: 2025-01-04-143022 → 2025-01-04T14:30:22
    const formatted = `${dateStr.slice(0, 10)}T${dateStr.slice(11, 13)}:${dateStr.slice(13, 15)}:${dateStr.slice(15, 17)}`;
    return { date: new Date(formatted) };
  }
  return { date: null };
}
