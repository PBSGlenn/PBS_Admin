// PBS Admin - Auto-Start Service
// Manages Windows auto-start via Tauri plugin

import { invoke } from "@tauri-apps/api/core";

/**
 * Check if auto-start is currently enabled
 */
export async function isAutoStartEnabled(): Promise<boolean> {
  try {
    return await invoke<boolean>("plugin:autostart|is_enabled");
  } catch (error) {
    console.error("Failed to check auto-start status:", error);
    return false;
  }
}

/**
 * Enable auto-start at Windows login
 */
export async function enableAutoStart(): Promise<{ success: boolean; error?: string }> {
  try {
    await invoke("plugin:autostart|enable");
    return { success: true };
  } catch (error) {
    console.error("Failed to enable auto-start:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Disable auto-start at Windows login
 */
export async function disableAutoStart(): Promise<{ success: boolean; error?: string }> {
  try {
    await invoke("plugin:autostart|disable");
    return { success: true };
  } catch (error) {
    console.error("Failed to disable auto-start:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Toggle auto-start state
 */
export async function toggleAutoStart(enable: boolean): Promise<{ success: boolean; error?: string }> {
  if (enable) {
    return enableAutoStart();
  } else {
    return disableAutoStart();
  }
}

// Settings key for minimize to tray preference
const MINIMIZE_TO_TRAY_KEY = "pbs_admin_minimize_to_tray";

/**
 * Get minimize to tray preference
 */
export function getMinimizeToTray(): boolean {
  const value = localStorage.getItem(MINIMIZE_TO_TRAY_KEY);
  // Default to true (minimize to tray enabled by default)
  return value === null ? true : value === "true";
}

/**
 * Set minimize to tray preference
 */
export function setMinimizeToTray(enabled: boolean): void {
  localStorage.setItem(MINIMIZE_TO_TRAY_KEY, String(enabled));
}
