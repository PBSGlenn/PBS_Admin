// PBS Admin - Window Context
// Manages multi-window state for the application

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  title: string;
  icon?: ReactNode;
  component: ReactNode;
  position: WindowPosition;
  size: WindowSize;
  minSize?: WindowSize;
  maxSize?: WindowSize;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  // Optional data passed to the window
  data?: Record<string, unknown>;
}

export interface OpenWindowOptions {
  id: string;
  title: string;
  icon?: ReactNode;
  component: ReactNode;
  defaultPosition?: WindowPosition;
  defaultSize?: WindowSize;
  minSize?: WindowSize;
  maxSize?: WindowSize;
  data?: Record<string, unknown>;
}

interface WindowContextValue {
  windows: WindowState[];
  activeWindowId: string | null;
  openWindow: (options: OpenWindowOptions) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: WindowPosition) => void;
  updateWindowSize: (id: string, size: WindowSize) => void;
  updateWindowData: (id: string, data: Record<string, unknown>) => void;
  getWindow: (id: string) => WindowState | undefined;
  isWindowOpen: (id: string) => boolean;
}

// ============================================================================
// Context
// ============================================================================

const WindowContext = createContext<WindowContextValue | null>(null);

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WINDOW_SIZE: WindowSize = { width: 800, height: 600 };
const DEFAULT_MIN_SIZE: WindowSize = { width: 400, height: 300 };
const WINDOW_OFFSET = 30; // Offset for cascading new windows
const BASE_Z_INDEX = 100;

// ============================================================================
// Provider
// ============================================================================

interface WindowProviderProps {
  children: ReactNode;
}

export function WindowProvider({ children }: WindowProviderProps) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState(BASE_Z_INDEX);
  const [windowCount, setWindowCount] = useState(0);

  // Calculate default position for new window (cascade effect)
  const getDefaultPosition = useCallback((): WindowPosition => {
    const offset = (windowCount % 10) * WINDOW_OFFSET;
    return {
      x: 50 + offset,
      y: 50 + offset,
    };
  }, [windowCount]);

  // Open a new window or focus existing one
  const openWindow = useCallback((options: OpenWindowOptions) => {
    setWindows((prev) => {
      // Check if window already exists
      const existingIndex = prev.findIndex((w) => w.id === options.id);

      if (existingIndex !== -1) {
        // Window exists - restore if minimized and focus
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          isMinimized: false,
          zIndex: nextZIndex,
        };
        setNextZIndex((z) => z + 1);
        setActiveWindowId(options.id);
        return updated;
      }

      // Create new window
      const newWindow: WindowState = {
        id: options.id,
        title: options.title,
        icon: options.icon,
        component: options.component,
        position: options.defaultPosition || getDefaultPosition(),
        size: options.defaultSize || DEFAULT_WINDOW_SIZE,
        minSize: options.minSize || DEFAULT_MIN_SIZE,
        maxSize: options.maxSize,
        isMinimized: false,
        isMaximized: false,
        zIndex: nextZIndex,
        data: options.data,
      };

      setNextZIndex((z) => z + 1);
      setWindowCount((c) => c + 1);
      setActiveWindowId(options.id);

      return [...prev, newWindow];
    });
  }, [getDefaultPosition, nextZIndex]);

  // Close a window
  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const filtered = prev.filter((w) => w.id !== id);

      // Update active window if needed
      if (activeWindowId === id) {
        const topWindow = filtered
          .filter((w) => !w.isMinimized)
          .sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(topWindow?.id || null);
      }

      return filtered;
    });
  }, [activeWindowId]);

  // Minimize a window
  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const updated = prev.map((w) =>
        w.id === id ? { ...w, isMinimized: true } : w
      );

      // Update active window
      if (activeWindowId === id) {
        const topWindow = updated
          .filter((w) => !w.isMinimized)
          .sort((a, b) => b.zIndex - a.zIndex)[0];
        setActiveWindowId(topWindow?.id || null);
      }

      return updated;
    });
  }, [activeWindowId]);

  // Restore a minimized window
  const restoreWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, isMinimized: false, zIndex: nextZIndex }
          : w
      )
    );
    setNextZIndex((z) => z + 1);
    setActiveWindowId(id);
  }, [nextZIndex]);

  // Maximize/restore a window
  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
      )
    );
  }, []);

  // Focus a window (bring to front)
  const focusWindow = useCallback((id: string) => {
    setWindows((prev) => {
      const window = prev.find((w) => w.id === id);
      if (!window || window.zIndex === nextZIndex - 1) {
        // Already focused
        setActiveWindowId(id);
        return prev;
      }

      return prev.map((w) =>
        w.id === id ? { ...w, zIndex: nextZIndex } : w
      );
    });
    setNextZIndex((z) => z + 1);
    setActiveWindowId(id);
  }, [nextZIndex]);

  // Update window position
  const updateWindowPosition = useCallback((id: string, position: WindowPosition) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, position } : w))
    );
  }, []);

  // Update window size
  const updateWindowSize = useCallback((id: string, size: WindowSize) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w))
    );
  }, []);

  // Update window data
  const updateWindowData = useCallback((id: string, data: Record<string, unknown>) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, data: { ...w.data, ...data } } : w
      )
    );
  }, []);

  // Get a specific window
  const getWindow = useCallback(
    (id: string) => windows.find((w) => w.id === id),
    [windows]
  );

  // Check if a window is open
  const isWindowOpen = useCallback(
    (id: string) => windows.some((w) => w.id === id),
    [windows]
  );

  const value: WindowContextValue = {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    updateWindowData,
    getWindow,
    isWindowOpen,
  };

  return (
    <WindowContext.Provider value={value}>{children}</WindowContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useWindowContext(): WindowContextValue {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error("useWindowContext must be used within a WindowProvider");
  }
  return context;
}
