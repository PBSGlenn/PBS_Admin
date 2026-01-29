// PBS Admin - useWindow Hook
// Simplified interface for opening and managing windows

import { ReactNode, useCallback } from "react";
import { useWindowContext, OpenWindowOptions } from "@/contexts/WindowContext";

interface UseWindowReturn {
  // Open a window with the given options
  openWindow: (options: OpenWindowOptions) => void;
  // Close a window by ID
  closeWindow: (id: string) => void;
  // Minimize a window by ID
  minimizeWindow: (id: string) => void;
  // Restore a minimized window
  restoreWindow: (id: string) => void;
  // Focus a window (bring to front)
  focusWindow: (id: string) => void;
  // Check if a window is open
  isWindowOpen: (id: string) => boolean;
  // Get window data
  getWindowData: <T extends Record<string, unknown>>(id: string) => T | undefined;
  // Update window data
  updateWindowData: (id: string, data: Record<string, unknown>) => void;
}

export function useWindow(): UseWindowReturn {
  const context = useWindowContext();

  const getWindowData = useCallback(
    <T extends Record<string, unknown>>(id: string): T | undefined => {
      const window = context.getWindow(id);
      return window?.data as T | undefined;
    },
    [context]
  );

  return {
    openWindow: context.openWindow,
    closeWindow: context.closeWindow,
    minimizeWindow: context.minimizeWindow,
    restoreWindow: context.restoreWindow,
    focusWindow: context.focusWindow,
    isWindowOpen: context.isWindowOpen,
    getWindowData,
    updateWindowData: context.updateWindowData,
  };
}

// ============================================================================
// Helper function to create window IDs
// ============================================================================

/**
 * Generate a unique window ID based on type and optional entity ID
 * @param type - Type of window (e.g., "client", "event", "task")
 * @param entityId - Optional entity ID for specific records
 */
export function createWindowId(type: string, entityId?: string | number): string {
  if (entityId !== undefined) {
    return `${type}-${entityId}`;
  }
  return `${type}-${Date.now()}`;
}

// ============================================================================
// Predefined window configurations
// ============================================================================

export interface WindowConfig {
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
}

export const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  client: {
    defaultSize: { width: 1200, height: 800 },
    minSize: { width: 800, height: 600 },
  },
  event: {
    defaultSize: { width: 900, height: 700 },
    minSize: { width: 600, height: 500 },
  },
  task: {
    defaultSize: { width: 600, height: 500 },
    minSize: { width: 400, height: 400 },
  },
  settings: {
    defaultSize: { width: 700, height: 600 },
    minSize: { width: 500, height: 400 },
  },
};
