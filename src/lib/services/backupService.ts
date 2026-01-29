// PBS Admin - Backup Service
// Handles database backup and restore operations with scheduled backups

import { invoke } from "@tauri-apps/api/core";
import { format } from "date-fns";
import { logger } from "../utils/logger";

// ============================================================================
// Types
// ============================================================================

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
  message?: string;
  error?: string;
}

export interface BackupSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'manual';
  retentionCount: number; // Number of backups to keep
  lastBackupDate: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const BACKUP_SETTINGS_KEY = 'pbs_admin_backup_settings';
const BACKUP_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

const DEFAULT_SETTINGS: BackupSettings = {
  enabled: true,
  frequency: 'daily',
  retentionCount: 7,
  lastBackupDate: null,
};

// ============================================================================
// Settings Management
// ============================================================================

/**
 * Get backup settings from localStorage
 */
export function getBackupSettings(): BackupSettings {
  try {
    const stored = localStorage.getItem(BACKUP_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    logger.error('Failed to load backup settings:', error);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save backup settings to localStorage
 */
export function saveBackupSettings(settings: Partial<BackupSettings>): void {
  try {
    const current = getBackupSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(updated));
    logger.info('Backup settings saved');
  } catch (error) {
    logger.error('Failed to save backup settings:', error);
  }
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

// ============================================================================
// Retention Policy
// ============================================================================

/**
 * Apply retention policy - delete old backups exceeding the retention count
 */
export async function applyRetentionPolicy(): Promise<number> {
  const settings = getBackupSettings();
  const backups = await listBackups();
  let deletedCount = 0;

  if (backups.length > settings.retentionCount) {
    // Backups are sorted newest first, so delete from the end
    const toDelete = backups.slice(settings.retentionCount);

    for (const backup of toDelete) {
      const success = await deleteBackup(backup.filePath);
      if (success) {
        deletedCount++;
        logger.info(`Retention policy: deleted old backup ${backup.fileName}`);
      }
    }
  }

  return deletedCount;
}

// ============================================================================
// Scheduled Backups
// ============================================================================

let scheduledBackupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check if a backup is due based on settings
 */
export function isBackupDue(): boolean {
  const settings = getBackupSettings();

  if (!settings.enabled || settings.frequency === 'manual') {
    return false;
  }

  if (!settings.lastBackupDate) {
    return true; // Never backed up
  }

  const lastBackup = new Date(settings.lastBackupDate);
  const now = new Date();
  const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

  switch (settings.frequency) {
    case 'daily':
      return hoursSinceLastBackup >= 24;
    case 'weekly':
      return hoursSinceLastBackup >= 24 * 7;
    default:
      return false;
  }
}

/**
 * Create a backup and update settings
 */
export async function createBackupWithTracking(): Promise<BackupResult> {
  const result = await createBackup();

  if (result.success) {
    // Update last backup date
    saveBackupSettings({ lastBackupDate: new Date().toISOString() });

    // Apply retention policy
    await applyRetentionPolicy();
  }

  return result;
}

/**
 * Run scheduled backup check
 */
async function runScheduledBackupCheck(): Promise<void> {
  if (isBackupDue()) {
    logger.info('Scheduled backup is due, creating backup...');
    const result = await createBackupWithTracking();
    if (result.success) {
      logger.info(`Scheduled backup completed: ${result.fileName}`);
    } else {
      logger.error(`Scheduled backup failed: ${result.error}`);
    }
  }
}

/**
 * Start the scheduled backup service
 */
export function startScheduledBackups(): void {
  // Stop any existing interval
  stopScheduledBackups();

  const settings = getBackupSettings();

  if (!settings.enabled || settings.frequency === 'manual') {
    logger.info('Scheduled backups disabled or set to manual');
    return;
  }

  // Run initial check after a short delay (let app fully load)
  setTimeout(() => {
    runScheduledBackupCheck();
  }, 5000);

  // Set up periodic check
  scheduledBackupInterval = setInterval(runScheduledBackupCheck, BACKUP_CHECK_INTERVAL);
  logger.info(`Scheduled backups started (frequency: ${settings.frequency})`);
}

/**
 * Stop the scheduled backup service
 */
export function stopScheduledBackups(): void {
  if (scheduledBackupInterval) {
    clearInterval(scheduledBackupInterval);
    scheduledBackupInterval = null;
    logger.info('Scheduled backups stopped');
  }
}

/**
 * Restart scheduled backups (call after settings change)
 */
export function restartScheduledBackups(): void {
  stopScheduledBackups();
  startScheduledBackups();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get backup status summary
 */
export async function getBackupStatus(): Promise<{
  lastBackup: string | null;
  backupCount: number;
  totalSize: number;
  nextBackupDue: boolean;
  frequency: string;
  enabled: boolean;
}> {
  const settings = getBackupSettings();
  const backups = await listBackups();
  const totalSize = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

  return {
    lastBackup: settings.lastBackupDate,
    backupCount: backups.length,
    totalSize,
    nextBackupDue: isBackupDue(),
    frequency: settings.frequency,
    enabled: settings.enabled,
  };
}
