// Tauri API mocks for Playwright testing
// These mocks simulate Tauri backend behavior in the browser

export interface TauriMockConfig {
  outlookAvailable: boolean;
  outlookSendSuccess: boolean;
  fileSystemEnabled: boolean;
}

export const defaultMockConfig: TauriMockConfig = {
  outlookAvailable: true,
  outlookSendSuccess: true,
  fileSystemEnabled: true,
};

/**
 * Inject Tauri mocks into the page
 * This creates a fake window.__TAURI__ object that the app can use
 */
export function createTauriMockScript(config: Partial<TauriMockConfig> = {}): string {
  const fullConfig = { ...defaultMockConfig, ...config };

  return `
    // Mock Tauri core module
    window.__TAURI__ = {
      core: {
        invoke: async (cmd, args) => {
          console.log('[Tauri Mock] invoke:', cmd, args);

          switch (cmd) {
            case 'check_outlook_available':
              return ${fullConfig.outlookAvailable};

            case 'open_outlook_draft':
              if (!${fullConfig.outlookSendSuccess}) {
                throw new Error('Outlook COM error: Failed to create draft');
              }
              return { success: true };

            case 'write_text_file':
            case 'write_binary_file':
              if (!${fullConfig.fileSystemEnabled}) {
                throw new Error('File system access denied');
              }
              return { success: true, path: args.filePath || '/mock/path/file.txt' };

            case 'create_folder':
              return '/mock/client/folder';

            case 'get_default_client_records_path':
              return 'C:/Users/Mock/Documents/PBS_Admin/Client_Records';

            case 'plugin:opener|open_path':
            case 'plugin:opener|open_url':
              console.log('[Tauri Mock] Opening:', args.path || args.url);
              return;

            default:
              console.warn('[Tauri Mock] Unhandled command:', cmd);
              return null;
          }
        }
      }
    };

    // Mock @tauri-apps/api/core
    window.__TAURI_INTERNALS__ = {
      invoke: window.__TAURI__.core.invoke
    };

    console.log('[Tauri Mock] Initialized with config:', ${JSON.stringify(fullConfig)});
  `;
}

/**
 * Create a script that overrides the outlook service checks
 */
export function createOutlookMockScript(available: boolean, sendSuccess: boolean = true): string {
  return `
    // Override checkOutlookAvailable to return mock value
    window.__MOCK_OUTLOOK_AVAILABLE__ = ${available};
    window.__MOCK_OUTLOOK_SEND_SUCCESS__ = ${sendSuccess};

    // Intercept the outlook service module
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      // Let other requests through
      return originalFetch.apply(window, args);
    };

    console.log('[Outlook Mock] Available:', ${available}, 'Send Success:', ${sendSuccess});
  `;
}

/**
 * Helper to inject Outlook available mock into a Playwright page
 * Note: checkOutlookAvailable expects string "available", not boolean
 */
export async function mockOutlookAvailable(page: any, available: boolean): Promise<void> {
  await page.addInitScript(`
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    const originalInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      if (cmd === 'check_outlook_available') {
        return ${available ? "'available'" : "'unavailable'"};
      }
      if (originalInvoke) return originalInvoke(cmd, args);
      return null;
    };
  `);
}

/**
 * Helper to inject Outlook send success mock into a Playwright page
 */
export async function mockOutlookSuccess(page: any): Promise<void> {
  await page.addInitScript(`
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    const originalInvoke = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      if (cmd === 'check_outlook_available') return 'available';
      if (cmd === 'open_outlook_draft') return { success: true };
      if (cmd === 'open_mailto_link') return { success: true };
      if (originalInvoke) return originalInvoke(cmd, args);
      return null;
    };
  `);
}

/**
 * Helper to inject Outlook send failure mock into a Playwright page
 */
export async function mockOutlookFailure(page: any): Promise<void> {
  await page.addInitScript(`
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      if (cmd === 'check_outlook_available') return 'available';
      if (cmd === 'open_outlook_draft') {
        throw new Error('Outlook COM error: Application not responding');
      }
      if (cmd === 'open_mailto_link') return { success: true };
      return null;
    };
  `);
}

/**
 * Full Tauri mock setup for E2E tests
 * Includes all common commands needed for app functionality
 */
export async function setupFullTauriMocks(page: any, options: Partial<TauriMockConfig> = {}): Promise<void> {
  const config = { ...defaultMockConfig, ...options };

  await page.addInitScript(`
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        console.log('[Tauri Mock] invoke:', cmd, args);

        switch (cmd) {
          case 'check_outlook_available':
            return ${config.outlookAvailable ? "'available'" : "'unavailable'"};

          case 'open_outlook_draft':
            if (!${config.outlookSendSuccess}) {
              throw new Error('Outlook COM error: Failed to create draft');
            }
            return { success: true };

          case 'open_mailto_link':
            return { success: true };

          case 'write_text_file':
          case 'write_binary_file':
            if (!${config.fileSystemEnabled}) {
              throw new Error('File system access denied');
            }
            return { success: true, path: args?.filePath || '/mock/path/file.txt' };

          case 'create_folder':
            return '/mock/client/folder';

          case 'get_default_client_records_path':
            return 'C:/Users/Mock/Documents/PBS_Admin/Client_Records';

          case 'plugin:opener|open_path':
          case 'plugin:opener|open_url':
            console.log('[Tauri Mock] Opening:', args?.path || args?.url);
            return;

          default:
            console.warn('[Tauri Mock] Unhandled command:', cmd);
            return null;
        }
      }
    };

    window.__TAURI__ = {
      core: {
        invoke: window.__TAURI_INTERNALS__.invoke
      }
    };

    console.log('[Tauri Mock] Full setup initialized');
  `);
}
