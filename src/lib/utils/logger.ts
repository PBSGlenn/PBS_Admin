// PBS Admin - Logger Utility
// Centralized logging that can be controlled via environment/config
// In production, debug logs can be disabled while keeping errors

const IS_DEV = import.meta.env.DEV;

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Enable/disable specific log levels
const LOG_CONFIG = {
  debug: IS_DEV,  // Only in development
  info: IS_DEV,   // Only in development
  warn: true,     // Always show warnings
  error: true,    // Always show errors
};

/**
 * Logger with level-based filtering
 * Use instead of console.log/error/warn for cleaner production output
 */
export const logger = {
  /**
   * Debug logging - only in development
   * Use for verbose debugging information
   */
  debug: (...args: unknown[]) => {
    if (LOG_CONFIG.debug) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logging - only in development
   * Use for general information about app state
   */
  info: (...args: unknown[]) => {
    if (LOG_CONFIG.info) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * Warning logging - always shown
   * Use for non-critical issues that should be addressed
   */
  warn: (...args: unknown[]) => {
    if (LOG_CONFIG.warn) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Error logging - always shown
   * Use for errors that need attention
   */
  error: (...args: unknown[]) => {
    if (LOG_CONFIG.error) {
      console.error('[ERROR]', ...args);
    }
  },

  /**
   * Log with custom level check
   */
  log: (level: LogLevel, ...args: unknown[]) => {
    if (LOG_CONFIG[level]) {
      const prefix = `[${level.toUpperCase()}]`;
      if (level === 'error') {
        console.error(prefix, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, ...args);
      } else {
        console.log(prefix, ...args);
      }
    }
  },
};

// Export helper for common patterns
export const logError = (context: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`${context}:`, message);
};

export const logDebug = (context: string, ...args: unknown[]) => {
  logger.debug(`[${context}]`, ...args);
};
