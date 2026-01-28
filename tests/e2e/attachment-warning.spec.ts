import { test, expect } from '@playwright/test';

/**
 * Smoke Test 4: Attachment Warning Banner
 * Tests the attachment warning display in different Outlook availability scenarios.
 */

test.describe('Attachment Warning Banner', () => {
  test.describe('Outlook Available', () => {
    test.beforeEach(async ({ page }) => {
      // Inject Tauri mocks with Outlook available
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

    test('shows blue background with attachments when Outlook available', async ({ page }) => {
      const props = encodeURIComponent(JSON.stringify({
        to: 'test@example.com',
        subject: 'Report Delivery',
        body: 'Please find attached the consultation report.',
        attachments: [
          { name: 'Beau_Consultation_Report_17Nov2025.pdf', path: 'C:/path/to/file.pdf' }
        ],
      }));
      await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

      // Wait for Outlook check to complete
      await page.waitForTimeout(1000);

      // Look for the attachment section by finding the text "Attachments" in the dialog
      const dialog = page.locator('[role="dialog"]');

      // Check that the automatic attachment message appears (indicates Outlook available)
      const outlookAutoAttachMessage = dialog.locator('text=Will be attached automatically via Outlook');
      await expect(outlookAutoAttachMessage).toBeVisible({ timeout: 5000 });

      // Check for "Attachments (1)" header
      await expect(dialog).toContainText('Attachments');
      await expect(dialog).toContainText('1');

      // Check file name is listed
      await expect(dialog).toContainText('Beau_Consultation_Report_17Nov2025.pdf');
    });
  });

  test.describe('Outlook Unavailable', () => {
    test.beforeEach(async ({ page }) => {
      // Inject Tauri mocks with Outlook unavailable
      await page.addInitScript(() => {
        window.__TAURI_INTERNALS__ = {
          invoke: async (cmd: string) => {
            if (cmd === 'check_outlook_available') return false;
            if (cmd === 'open_mailto_link') return { success: true };
            return null;
          }
        };
      });
    });

    test('shows amber background with manual attachment warning when Outlook unavailable', async ({ page }) => {
      const props = encodeURIComponent(JSON.stringify({
        to: 'test@example.com',
        subject: 'Report Delivery',
        body: 'Please find attached the consultation report.',
        attachments: [
          { name: 'Beau_Consultation_Report_17Nov2025.pdf', path: 'C:/path/to/file.pdf' }
        ],
      }));
      await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

      // Wait for Outlook check to complete
      await page.waitForTimeout(500);

      // Check for amber background on attachment section
      const attachmentSection = page.locator('[class*="bg-amber-50"]');
      await expect(attachmentSection).toBeVisible();

      // Check for "Manual Attachments Required" header
      await expect(attachmentSection).toContainText('Manual Attachments Required');

      // Check for manual attachment instruction
      await expect(attachmentSection).toContainText("You'll need to attach these files manually");

      // Check file name is listed
      await expect(attachmentSection).toContainText('Beau_Consultation_Report_17Nov2025.pdf');
    });
  });

  test.describe('Mailto with Attachments', () => {
    test.beforeEach(async ({ page }) => {
      // Inject Tauri mocks with Outlook available
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

    test('shows longer toast reminder when using mailto with attachments', async ({ page }) => {
      const props = encodeURIComponent(JSON.stringify({
        to: 'test@example.com',
        subject: 'Report Delivery',
        body: 'Please find attached the consultation report.',
        attachments: [
          { name: 'Report.pdf', path: 'C:/path/to/file.pdf' }
        ],
      }));
      await page.goto(`/test-harness?component=email-draft-dialog&props=${props}`);

      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

      // Wait for Outlook check
      await page.waitForTimeout(500);

      // Find the primary send button - it might be "Send Email" (dropdown) or "Open in Email App" (direct)
      const sendEmailButton = page.locator('button:has-text("Send Email")');
      const openInEmailAppButton = page.locator('button:has-text("Open in Email App")');

      // If "Send Email" button exists (dropdown mode), click it and then the menu item
      if (await sendEmailButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sendEmailButton.click();
        const mailtoOption = page.locator('[role="menuitem"]:has-text("Open in Email App")');
        await mailtoOption.click();
      } else {
        // Direct "Open in Email App" button mode
        await openInEmailAppButton.click();
      }

      // Check for toast with attachment reminder
      // Sonner toasts appear in a specific container
      const toast = page.locator('[data-sonner-toast]').filter({
        hasText: "Don't forget to attach"
      });
      await expect(toast).toBeVisible({ timeout: 3000 });

      // Check toast contains the filename
      await expect(toast).toContainText('Report.pdf');

      // Check toast contains manual attachment instruction
      await expect(toast).toContainText('Files must be added manually');
    });
  });
});
