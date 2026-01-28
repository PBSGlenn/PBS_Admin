# Email Handling Consolidation Plan

## Current Issues Summary

1. **Divergent implementations**: ReportSentEventPanel vs ReportGeneratorDialog
2. **Fragmented logging**: REPORT_LOG vs EMAIL_LOG vs no logging
3. **Template ID mismatch**: Logs "questionnaire-reminder" but templates are species-specific
4. **"Mark as Sent" issues**: Hardcodes method even when no send occurred
5. **localStorage-only templates**: Don't persist across machines
6. **Mailto attachment gap**: Marks as sent but can't actually attach files
7. **Validation gap**: Invalid email addresses can slip through

---

## Option 1: Minimal Fixes

**Goal**: Fix critical bugs without architectural changes. Lowest risk, fastest delivery.

### Changes Required

#### 1.1 Fix Template ID Mismatch
**File**: [TasksOverview.tsx](../src/components/Dashboard/TasksOverview.tsx)

```typescript
// Line 179 - BEFORE
templateId: "questionnaire-reminder",

// AFTER
templateId: selectedTemplate?.id || "questionnaire-reminder",
```

Pass the actual template ID (`questionnaire-reminder-dog` or `questionnaire-reminder-cat`) from `getQuestionnaireReminderTemplate()`.

#### 1.2 Add Email Validation to EmailDraftDialog
**File**: [email-draft-dialog.tsx](../src/components/ui/email-draft-dialog.tsx)

```typescript
// Add import
import { validateEmail } from "@/lib/utils/validation";

// Add validation state
const [emailError, setEmailError] = useState<string | null>(null);

// Validate on change - validateEmail returns null if valid, error string if invalid
const handleToChange = (value: string) => {
  setTo(value);
  const error = validateEmail(value);  // Returns string|null
  setEmailError(error);  // null = valid, string = invalid
};

// Disable send buttons when invalid (emailError is truthy when invalid)
const canSend = to.trim() && subject.trim() && !emailError;
```

> **Note**: `validateEmail()` returns `null` for valid emails and a message string for invalid ones. A truthy return means invalid.

#### 1.3 Add Quick-Send Logging
**File**: [email-input.tsx](../src/components/ui/email-input.tsx)

Instead of threading `clientId` through every consumer of EmailInput (noisy), add an optional callback:

```typescript
// Add optional callback prop to EmailInput
interface EmailInputProps {
  // ... existing props
  onEmailSent?: (params: {
    to: string;
    subject: string;
    body: string;
    method: "outlook" | "mailto";
    templateId?: string;
  }) => void;
}

// In handleQuickSendOutlook, after successful send:
if (result.success) {
  onEmailSent?.({
    to: value,
    subject,
    body,
    method: "outlook",
    templateId: "general",
  });
}
```

**Parent usage** (e.g., ClientForm):
```typescript
<EmailInput
  value={email}
  onChange={setEmail}
  onEmailSent={({ to, subject, method, templateId }) => {
    // Parent has clientId context, can log appropriately
    const logEntry = createEmailLogEntry(to, subject, method, { templateId });
    createEmailSentEvent(clientId, logEntry);
  }}
/>
```

This keeps EmailInput generic while letting parents log when they have context.

#### 1.4 Fix "Mark as Sent" Method
**File**: [email-draft-dialog.tsx](../src/components/ui/email-draft-dialog.tsx)

**Issues to fix**:
1. Don't hardcode "outlook" when user clicks "Mark as Sent"
2. Show in UI/log when no transport actually occurred
3. Don't silently mark as sent on failed Outlook attempt

```typescript
// Update sentVia type in emailLogService.ts
sentVia: "outlook" | "mailto" | "clipboard" | "manual" | "unknown";

// Track actual send state
const [sendAttempted, setSendAttempted] = useState<{
  method: string;
  success: boolean;
} | null>(null);

// Outlook send handler - track success/failure
const handleSendViaOutlook = async () => {
  try {
    const result = await openOutlookDraft({ to, subject, body, attachments });
    if (result.success) {
      setSendAttempted({ method: "outlook", success: true });
      onEmailSent?.("outlook");
    } else {
      setSendAttempted({ method: "outlook", success: false });
      toast.error("Outlook failed to open. Email not sent.");
      // Do NOT call onEmailSent - let user retry or use Mark as Sent
    }
  } catch (error) {
    setSendAttempted({ method: "outlook", success: false });
    toast.error(`Failed: ${error}`);
  }
};

// "Mark as Sent" button - only for manual confirmation
<Button
  variant="outline"
  onClick={() => {
    // Log as manual - no transport was used through the app
    onEmailSent?.("manual");
    onMarkAsSent?.(to, subject, body, "manual");
    onClose();
  }}
>
  Mark as Sent (Manual)
</Button>

// Show status when send was attempted but may have failed
{sendAttempted && !sendAttempted.success && (
  <p className="text-xs text-amber-600">
    ⚠️ {sendAttempted.method} may not have sent. Use "Mark as Sent" only if you confirmed delivery.
  </p>
)}
```

