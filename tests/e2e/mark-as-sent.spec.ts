import { test, expect } from '@playwright/test';

/**
 * Smoke Test 5 & 6: Mark as Sent and Failed Outlook Attempt
 * Tests the Mark as Sent (Manual) functionality and failed Outlook handling.
 */

test.describe('Mark as Sent (Manual)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mocks with Outlook available
    await page.addInitScript(() => {
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'check_outlook_available') return 'available';
          if (cmd === 'open_outlook_draft') return { success: true };
          if (cmd === 'open_mailto_link') return { success: true };
          return null;
        }
      };
    });
  });

  test('Mark as Sent button logs method as "manual"', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Click "Mark as Sent (Manual)" button
    const markAsSentButton = page.locator('button:has-text("Mark as Sent")');
    await expect(markAsSentButton).toBeVisible();
    await markAsSentButton.click();

    // Check for success toast
    const toast = page.locator('[data-sonner-toast]').filter({
      hasText: 'marked as sent'
    });
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText('manual confirmation');

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Check the email log in the test harness shows "manual" method
    const emailLog = page.locator('[data-testid="email-log-0"]');
    await expect(emailLog).toContainText('manual');
  });

  test('Mark as Sent does NOT trigger without send', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Cancel without clicking any send button
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // No email log should be recorded
    const emailLogs = page.locator('[data-testid="email-logs"]');
    await expect(emailLogs).toContainText('No emails sent yet');
  });
});

test.describe('Failed Outlook Attempt', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mocks with Outlook available but send fails
    // Note: openOutlookDraft catches thrown errors, so we throw instead of returning failure
    await page.addInitScript(() => {
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'check_outlook_available') return 'available';
          if (cmd === 'open_outlook_draft') {
            throw new Error('Outlook COM error: Application not responding');
          }
          if (cmd === 'open_mailto_link') return { success: true };
          return null;
        }
      };
    });
  });

  test('failed Outlook shows error toast and keeps dialog open', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500); // Wait for Outlook check

    // Open dropdown and click "Send via Outlook"
    const sendButton = page.locator('button:has-text("Send Email")');
    await sendButton.click();

    const outlookOption = page.locator('[role="menuitem"]:has-text("Send via Outlook")');
    await outlookOption.click();

    // Check for error toast
    const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    await expect(errorToast).toBeVisible({ timeout: 3000 });
    await expect(errorToast).toContainText('Could not open Outlook');

    // Dialog should stay open
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('failed Outlook shows warning message and does NOT log email', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Attempt to send via Outlook (will fail)
    const sendButton = page.locator('button:has-text("Send Email")');
    await sendButton.click();

    const outlookOption = page.locator('[role="menuitem"]:has-text("Send via Outlook")');
    await outlookOption.click();

    // Wait for error to appear
    await page.waitForTimeout(1000);

    // Check for warning message about uncertain send status
    const warningMessage = page.locator('text=may not have sent');
    await expect(warningMessage).toBeVisible();
    await expect(warningMessage).toContainText('Only mark as sent if you confirmed delivery');

    // No email should be logged yet (only user's conscious choice to Mark as Sent should log)
    const emailLogs = page.locator('[data-testid="email-logs"]');
    await expect(emailLogs).toContainText('No emails sent yet');
  });

  test('after failed Outlook, Mark as Sent still logs as "manual"', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Attempt to send via Outlook (will fail)
    const sendButton = page.locator('button:has-text("Send Email")');
    await sendButton.click();

    const outlookOption = page.locator('[role="menuitem"]:has-text("Send via Outlook")');
    await outlookOption.click();

    // Wait for failure
    await page.waitForTimeout(1000);

    // Now click Mark as Sent (Manual)
    const markAsSentButton = page.locator('button:has-text("Mark as Sent")');
    await markAsSentButton.click();

    // Check that it logs as "manual" NOT "outlook"
    const emailLog = page.locator('[data-testid="email-log-0"]');
    await expect(emailLog).toContainText('manual');
    await expect(emailLog).not.toContainText('outlook');

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});

test.describe('sentVia Type Verification', () => {
  test('successful Outlook logs method as "outlook"', async ({ page }) => {
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

    // Wait for dialog to close (success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });

    // Check email log shows "outlook"
    const emailLog = page.locator('[data-testid="email-log-0"]');
    await expect(emailLog).toContainText('outlook');
  });

  test('mailto logs method as "mailto"', async ({ page }) => {
    await page.addInitScript(() => {
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

    // Open dropdown and send via Email App
    const sendButton = page.locator('button:has-text("Send Email")');
    await sendButton.click();

    const mailtoOption = page.locator('[role="menuitem"]:has-text("Open in Email App")');
    await mailtoOption.click();

    // Wait for dialog to close (success)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });

    // Check email log shows "mailto"
    const emailLog = page.locator('[data-testid="email-log-0"]');
    await expect(emailLog).toContainText('mailto');
  });

  test('clipboard logs method as "clipboard"', async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'check_outlook_available') return 'available';
          return null;
        }
      };
    });

    // Grant clipboard permissions for the test
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Click Copy Email
    const copyButton = page.locator('button:has-text("Copy Email")');
    await copyButton.click();

    // Wait for toast
    await page.waitForTimeout(500);

    // Check email log shows "clipboard"
    const emailLog = page.locator('[data-testid="email-log-0"]');
    await expect(emailLog).toContainText('clipboard');
  });
});
