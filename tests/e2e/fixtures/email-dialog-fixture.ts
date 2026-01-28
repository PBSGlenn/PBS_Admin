import { test as base, Page, expect } from '@playwright/test';

// Extended test fixture for email dialog testing
export interface EmailDialogTestContext {
  page: Page;
  mockOutlook: (available: boolean, sendSuccess?: boolean) => Promise<void>;
  openEmailDialog: (options?: EmailDialogOptions) => Promise<void>;
  getToField: () => Promise<ReturnType<Page['locator']>>;
  getCcField: () => Promise<ReturnType<Page['locator']>>;
  getSubjectField: () => Promise<ReturnType<Page['locator']>>;
  getBodyField: () => Promise<ReturnType<Page['locator']>>;
  getCopyButton: () => Promise<ReturnType<Page['locator']>>;
  getSendButton: () => Promise<ReturnType<Page['locator']>>;
  getMarkAsSentButton: () => Promise<ReturnType<Page['locator']>>;
  getAttachmentSection: () => Promise<ReturnType<Page['locator']>>;
  waitForDialog: () => Promise<void>;
  closeDialog: () => Promise<void>;
}

interface EmailDialogOptions {
  to?: string;
  subject?: string;
  body?: string;
  cc?: string;
  attachments?: Array<{ name: string; path: string }>;
  outlookAvailable?: boolean;
}

// Helper to inject Tauri mocks into the page
async function injectTauriMocks(page: Page, outlookAvailable: boolean = true, outlookSendSuccess: boolean = true) {
  await page.addInitScript(`
    // Create mock Tauri API
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        console.log('[Tauri Mock] invoke:', cmd, args);

        switch (cmd) {
          case 'check_outlook_available':
            return ${outlookAvailable};

          case 'open_outlook_draft':
            if (!${outlookSendSuccess}) {
              return { success: false, error: 'Outlook COM error: Failed to create draft' };
            }
            return { success: true };

          case 'open_mailto_link':
            return { success: true };

          case 'write_text_file':
          case 'write_binary_file':
            return { success: true };

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

    // Also expose on window.__TAURI__ for compatibility
    window.__TAURI__ = {
      core: {
        invoke: window.__TAURI_INTERNALS__.invoke
      }
    };

    console.log('[Tauri Mock] Initialized');
  `);
}

// Helper to open the email dialog via page manipulation
// Since we can't easily trigger the dialog opening through normal navigation,
// we'll create a test harness component
async function createTestHarness(page: Page, options: EmailDialogOptions = {}) {
  const dialogOptions = {
    to: options.to || 'test@example.com',
    subject: options.subject || 'Test Subject',
    body: options.body || 'Test body content',
    cc: options.cc || '',
    attachments: options.attachments || [],
    outlookAvailable: options.outlookAvailable ?? true,
  };

  // Inject a script that opens the email dialog with test data
  await page.evaluate((opts) => {
    // Store test options for the dialog
    (window as any).__TEST_EMAIL_DIALOG_OPTIONS__ = opts;
  }, dialogOptions);
}

export const test = base.extend<{ emailDialog: EmailDialogTestContext }>({
  emailDialog: async ({ page }, use) => {
    // Default: inject mocks with Outlook available
    await injectTauriMocks(page, true, true);

    const context: EmailDialogTestContext = {
      page,

      async mockOutlook(available: boolean, sendSuccess: boolean = true) {
        // Re-inject mocks with new settings
        await page.evaluate(({ available, sendSuccess }) => {
          (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args: any) => {
            console.log('[Tauri Mock] invoke:', cmd, args);

            if (cmd === 'check_outlook_available') {
              return available;
            }
            if (cmd === 'open_outlook_draft') {
              if (!sendSuccess) {
                return { success: false, error: 'Outlook COM error: Failed to create draft' };
              }
              return { success: true };
            }
            if (cmd === 'open_mailto_link') {
              return { success: true };
            }
            return null;
          };
        }, { available, sendSuccess });
      },

      async openEmailDialog(options: EmailDialogOptions = {}) {
        await createTestHarness(page, options);
      },

      async getToField() {
        return page.locator('#email-to');
      },

      async getCcField() {
        return page.locator('#email-cc');
      },

      async getSubjectField() {
        return page.locator('#email-subject');
      },

      async getBodyField() {
        return page.locator('#email-body');
      },

      async getCopyButton() {
        return page.locator('button:has-text("Copy Email")');
      },

      async getSendButton() {
        return page.locator('button:has-text("Send Email"), button:has-text("Open in Email App")');
      },

      async getMarkAsSentButton() {
        return page.locator('button:has-text("Mark as Sent")');
      },

      async getAttachmentSection() {
        return page.locator('[class*="bg-amber-50"], [class*="bg-blue-50"]').filter({
          has: page.locator('text=Attachments, text=Manual Attachments Required')
        });
      },

      async waitForDialog() {
        await page.waitForSelector('[role="dialog"]');
      },

      async closeDialog() {
        await page.locator('button:has-text("Cancel")').click();
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      },
    };

    await use(context);
  },
});

export { expect };