This ensures:
- Failed Outlook attempts don't auto-log as sent
- "Mark as Sent" clearly indicates manual confirmation
- UI shows warning when transport status is uncertain

#### 1.5 Add Attachment Warning Banner (Non-Blocking)
**File**: [email-draft-dialog.tsx](../src/components/ui/email-draft-dialog.tsx)

Use a persistent banner instead of a confirm modal to reduce friction:

```typescript
// Show warning banner when attachments exist and Outlook unavailable or not chosen
{attachments && attachments.length > 0 && (
  <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
    <p className="font-medium text-amber-800">📎 Manual Attachments Required</p>
    <p className="text-amber-700 mt-1">
      {outlookAvailable
        ? "Use 'Send via Outlook' to attach files automatically, or add manually:"
        : "You'll need to attach these files manually:"}
    </p>
    <ul className="mt-1 text-amber-700 list-disc list-inside">
      {attachments.map(a => (
        <li key={a.path}>{a.name}</li>
      ))}
    </ul>
  </div>
)}

// For mailto/clipboard, add reminder in success toast
const handleSendViaMailto = async () => {
  await openMailtoLink({ to, subject, body });
  if (attachments?.length) {
    toast.info(`Don't forget to attach: ${attachments.map(a => a.name).join(", ")}`);
  }
  onEmailSent?.("mailto");
};
```

This approach:
- Shows warning upfront in the dialog (no modal interruption)
- Reminds user after send via toast
- Doesn't block the send flow

### Files Modified (Option 1)

| File | Changes |
|------|---------|
| `TasksOverview.tsx` | Pass actual template ID |
| `email-draft-dialog.tsx` | Add validation, fix Mark as Sent, add attachment warning |
| `email-input.tsx` | Add logging (requires clientId prop) |
| `emailLogService.ts` | Add "manual" to sentVia type |

### Pros & Cons

| Pros | Cons |
|------|------|
| ✅ Minimal risk | ❌ Two log formats remain |
| ✅ Fast to implement (~2-3 hours) | ❌ Architectural debt persists |
| ✅ No migration needed | ❌ ReportGeneratorDialog still uses legacy mailto |
| ✅ Fixes most critical bugs | ❌ Templates still localStorage-only |

### Estimated Effort
- **Development**: 2-3 hours
- **Testing**: 1 hour
- **Risk**: Low

---

## Option 2: Moderate Consolidation

**Goal**: Unify logging to `emailLogService`, retire `REPORT_LOG`, standardize send flow. Medium risk, better long-term maintainability.

### Changes Required

#### 2.1 All Changes from Option 1
Include all fixes from Option 1.

#### 2.2 Migrate REPORT_LOG to EMAIL_LOG Format
**File**: [emailLogService.ts](../src/lib/services/emailLogService.ts)

Extend `EmailLogEntry` to support report-specific fields:

```typescript
export interface EmailLogEntry {
  id: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  templateId?: string;
  templateName?: string;
  attachments?: EmailAttachment[];  // Changed from string[] to include paths
  sentAt: string;
  sentVia: "outlook" | "mailto" | "clipboard" | "manual" | "unknown";
  emailType?: "report" | "questionnaire-reminder" | "protocol" | "follow-up" | "general";

  // New: Report-specific fields
  reportType?: "client" | "vet" | "clinical";
  reportFileName?: string;
  generatedAt?: string;
}

/**
 * EmailAttachment - include BOTH name and path for traceability
 * Path allows linking back to files in client folders
 */
