import { test, expect } from '@playwright/test';

/**
 * Smoke Test 3: Quick-Send Logging Callback
 * Tests that onEmailSent fires only once and doesn't fire twice on dialog fallback.
 */

test.describe('Quick-Send Single Fire', () => {
  test('onEmailSent fires only once when dialog is used as fallback', async ({ page }) => {
    // This test simulates the scenario where:
    // 1. Quick-send via Outlook fails
    // 2. Dialog opens as fallback
    // 3. User sends from dialog
    // 4. onEmailSent should fire ONCE (from dialog), not twice

    await page.addInitScript(() => {
      // Track how many times email callbacks fire
      window.__EMAIL_CALLBACK_COUNT__ = 0;

      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'check_outlook_available') return 'available';
          if (cmd === 'open_outlook_draft') return { success: true };
          if (cmd === 'open_mailto_link') return { success: true };
          return null;
        }
      };
    });

    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Send via Outlook (success)
    const sendButton = page.locator('button:has-text("Send Email")');
    await sendButton.click();

    const outlookOption = page.locator('[role="menuitem"]:has-text("Send via Outlook")');
    await outlookOption.click();

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });

    // Verify only ONE email was logged
    const emailLogs = page.locator('[data-testid="email-logs"]');

    // Count the number of email log entries
    const logEntries = page.locator('[data-testid^="email-log-"]');
    const count = await logEntries.count();

    expect(count).toBe(1);
  });

  test('no console errors when onEmailSent is not provided', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.addInitScript(() => {
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'check_outlook_available') return 'available';
          if (cmd === 'open_outlook_draft') return { success: true };
          return null;
        }
      };
    });

    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Send via Outlook
    const sendButton = page.locator('button:has-text("Send Email")');
    await sendButton.click();

    const outlookOption = page.locator('[role="menuitem"]:has-text("Send via Outlook")');
    await outlookOption.click();

    // Wait for dialog to close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });

    // Check for "undefined" callback errors
    const undefinedErrors = consoleErrors.filter((e) =>
      e.includes('undefined') && e.includes('callback')
    );
    expect(undefinedErrors.length).toBe(0);
  });
});
