# Email Handling - Smoke Tests for Option 1

Quick verification tests for the Option 1 email consolidation changes.

---

## Test 1: Template ID Logging (Dog vs Cat)

### Setup
1. Create a test client with a **dog** pet
2. Create a Booking event for that client
3. The automation should create a "Check questionnaire returned" task

### Steps
1. Open Dashboard → Tasks
2. Click on the questionnaire task to open details
3. Click "Send Reminder" button
4. In EmailDraftDialog, click "Send via Outlook" or "Copy Email"
5. Check the created Note event in the client's Events table

### Expected
- Event notes should contain `<!--EMAIL_LOG:...-->` with:
  - `"templateId": "questionnaire-reminder-dog"` (not generic "questionnaire-reminder")
  - `"sentVia": "outlook"` or `"clipboard"` depending on method

### Repeat with Cat
- Create client with a **cat** pet
- Verify `"templateId": "questionnaire-reminder-cat"`

---

## Test 2: Email Validation

### Steps
1. Open any EmailDraftDialog (via Send Reminder or report email)
2. Clear the "To" field and type: `not-an-email`
3. Observe the To field and Send buttons

### Expected
- Red border appears on To field
- Error message shows below: "Please enter a valid email address"
- All send buttons (Copy Email, Send Email dropdown) are **disabled**

### Additional
4. Type a valid email: `test@example.com`
5. Buttons should become **enabled**
6. Error should disappear

### CC Field
7. Enter invalid email in CC field
8. Verify same validation behavior (red border, error, disabled buttons)

---

## Test 3: Quick-Send Logging Callback

### Setup
This test verifies the `onEmailSent` callback fires. Currently, parents don't implement logging, but the callback should fire without errors.

### Steps
1. Open a Client in ClientView
2. Right-click on the Email field
3. Select "Quick send via Outlook"

### Expected
- If Outlook available: Opens Outlook draft, shows success toast
- If Outlook unavailable: Opens EmailDraftDialog instead
- No console errors about undefined callbacks

### Note
Actual logging requires parent components to implement the callback. This test just verifies the mechanism works.

### Additional: Single Fire Check
If Outlook fails and dialog opens as fallback:
1. Right-click email field → "Quick send via Outlook"
2. Outlook fails → Dialog opens
3. Send via dialog (any method)

**Expected**: `onEmailSent` fires **once** (from dialog), not twice (no phantom quick-send log)

---

## Test 4: Attachment Warning Banner

### Setup
1. Generate a consultation report (DOCX or PDF)
2. Open the email dialog for that report (via ReportSentEventPanel)

### Scenario A: Outlook Available
1. Open EmailDraftDialog with attachments
2. Observe the attachments section

### Expected (Outlook Available)
- Blue background on attachment section
- Shows "Attachments (1)" header
- Shows "✓ Will be attached automatically via Outlook" message
- File name listed

### Scenario B: Outlook Unavailable

**How to simulate Outlook unavailable:**
1. **Machine without Outlook**: Test on a machine without Microsoft Office installed
2. **Mock in code** (temporary): In `outlookEmailService.ts`, temporarily modify `checkOutlookAvailable()`:
   ```typescript
   export async function checkOutlookAvailable(): Promise<boolean> {
     return false; // Force unavailable for testing
   }
   ```
3. **Close Outlook completely**: Some systems may report unavailable if Outlook is not running

### Expected (Outlook Unavailable)
- **Amber background** on attachment section
- Shows "📎 Manual Attachments Required" header
- Shows "You'll need to attach these files manually:"
- File name listed with bullet point

### Scenario C: Send via Mailto with Attachments
1. With attachments present, click "Open in Email App"

### Expected
- Toast appears for **6 seconds** (longer than normal)
- Toast message: "Don't forget to attach: [filename]"
- Description: "Files must be added manually in your email app."

---

## Test 5: Mark as Sent (Manual)

### Steps
1. Open EmailDraftDialog for any email
2. **Do not** click any send button
3. Click "Mark as Sent (Manual)" button

### Expected
- Toast: "Email marked as sent (manual confirmation)"
- Dialog closes
- Created event log shows `"sentVia": "manual"` (not "outlook")

---

## Test 6: Failed Outlook Attempt

### Setup
Requires simulating Outlook failure (e.g., force close Outlook, or test with mock)

### Steps
1. Open EmailDraftDialog
2. Click "Send via Outlook"
3. Simulate failure (Outlook not responding, COM error, etc.)

### Expected
- Error toast appears: "Could not open Outlook"
- Dialog stays open (doesn't close)
- Warning appears: "⚠️ outlook may not have sent. Only mark as sent if you confirmed delivery."
- `onEmailSent` is **NOT** called (no log entry created)
- User can retry or use "Mark as Sent (Manual)"

### Additional Verification
After failed Outlook attempt:
1. Verify `sendAttempted` state shows `{ method: "outlook", success: false }`
   - Amber warning text should be visible
2. Click "Mark as Sent (Manual)"
3. Verify log shows `"sentVia": "manual"` (not "outlook")
4. Verify user had to make conscious choice to mark as sent

---

## Test 7: sentVia Type in Logs

After running various send scenarios, verify the logs show correct methods:

| Action | Expected sentVia |
|--------|------------------|
| Send via Outlook (success) | `"outlook"` |
| Open in Email App | `"mailto"` |
| Copy Email | `"clipboard"` |
| Mark as Sent (Manual) | `"manual"` |

Check logs in:
- Event notes (human-readable table shows "Outlook", "Email App", "Clipboard", "Manual")
- Event notes (machine-readable JSON in HTML comment)

---

## Test 8: CC Field Validation

### Empty CC (should be allowed)
1. Open EmailDraftDialog
2. Leave CC field empty
3. Fill in valid To, Subject, Body

### Expected
- No error on CC field
- Send buttons **enabled**
- Empty CC is valid (optional field)

### Malformed CC (should block)
1. Open EmailDraftDialog
2. Enter valid To email
3. Enter `not-valid-cc` in CC field
4. Fill in Subject and Body

### Expected
- Red border on CC field
- Error message: "Please enter a valid email address"
- Send buttons **disabled**

### Valid CC
1. Clear CC or enter `valid@example.com`

### Expected
- Error clears
- Send buttons **enabled**

---

## Quick Checklist

- [ ] Dog reminder logs `questionnaire-reminder-dog`
- [ ] Cat reminder logs `questionnaire-reminder-cat`
- [ ] Invalid To email shows red border + error
- [ ] Invalid To email disables send buttons
- [ ] Valid To email enables send buttons
- [ ] Empty CC field is allowed (no error)
- [ ] Invalid CC shows red border + error + disables buttons
- [ ] Quick-send fires without console errors
- [ ] Quick-send fires only once (not twice on dialog fallback)
- [ ] Attachments show blue when Outlook available
- [ ] Attachments show amber when Outlook unavailable
- [ ] Mailto with attachments shows 6-second toast reminder
- [ ] "Mark as Sent (Manual)" logs as `manual`
- [ ] Failed Outlook shows warning, doesn't auto-log
- [ ] After failed Outlook, Mark as Sent still requires manual intent