export interface EmailAttachment {
  name: string;           // Display name (e.g., "Beau_Consultation_Report.pdf")
  path?: string;          // Full path for traceability (e.g., "C:/Users/.../client_folder/...")
  size?: number;          // Optional file size in bytes
  mimeType?: string;      // Optional MIME type
}
```

> **Design note**: Always store `path` when available. This enables:
> - Linking to the actual file in client folder
> - Verification that attachment still exists
> - Re-sending from the same file if needed

#### 2.3 Add Migration Function for Existing REPORT_LOG
**File**: [emailLogService.ts](../src/lib/services/emailLogService.ts)

**Important**: Preserve non-emailed entries so users still see "Not sent" rows.

```typescript
/**
 * Migrates legacy REPORT_LOG format to EMAIL_LOG format
 * Preserves ALL entries (emailed and not-emailed) for complete history
 */
export function migrateReportLog(notes: string): {
  migratedNotes: string;
  entries: EmailLogEntry[];
  reportHistory: ReportHistoryEntry[];  // Non-email report tracking
} {
  const reportLogMatch = notes.match(/<!--REPORT_LOG:(.*?)-->/s);
  if (!reportLogMatch) return { migratedNotes: notes, entries: [], reportHistory: [] };

  const reportLog = JSON.parse(reportLogMatch[1]);

  // Split into emailed vs not-emailed
  const emailEntries: EmailLogEntry[] = reportLog.entries
    .filter((entry: any) => entry.emailed)
    .map((entry: any) => ({
      id: `migrated_${entry.fileName}_${Date.now()}`,
      to: entry.emailedTo,
      subject: `Report: ${entry.fileName}`,
      sentAt: entry.emailedDate,
      sentVia: "manual" as const,  // Unknown original method
      emailType: "report" as const,
      reportType: entry.reportType,
      reportFileName: entry.fileName,
      generatedAt: entry.generatedDate,
      attachments: [{ name: entry.fileName }],
    }));

  // Keep non-emailed reports in a separate "report history" block
  const reportHistory: ReportHistoryEntry[] = reportLog.entries
    .filter((entry: any) => !entry.emailed)
    .map((entry: any) => ({
      fileName: entry.fileName,
      reportType: entry.reportType,
      generatedDate: entry.generatedDate,
      status: "generated",  // Not yet emailed
    }));

  // Remove old REPORT_LOG
  const cleanedNotes = notes.replace(/<!--REPORT_LOG:.*?-->/s, '');
  return { migratedNotes: cleanedNotes, entries: emailEntries, reportHistory };
}

// New interface for non-email report tracking
export interface ReportHistoryEntry {
  fileName: string;
  reportType: "client" | "vet" | "clinical";
  generatedDate: string;
  status: "generated" | "pending_email";
}
```

This preserves the "Not sent" rows users expect to see.

#### 2.4 Refactor ReportSentEventPanel to Use emailLogService
**File**: [ReportSentEventPanel.tsx](../src/components/Event/ReportSentEventPanel.tsx)

Replace custom `reportLog` state with `emailLogService`:

```typescript
// BEFORE: Custom report log state
const [reportLog, setReportLog] = useState<ReportLogEntry[]>([]);

// AFTER: Use emailLogService
import { parseEmailLog, addEmailToLog, createEmailLogEntry } from "@/lib/services/emailLogService";

const [emailLog, setEmailLog] = useState<EmailLog>({ entries: [], lastUpdated: "" });

// On mount, parse existing log
useEffect(() => {
  if (event?.notes) {
    const parsed = parseEmailLog(event.notes);
    setEmailLog(parsed);
  }
}, [event?.notes]);

// When marking report as emailed
const markReportAsEmailed = (reportPath: string, recipientEmail: string) => {
  const entry = createEmailLogEntry(recipientEmail, `Report: ${getFileName(reportPath)}`, method, {
    emailType: "report",
    reportType: currentReportType,
    reportFileName: getFileName(reportPath),
    attachments: [{ name: getFileName(reportPath), path: reportPath }],
  });
  const updatedLog = addEmailToLog(emailLog, entry);
  setEmailLog(updatedLog);
  // Save to event notes
};
```

#### 2.5 Deprecate ReportGeneratorDialog Email Flow
**File**: [ReportGeneratorDialog.tsx](../src/components/Event/ReportGeneratorDialog.tsx)

Two options:
1. **Remove email functionality** - Direct users to ReportSentEventPanel for emailing
2. **Migrate to EmailDraftDialog** - Replace direct mailto with dialog

Recommended: Option 1 (simpler)

```typescript
// Remove email-related buttons/handlers
// Add note: "To email this report, use the Report Delivery panel on the ReportSent event"
```

#### 2.6 Create Unified Email Send Helper
**File**: New file `src/lib/services/emailSendService.ts`

```typescript
import { openOutlookDraft, openMailtoLink, copyEmailToClipboard, checkOutlookAvailable } from "./outlookEmailService";
import { createEmailLogEntry, appendEmailToEvent, createEmailSentEvent } from "./emailLogService";

