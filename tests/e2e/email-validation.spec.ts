import { test, expect } from '@playwright/test';

/**
 * Smoke Test 2 & 8: Email Validation
 * Tests that the EmailDraftDialog validates email addresses correctly.
 */

test.describe('Email Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mocks before navigation
    // Note: checkOutlookAvailable expects string "available", not boolean
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

  test('invalid To email shows red border and error message', async ({ page }) => {
    // Navigate to test harness with the email dialog
    const props = encodeURIComponent(JSON.stringify({
      to: '',
      subject: 'Test Subject',
      body: 'Test body content that is long enough.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    // Wait for dialog to open
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Find the To field and enter an invalid email
    const toField = page.locator('#email-to');
    await toField.fill('not-an-email');

    // Check for red border (focus-visible:ring-red-500 or border-red-500)
    const toFieldClasses = await toField.getAttribute('class');
    expect(toFieldClasses).toContain('border-red-500');

    // Check for error message
    const errorMessage = page.locator('p.text-red-500');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('valid email');
  });

  test('invalid To email disables send buttons', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'not-valid-email',
      subject: 'Test Subject',
      body: 'Test body content that is long enough.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Wait for Outlook availability check to complete
    await page.waitForTimeout(500);

    // Trigger validation by modifying the to field
    const toField = page.locator('#email-to');
    await toField.clear();
    await toField.fill('not-valid-email');

    // Check that Copy Email button is disabled
    const copyButton = page.locator('button:has-text("Copy Email")');
    await expect(copyButton).toBeDisabled();

    // Check that primary send button is disabled (text varies based on Outlook availability)
    // Use a locator that matches either "Send Email" or "Open in Email App"
    const sendButton = page.locator('button:has-text("Send Email"), button:has-text("Open in Email App")').first();
    await expect(sendButton).toBeDisabled();
  });

  test('valid To email enables send buttons', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: '',
      subject: 'Test Subject',
      body: 'Test body content that is long enough.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Wait for Outlook availability check to complete
    await page.waitForTimeout(500);

    // Enter a valid email
    const toField = page.locator('#email-to');
    await toField.fill('test@example.com');

    // Error should not be visible
    const errorMessage = page.locator('#email-to ~ p.text-red-500');
    await expect(errorMessage).not.toBeVisible();

    // Check that buttons are enabled
    const copyButton = page.locator('button:has-text("Copy Email")');
    await expect(copyButton).toBeEnabled();

    // Check that primary send button is enabled (text varies based on Outlook availability)
    const sendButton = page.locator('button:has-text("Send Email"), button:has-text("Open in Email App")').first();
    await expect(sendButton).toBeEnabled();
  });

  test('empty CC field is allowed (no error)', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Leave CC empty
    const ccField = page.locator('#email-cc');
    await expect(ccField).toHaveValue('');

    // No error on CC field
    const ccErrorMessage = page.locator('#email-cc ~ p.text-red-500');
    await expect(ccErrorMessage).not.toBeVisible();

    // Buttons should be enabled
    const copyButton = page.locator('button:has-text("Copy Email")');
    await expect(copyButton).toBeEnabled();
  });

  test('invalid CC shows red border, error, and disables buttons', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // Enter invalid CC
    const ccField = page.locator('#email-cc');
    await ccField.fill('not-valid-cc');

    // Check for red border
    const ccFieldClasses = await ccField.getAttribute('class');
    expect(ccFieldClasses).toContain('border-red-500');

    // Check for error message below CC
    const ccErrorMessage = page.locator('#email-cc').locator('..').locator('p.text-red-500');
    await expect(ccErrorMessage).toBeVisible();
    await expect(ccErrorMessage).toContainText('valid email');

    // Buttons should be disabled
    const copyButton = page.locator('button:has-text("Copy Email")');
    await expect(copyButton).toBeDisabled();
  });

  test('valid CC email clears error and enables buttons', async ({ page }) => {
    const props = encodeURIComponent(JSON.stringify({
      to: 'test@example.com',
      subject: 'Test Subject',
      body: 'Test body content.',
    }));
    await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    // First enter invalid CC
    const ccField = page.locator('#email-cc');
    await ccField.fill('not-valid-cc');

    // Verify error appears
    const ccErrorMessage = page.locator('#email-cc').locator('..').locator('p.text-red-500');
    await expect(ccErrorMessage).toBeVisible();

    // Now enter valid CC
    await ccField.clear();
    await ccField.fill('valid@example.com');

    // Error should disappear
    await expect(ccErrorMessage).not.toBeVisible();

    // Buttons should be enabled
    const copyButton = page.locator('button:has-text("Copy Email")');
    await expect(copyButton).toBeEnabled();
  });
});