export interface SendEmailParams {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];

  // Logging context
  clientId?: number;
  eventId?: number;
  templateId?: string;
  templateName?: string;
  emailType?: EmailLogEntry["emailType"];
  reportType?: string;
  reportFileName?: string;
}

export interface SendResult {
  success: boolean;
  method: "outlook" | "mailto" | "clipboard" | "none";
  error?: string;
  attachmentWarning?: boolean;  // True if attachments couldn't be sent
  logged: boolean;              // Whether an email log entry was created
}

/**
 * Unified email send + log function
 * Handles method selection, attachment warnings, and logging
 *
 * IMPORTANT: Only logs on successful send. Returns logged: false on failures
 * so callers can handle retries without duplicate log entries.
 */
export async function sendAndLogEmail(
  params: SendEmailParams,
  preferredMethod?: "outlook" | "mailto" | "clipboard"
): Promise<SendResult> {
  const hasAttachments = params.attachments && params.attachments.length > 0;
  const outlookAvailable = await checkOutlookAvailable();

  // Determine best method
  let method: "outlook" | "mailto" | "clipboard" = preferredMethod || "mailto";
  if (!preferredMethod) {
    method = (hasAttachments && outlookAvailable) ? "outlook" : "mailto";
  }

  // Send via chosen method
  let sendSuccess = false;
  try {
    if (method === "outlook" && outlookAvailable) {
      const result = await openOutlookDraft({
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        body: params.body,
        attachments: params.attachments?.map(a => a.path).filter(Boolean) as string[],
      });
      sendSuccess = result.success;
    } else if (method === "clipboard") {
      await copyEmailToClipboard({ ...params });
      sendSuccess = true;  // Clipboard always succeeds if no throw
    } else {
      await openMailtoLink({ to: params.to, cc: params.cc, subject: params.subject, body: params.body });
      sendSuccess = true;  // Mailto opened (user still needs to send)
    }
  } catch (error) {
    // Send failed - don't log, return failure state
    return {
      success: false,
      method,
      error: String(error),
      attachmentWarning: false,
      logged: false,
    };
  }

  // Only log if send was successful
  if (!sendSuccess) {
    return {
      success: false,
      method,
      error: "Send operation failed",
      attachmentWarning: false,
      logged: false,
    };
  }

  // Log the email
  let logged = false;
  try {
    const logEntry = createEmailLogEntry(params.to, params.subject, method, {
      templateId: params.templateId,
      templateName: params.templateName,
      emailType: params.emailType,
      attachments: params.attachments?.map(a => ({ name: a.name, path: a.path })),
    });

    if (params.eventId) {
      await appendEmailToEvent(params.eventId, logEntry);
      logged = true;
    } else if (params.clientId) {
      await createEmailSentEvent(params.clientId, logEntry);
      logged = true;
    }
    // If no clientId/eventId, email sent but not logged (caller's responsibility)
  } catch (logError) {
    console.error("Failed to log email:", logError);
    // Email was sent, just logging failed - still report success
  }

  return {
    success: true,
    method,
    attachmentWarning: hasAttachments && method !== "outlook",
    logged,
  };
}

/**
 * For cases where user dismisses dialog without sending
 * Call this to explicitly NOT log anything
 */
export function dismissWithoutSending(): SendResult {
  return {
    success: false,
    method: "none",
    logged: false,
  };
}
```

### Files Modified (Option 2)

| File | Changes |
|------|---------|
| All from Option 1 | See Option 1 |
| `emailLogService.ts` | Extend schema, add migration function |
| `ReportSentEventPanel.tsx` | Refactor to use emailLogService |
| `ReportGeneratorDialog.tsx` | Remove/deprecate email flow |
| `emailSendService.ts` (new) | Unified send + log helper |

### Migration Path

1. Deploy extended `emailLogService` with backward compatibility
2. New emails use unified format
3. Old REPORT_LOG entries migrated on read (lazy migration)
4. After 30 days, remove REPORT_LOG parsing code

### Pros & Cons

| Pros | Cons |
|------|------|
| ✅ Single log format | ❌ More complex migration |
| ✅ Consistent audit trail | ❌ Risk of data loss if migration buggy |
| ✅ Easier future maintenance | ❌ ReportSentEventPanel refactor is significant |
| ✅ Unified send helper | ❌ ~6-8 hours development |

### Estimated Effort
- **Development**: 6-8 hours
- **Testing**: 2-3 hours
- **Risk**: Medium (migration complexity)

---

## Option 3: Full Unification

**Goal**: Complete email subsystem with consistent UX, database-backed templates, full validation, and comprehensive audit trail. Highest effort, best long-term architecture.

### Changes Required

#### 3.1 All Changes from Options 1 & 2
Include all fixes and consolidations from Options 1 and 2.

#### 3.2 Database-Backed Email Templates
**File**: [schema.prisma](../prisma/schema.prisma)

> **Note**: This is worth it if multi-machine use matters (e.g., laptop + desktop). For a single-node Tauri app, this may be overkill. Consider the tradeoff carefully.

```prisma
// Enum for type safety - prevents typos in sentVia values
enum EmailSendMethod {
  outlook
  mailto
  clipboard
  manual
  unknown
}

enum EmailType {
  report
  questionnaire_reminder
  protocol
  follow_up
  general
}

model EmailTemplate {
  id          Int      @id @default(autoincrement())
  templateId  String   @unique  // e.g., "questionnaire-reminder-dog"
  name        String
  description String?
  subject     String
  body        String   @db.Text  // Allow long template bodies
  variables   String   // JSON array of variable names
  category    String?  // e.g., "Questionnaire", "Report", "Follow-up"
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model EmailLog {
  id              Int              @id @default(autoincrement())
  clientId        Int?
  eventId         Int?
  to              String
  cc              String?
  bcc             String?
  subject         String
  templateId      String?
  sentVia         EmailSendMethod  // Enum for type safety
  emailType       EmailType?
  attachments     String?          // JSON: [{ name, path }]
  reportType      String?          // "client" | "vet" | "clinical"
  reportFileName  String?
  sentAt          DateTime         @default(now())

  client          Client?   @relation(fields: [clientId], references: [clientId], onDelete: SetNull)
  event           Event?    @relation(fields: [eventId], references: [eventId], onDelete: SetNull)

  // Indexes for common queries
  @@index([clientId])
  @@index([eventId])
  @@index([sentAt])
  @@index([clientId, sentAt])  // Client email history sorted by date
}
```

#### 3.3 Email Template Service (Database-Backed)
**File**: New file `src/lib/services/emailTemplateService.ts`

```typescript
import { db } from "@/lib/db";

export async function getEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
  return db.emailTemplate.findUnique({ where: { templateId } });
}

export async function getAllTemplates(): Promise<EmailTemplate[]> {
  return db.emailTemplate.findMany({
    where: { isActive: true },
    orderBy: { category: 'asc' }
  });
}

export async function saveTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
  if (template.id) {
    return db.emailTemplate.update({
      where: { id: template.id },
      data: { ...template, updatedAt: new Date() }
    });
  }
  return db.emailTemplate.create({ data: template as any });
}

export async function deleteTemplate(id: number): Promise<void> {
  await db.emailTemplate.delete({ where: { id } });
}

export async function resetToDefault(templateId: string): Promise<void> {
  const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.templateId === templateId);
  if (defaultTemplate) {
    await db.emailTemplate.upsert({
      where: { templateId },
      create: defaultTemplate,
      update: { ...defaultTemplate, updatedAt: new Date() }
    });
  }
}

/**
 * Seed defaults idempotently - safe to re-run
 * Only creates templates that don't exist; never overwrites customizations
 */
export async function seedDefaultTemplates(): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    const existing = await db.emailTemplate.findUnique({
      where: { templateId: template.templateId }
    });

    if (!existing) {
      await db.emailTemplate.create({
        data: { ...template, isDefault: true }
      });
    }
    // If exists, leave it alone (user may have customized)
  }
}

/**
 * Offline fallback - if DB unreachable, fall back to in-memory defaults
 * Rare for local SQLite, but provides resilience
 */
export async function getEmailTemplateWithFallback(templateId: string): Promise<EmailTemplate | null> {
  try {
    const dbTemplate = await db.emailTemplate.findUnique({ where: { templateId } });
    if (dbTemplate) return dbTemplate;
  } catch (error) {
    console.warn("DB unreachable, using fallback templates:", error);
  }

  // Fallback to in-memory defaults
  return DEFAULT_TEMPLATES.find(t => t.templateId === templateId) || null;
}

export async function getAllTemplatesWithFallback(): Promise<EmailTemplate[]> {
  try {
    return await db.emailTemplate.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });
  } catch (error) {
    console.warn("DB unreachable, using fallback templates:", error);
    return DEFAULT_TEMPLATES;
  }
}
```

#### 3.4 Email Log Service (Database-Backed)
**File**: Refactor `src/lib/services/emailLogService.ts`

```typescript
import { db } from "@/lib/db";

export async function logEmail(params: {
  clientId?: number;
  eventId?: number;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  templateId?: string;
  sentVia: "outlook" | "mailto" | "clipboard" | "manual";
  emailType?: string;
  attachments?: string[];
  reportType?: string;
  reportFileName?: string;
}): Promise<EmailLog> {
  return db.emailLog.create({
    data: {
      ...params,
      attachments: params.attachments ? JSON.stringify(params.attachments) : null,
    }
  });
}

export async function getClientEmailHistory(clientId: number): Promise<EmailLog[]> {
  return db.emailLog.findMany({
    where: { clientId },
    orderBy: { sentAt: 'desc' },
    take: 50
  });
}

export async function getEventEmailHistory(eventId: number): Promise<EmailLog[]> {
  return db.emailLog.findMany({
    where: { eventId },
    orderBy: { sentAt: 'desc' }
  });
}

// For audit/compliance
export async function exportEmailLog(startDate: Date, endDate: Date): Promise<EmailLog[]> {
  return db.emailLog.findMany({
    where: {
      sentAt: { gte: startDate, lte: endDate }
    },
    include: { client: true, event: true },
    orderBy: { sentAt: 'desc' }
  });
}
```

#### 3.5 Unified Email Composer Component
**File**: New file `src/components/Email/EmailComposer.tsx`

Replace `EmailDraftDialog` with a more comprehensive component:

```typescript
interface EmailComposerProps {
  // Required
  to: string;

  // Optional pre-fill
  cc?: string;
  subject?: string;
  body?: string;
  templateId?: string;

  // Attachments
  attachments?: EmailAttachment[];

  // Logging context
  clientId?: number;
  eventId?: number;
  emailType?: string;

  // Callbacks
  onClose: () => void;
  onSent?: (method: string) => void;
}

export function EmailComposer({ ... }: EmailComposerProps) {
  // State
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // Load templates
  const { data: templates } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: getAllTemplates
  });

  // Validation
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!to.trim()) newErrors.to = "Recipient required";
    else if (!validateEmail(to)) newErrors.to = "Invalid email address";

    if (cc && !validateEmail(cc)) newErrors.cc = "Invalid CC address";
    if (!subject.trim()) newErrors.subject = "Subject required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [to, cc, subject]);

  // Template selection
  const handleTemplateChange = (templateId: string) => {
    const template = templates?.find(t => t.templateId === templateId);
    if (template) {
      setSelectedTemplate(template);
      setSubject(processTemplate(template.subject, variables));
      setBody(processTemplate(template.body, variables));
    }
  };

  // Send handlers
  const handleSend = async (method: "outlook" | "mailto" | "clipboard") => {
    if (!validate()) return;

    // Attachment warning for non-Outlook methods
    if (attachments?.length && method !== "outlook") {
      const confirmed = await confirmAttachmentWarning(attachments);
      if (!confirmed) return;
    }

    setSending(true);
    try {
      const result = await sendAndLogEmail({
        to, cc, subject, body,
        attachments,
        clientId, eventId,
        templateId: selectedTemplate?.templateId,
        templateName: selectedTemplate?.name,
        emailType,
      }, method);

      if (result.success) {
        toast.success(`Email ${method === "clipboard" ? "copied" : "sent"}!`);
        onSent?.(method);
        onClose();
      } else {
        toast.error(result.error || "Failed to send");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
        </DialogHeader>

        {/* Template selector */}
        <Select value={selectedTemplate?.templateId} onValueChange={handleTemplateChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose template..." />
          </SelectTrigger>
          <SelectContent>
            {templates?.map(t => (
              <SelectItem key={t.templateId} value={t.templateId}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Form fields with validation */}
        <div className="space-y-3">
          <div>
            <Label>To</Label>
            <Input
              value={to}
              onChange={e => setTo(e.target.value)}
              className={errors.to ? "border-red-500" : ""}
            />
            {errors.to && <p className="text-xs text-red-500">{errors.to}</p>}
          </div>

          <div>
            <Label>CC</Label>
            <Input
              value={cc}
              onChange={e => setCc(e.target.value)}
              className={errors.cc ? "border-red-500" : ""}
            />
            {errors.cc && <p className="text-xs text-red-500">{errors.cc}</p>}
          </div>

          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className={errors.subject ? "border-red-500" : ""}
            />
            {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
            />
          </div>

          {/* Attachment list */}
          {attachments?.length > 0 && (
            <div className="rounded border p-2 bg-muted">
              <p className="text-xs font-medium mb-1">Attachments:</p>
              <ul className="text-xs">
                {attachments.map(a => (
                  <li key={a.path}>📎 {a.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>

          {outlookAvailable ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={sending}>
                  {sending ? "Sending..." : "Send ▾"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleSend("outlook")}>
                  Send via Outlook {attachments?.length ? "(with attachments)" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSend("mailto")}>
                  Open in Email App
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSend("clipboard")}>
                  Copy to Clipboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => handleSend("mailto")} disabled={sending}>
              {sending ? "Opening..." : "Open in Email App"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3.6 Email History Panel Component
**File**: New file `src/components/Email/EmailHistoryPanel.tsx`

Add to ClientView to show all emails sent to client:

```typescript
interface EmailHistoryPanelProps {
  clientId: number;
}

export function EmailHistoryPanel({ clientId }: EmailHistoryPanelProps) {
  const { data: emails, isLoading } = useQuery({
    queryKey: ["emailHistory", clientId],
    queryFn: () => getClientEmailHistory(clientId)
  });

  if (isLoading) return <Skeleton />;
  if (!emails?.length) return <p className="text-muted-foreground text-sm">No emails sent yet.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Via</TableHead>
          <TableHead>Attachments</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {emails.map(email => (
          <TableRow key={email.id}>
            <TableCell>{format(email.sentAt, "dd/MM/yyyy HH:mm")}</TableCell>
            <TableCell>{email.subject}</TableCell>
            <TableCell>
              <Badge variant="outline">{email.emailType || "general"}</Badge>
            </TableCell>
            <TableCell>{email.sentVia}</TableCell>
            <TableCell>
              {email.attachments ? JSON.parse(email.attachments).length : 0}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

#### 3.7 Migrate localStorage Templates to Database
**File**: New migration script

```typescript
// Run once on app startup
export async function migrateLocalStorageTemplates() {
  const localTemplates = localStorage.getItem("pbs_admin_email_templates");
  if (!localTemplates) return;

  const templates = JSON.parse(localTemplates);
  for (const template of templates) {
    await db.emailTemplate.upsert({
      where: { templateId: template.id },
      create: {
        templateId: template.id,
        name: template.name,
        description: template.description,
        subject: template.subject,
        body: template.body,
        variables: JSON.stringify(template.variables),
        isDefault: false,
      },
      update: {
        name: template.name,
        subject: template.subject,
        body: template.body,
      }
    });
  }

  // Clear localStorage after successful migration
  localStorage.removeItem("pbs_admin_email_templates");
}
```

#### 3.8 Retire Legacy Components

| Component | Action |
|-----------|--------|
| `EmailDraftDialog` | Replace with `EmailComposer` |
| `ReportGeneratorDialog` email flow | Remove, use ReportSentEventPanel |
| `emailTemplates.ts` localStorage functions | Migrate to database service |
| `REPORT_LOG` parsing | Remove after migration period |

### Files Modified (Option 3)

| File | Changes |
|------|---------|
| All from Options 1 & 2 | See above |
| `schema.prisma` | Add EmailTemplate and EmailLog models |
| `emailTemplateService.ts` (new) | Database-backed template CRUD |
| `emailLogService.ts` | Refactor for database |
| `EmailComposer.tsx` (new) | Unified composer component |
| `EmailHistoryPanel.tsx` (new) | Client email history view |
| `EmailTemplateManager.tsx` | Refactor to use database |
| `ClientView.tsx` | Add EmailHistoryPanel tab |
| Migration scripts | Template + log migration |

### Database Migration

```bash
npx prisma migrate dev --name add_email_template_and_log_tables
```

### Pros & Cons

| Pros | Cons |
|------|------|
| ✅ Single source of truth (database) | ❌ Significant refactoring |
| ✅ Templates persist across machines | ❌ Database migration required |
| ✅ Complete audit trail | ❌ 12-16 hours development |
| ✅ Email history per client | ❌ Higher testing burden |
| ✅ Exportable for compliance | ❌ Risk of breaking changes |
| ✅ Clean architecture | ❌ Requires thorough QA |

### Estimated Effort
- **Development**: 12-16 hours
- **Testing**: 4-6 hours
- **Migration**: 1-2 hours
- **Risk**: Medium-High (database schema change)

---

---

## Cross-Cutting Concerns

### Unified UX for Report Emailing

Currently two paths exist:
1. **ReportGeneratorDialog** - Direct mailto with non-standard `&attach=` param
2. **ReportSentEventPanel** - EmailDraftDialog with proper Outlook/mailto/clipboard flow

**Recommendation**: Pick ONE and add a banner/redirect for the other.

**Option A**: Retire legacy flow in ReportGeneratorDialog
- Remove email buttons from ReportGeneratorDialog
- Add banner: "To email this report, view the ReportSent event → Report Delivery panel"
- Users generate in dialog, email via panel

**Option B**: Upgrade ReportGeneratorDialog to use EmailDraftDialog
- Replace direct mailto with EmailDraftDialog component
- Add proper logging via emailLogService
- More code, but keeps existing UX location

**Recommended**: Option A (simpler, consolidates to one location)

---

### Regression Test Plan

Add manual test cases for email functionality:

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Validation: Valid email** | Enter `test@example.com` in EmailDraftDialog | No error, send enabled |
| **Validation: Invalid email** | Enter `not-an-email` | Error shown, send disabled |
| **Validation: Empty fields** | Leave To or Subject empty | Send disabled |
| **Template ID: Dog reminder** | Send questionnaire reminder for dog | Log shows `questionnaire-reminder-dog` |
| **Template ID: Cat reminder** | Send questionnaire reminder for cat | Log shows `questionnaire-reminder-cat` |
| **Send: Outlook path** | Click "Send via Outlook" | Opens Outlook, log shows `sentVia: "outlook"` |
| **Send: Mailto path** | Click "Open in Email App" | Opens default mail app, log shows `sentVia: "mailto"` |
| **Send: Clipboard path** | Click "Copy to Clipboard" | Copies to clipboard, log shows `sentVia: "clipboard"` |
| **Send: Mark as Sent** | Click "Mark as Sent" without sending | Log shows `sentVia: "manual"` |
| **Attachments: Outlook** | Send report with PDF via Outlook | Attachment included automatically |
| **Attachments: Mailto** | Send report with PDF via mailto | Warning banner shown, toast reminder after |
| **Attachments: Warning** | Open dialog with attachments, Outlook unavailable | Amber banner lists files to attach |
| **Failed send** | Simulate Outlook failure | Error shown, NOT logged as sent |
| **Quick-send logging** | Use context menu quick-send on email field | Parent logs email if callback provided |

---

## Comparison Summary

| Aspect | Option 1 | Option 2 | Option 3 |
|--------|----------|----------|----------|
| **Effort** | 2-3 hours | 6-8 hours | 12-16 hours |
| **Risk** | Low | Medium | Medium-High |
| **Fixes Critical Bugs** | ✅ | ✅ | ✅ |
| **Unified Logging** | ❌ | ✅ | ✅ |
| **Database Templates** | ❌ | ❌ | ✅ |
| **Email History** | ❌ | ❌ | ✅ |
| **Architectural Debt** | Remains | Reduced | Eliminated |

---

## Recommendation

**Proceed with Option 1** to fix critical bugs immediately:
- Fix `validateEmail` usage (truthy = invalid)
- Use `onEmailSent` callback pattern for quick-send logging
- Fix "Mark as Sent" to use `"manual"` method with clear UI indication
- Use non-blocking attachment warning banner

**Then Option 2** gives the best maintainability payoff without database changes:
- Unified logging format
- Single send helper with proper failure handling
- Preserves non-emailed report entries during migration

**Option 3 is worthwhile only if**:
- Templates need to roam across machines (laptop + desktop)
- Auditable email history is a compliance requirement
- You're willing to invest in database migration + testing

For a single-node Tauri app, Option 2 is likely the sweet spot.
