# PBS Admin - Claude Code Context

**Pet Behaviour Services Administration System**

A Windows 11 desktop application for managing clients, pets, events, tasks, and automations for a pet behaviour services business.

---

## ⚠️ Before Starting Any Task

**ALWAYS check git state first** to avoid duplicate work:

```bash
# Check current branch and all branches
git branch -vv

# See recent commits on current branch
git log --oneline -10

# Check if there are other worktree branches with recent work
git branch -a --sort=-committerdate | head -10

# See what's different between branches
git log main..HEAD --oneline
```

This project uses **Claude worktrees** - multiple branches may have parallel work in progress. Before starting reviews, refactors, or new features, verify what has already been done in recent commits.

### Branch Cleanup Policy

**When to suggest branch deletion:**
- Branch has been fully merged to master
- No unique unmerged commits remain
- Worktree is no longer actively being used

**Rules for Claude:**
1. **Never delete branches without explicit user approval**
2. After completing work and merging, check for cleanup candidates:
   ```bash
   # Find merged branches
   git branch --merged master

   # Check worktree status
   git worktree list
   ```
3. If merged branches exist, ask: *"Branch X has been merged to master. Would you like me to delete it and its worktree?"*
4. Only delete after user confirms with explicit "yes" or similar

**To delete a branch and its worktree:**
```bash
# First remove the worktree
git worktree remove /path/to/worktree

# Then delete the branch
git branch -d branch-name

# Delete remote branch if exists
git push origin --delete branch-name
```

---

## Project Overview

**Purpose**: Local, privacy-preserving record-keeping and client management system that streamlines day-to-day operations, automates repetitive tasks, and provides at-a-glance visibility into upcoming bookings and tasks.

**Status**: ✅ MVP Complete + Advanced AI Integration + Email System - Full CRUD operations for Clients, Pets, Events, and Tasks. Automation rules engine implemented and working. Application is production-ready with five active automation workflows. Task templates for quick creation, in-app notifications for due/overdue tasks, Dashboard task management with email reminder integration. Comprehensive email template system with in-app manager, draft preview, variable substitution. **Direct email sending via Resend API** with file attachments, automatic signature with logo, and context menu integration for quick sending from client email fields. Client folder management, rich text notes, age calculator, website booking integration, Jotform questionnaire sync with automatic file downloads. **AI-powered bulk task importer and consultation report generator with complete DOCX/PDF export workflow and email delivery system**. **AI Prompt Management System with customizable templates, Multi-Report Generation Service for 4 report types (Clinical Notes HTML, Client Report, Practitioner Report, Veterinary Report), and transcript file management for on-demand report generation**. **Context menu enhancements on email and address fields** with quick actions (paste/copy/compose email/send with attachment/Google Maps). Fully compacted client forms with optimized spacing and font sizes. **Prescription Generation System** with template-based DOCX generation using Pandoc, customizable templates with variable substitution, letterhead integration, and automatic Event notes updates. **Simplified Consultation Workflow** with manual transcript save feature - paste transcript text from MS Word processing, save to client folder with automatic naming, replace functionality with confirmation. **AI Model Info Display** in Prompt Template Manager showing current model (Claude Opus 4.5) with update check button. **Transcript file dropdown** with auto-refresh after saving. **Comprehensive Clinical Notes (DOCX)** generation with success notification and Open Document button. **Post-Consultation Task Generation** with standard tasks (opt-out model) and AI-extracted case-specific tasks from transcript/clinical notes. **Consultation Processing Log** - automatic audit trail in Event notes tracking all processing steps (transcript saved, clinical notes generated, comprehensive report, tasks created) with timestamps. **ReportSent Event Panel** with report delivery log tracking - email buttons on existing reports, persistent email status tracking in Event notes with machine-readable JSON storage.

**Last Updated**: 2026-01-29

**Recent Changes** (2026-01-29):
- **About Dialog**: Version display with GitHub update check
- **Enhanced Website Coordination**: Automatic referral file download from Supabase Storage, bidirectional status sync (marks booking as completed when report sent)
- **Scheduled Backups**: Daily/weekly automatic backups with retention policy, backup settings UI in BackupManager
- **Startup + Background Mode**: System tray with Show/Hide/Quit menu, minimize to tray on close, auto-start at Windows login with `--minimized` flag, Startup Settings UI in Settings menu
- **Multi-Window System**: Draggable/resizable floating windows for clients using react-rnd, minimize to taskbar, maximize/restore, z-index focus management, cascading window positions

**Previous Changes** (2026-01-28):
- Security hardening: API keys moved to Tauri backend, Error Boundary added
- UI improvements: ConfirmDialog replaces alert(), toast notifications for errors
- Code cleanup: Removed unused dependencies (html2canvas, jspdf), dead code deleted
- Added git state checking and branch cleanup policy to CLAUDE.md
- **Production build ready**: CSP enabled, relative paths for Tauri webview, NSIS installer working

**Remaining TODO**:
- Audio transcription tool: Make functional for large audio clips (currently has size/duration limitations)

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop Framework** | Tauri 2.x | Native Windows app with web UI |
| **Frontend** | React 19 + TypeScript | UI components and state management |
| **Build Tool** | Vite 7.x | Fast dev server and optimized builds |
| **Database** | SQLite | Local embedded database |
| **ORM** | Prisma 6.x | Type-safe database access |
| **UI Components** | shadcn/ui + Radix UI | Accessible, customizable components |
| **Styling** | Tailwind CSS 3.x | Utility-first styling |
| **Data Fetching** | TanStack Query v5 | Server state management |
| **Date Handling** | date-fns + date-fns-tz | Timezone-aware date operations |
| **Notifications** | Sonner | Toast notifications for in-app alerts |
| **HTTP Client (Backend)** | reqwest 0.12 | Rust HTTP client for CORS-free downloads |
| **Email Templates** | localStorage + Variable System | Customizable templates with dynamic content |
| **Email Sending** | Resend API | Direct email delivery with attachments |
| **Email Receiving** | ImprovMX | Email forwarding to personal inbox |
| **Prescription Templates** | localStorage + Pandoc | Template-based prescription generation |
| **AI Services** | Anthropic Claude Opus 4.5 | Report generation, task extraction |
| **Markdown Processing** | marked | Markdown to HTML conversion for Clinical Notes |
| **Document Conversion** | Pandoc 3.8+ | Markdown to DOCX conversion with letterhead |
| **External Services** | Supabase, Jotform API, Resend | Booking sync, questionnaire downloads, email |

---

## Architecture

### Project Structure

```
PBS_Admin/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # ✅ Tauri commands (folder management, file writing)
│   │   ├── main.rs         # ✅ Tauri entry point
│   │   ├── db/             # Database commands (TODO)
│   │   └── automation/     # Rules engine (TODO)
│   └── Cargo.toml          # ✅ Dependencies: dirs, opener plugin, SQL plugin
│
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── Dashboard/      # ✅ ClientsList, UpcomingBookings, TasksOverview (with email integration)
│   │   ├── Client/         # ✅ ClientForm, ClientView, FolderCreationDialog, FolderSuccessDialog
│   │   ├── Pet/            # ✅ PetForm, PetsTable (integrated into ClientView)
│   │   ├── Event/          # ✅ EventForm, EventsTable (with automation hooks)
│   │   ├── Task/           # ✅ TaskForm, TasksTable (priority/status tracking), BulkTaskImporter
│   │   ├── EmailTemplateManager/  # ✅ Full email template management UI
│   │   │   └── EmailTemplateManager.tsx  # ✅ Create/edit/duplicate/delete templates
│   │   ├── PromptTemplateManager/  # ✅ AI prompt template management UI
│   │   │   └── PromptTemplateManager.tsx  # ✅ Create/edit/reset prompt templates
│   │   ├── WindowManager/  # ✅ Multi-window system
│   │   │   ├── WindowManager.tsx  # ✅ Global container for all windows
│   │   │   ├── Window.tsx  # ✅ Draggable/resizable window shell (react-rnd)
│   │   │   ├── WindowTaskbar.tsx  # ✅ Taskbar for minimized windows
│   │   │   └── index.ts    # ✅ Barrel exports
│   │   ├── Settings/       # ✅ Settings dialogs
│   │   │   └── StartupSettingsDialog.tsx  # ✅ Auto-start and minimize to tray settings
│   │   └── ui/             # ✅ shadcn/ui components (Button, Input, Dialog, Select, etc.)
│   │       ├── email-input.tsx  # ✅ Email input with context menu (paste/copy/create email)
│   │       ├── address-input.tsx  # ✅ Address input with context menu (paste/copy/Google Maps)
│   │       ├── email-draft-dialog.tsx  # ✅ Email preview and editing dialog
│   │       ├── context-menu.tsx  # ✅ Radix UI context menu component
│   │       ├── tabs.tsx    # ✅ Radix UI tabs component
│   │       └── dropdown-menu.tsx  # ✅ Radix UI dropdown menu component
│   ├── lib/
│   │   ├── automation/     # ✅ Rules engine with 4 active automation workflows
│   │   │   ├── types.ts    # ✅ Automation type definitions
│   │   │   ├── rules.ts    # ✅ Rule definitions (Booking, Consultation, Training, ClientCreation)
│   │   │   └── engine.ts   # ✅ Execution engine
│   │   ├── services/       # ✅ Complete service layer for all entities
│   │   │   ├── clientService.ts     # ✅ Client CRUD operations
│   │   │   ├── petService.ts        # ✅ Pet CRUD operations
│   │   │   ├── eventService.ts      # ✅ Event CRUD operations
│   │   │   ├── taskService.ts       # ✅ Task CRUD operations
│   │   │   ├── bookingSyncService.ts  # ✅ Website booking import from Supabase
│   │   │   ├── jotformService.ts    # ✅ Questionnaire sync from Jotform API
│   │   │   ├── notificationService.ts # ✅ Task notification queries
│   │   │   ├── reportGenerationService.ts # ✅ AI report generation with Claude API
│   │   │   ├── multiReportGenerationService.ts # ✅ Multi-report generation (3 types)
│   │   │   ├── transcriptFileService.ts # ✅ Transcript file management
│   │   │   ├── docxConversionService.ts # ✅ MD → DOCX conversion with Pandoc
│   │   │   ├── pdfConversionService.ts # ✅ DOCX → PDF conversion with MS Word
│   │   │   ├── emailService.ts    # ✅ Resend API email sending with attachments
│   │   │   ├── autostartService.ts # ✅ Windows auto-start at login
│   │   │   ├── backupService.ts   # ✅ Scheduled backup service
│   │   │   └── updateService.ts   # ✅ GitHub release version checking
│   │   ├── prompts/        # ✅ AI prompts and methodologies
│   │   │   ├── report-system-prompt.ts  # ✅ Report generation methodology (legacy)
│   │   │   └── promptTemplates.ts  # ✅ Multi-prompt template management system
│   │   ├── types.ts        # ✅ TypeScript types for all entities
│   │   ├── taskTemplates.ts # ✅ Predefined task templates with preset values
│   │   ├── emailTemplates.ts # ✅ Email template definitions and management functions
│   │   ├── prescriptionTemplates.ts # ✅ Prescription template system with variable substitution
│   │   ├── medications.ts  # ✅ Behavior medication database with dosing, brands, contraindications
│   │   ├── utils/          # ✅ Helpers (date, validation, phoneUtils, dateOffsetUtils)
│   │   ├── constants.ts    # ✅ Application constants
│   │   └── db.ts           # ✅ Database connection with Tauri SQL plugin
│   ├── contexts/
│   │   └── WindowContext.tsx  # ✅ Multi-window state management
│   ├── hooks/
│   │   ├── useTaskNotifications.ts  # ✅ Polling hook for task notifications
│   │   └── useWindow.ts     # ✅ Hook for opening/managing windows
│   ├── App.tsx
│   └── main.tsx
│
├── prisma/
│   ├── schema.prisma       # ✅ Complete database schema
│   ├── migrations/         # ✅ Initial migration generated
│   └── seed.ts             # ✅ Sample data for testing
│
├── docs/                   # Documentation (TODO)
│   ├── TEST_PLAN.md
│   └── EXTENSION_GUIDE.md
│
├── ADR.md                  # ✅ Architecture Decision Record
├── CLAUDE.md               # This file
└── README.md               # Setup instructions (TODO)
```

### Data Flow

1. **UI Layer** (React) → User interactions, forms, tables
2. **API Layer** (Tauri Commands) → Bridge between frontend and backend
3. **Service Layer** (Rust/TypeScript) → Business logic, validation, automation
4. **Data Layer** (Prisma + SQLite) → Persistence, queries, transactions

---

## Database Schema

### Entity Relationship Diagram

```
Client (1) ─────┐
                ├──> (N) Pet
                ├──> (N) Event ─┐
                │               ├──> (N) Task
                └──> (N) Task   │
                                │
Event (parent) ──> Event (children)
Task (parent) ──> Task (children)
```

### Primary Entities

#### 1. **Client** - Primary contact and billing information

**Key Fields**:
- `clientId` (PK, autoincrement)
- `firstName`, `lastName`, `email`, `mobile` (required)
- `streetAddress`, `city`, `state`, `postcode` (optional)
- `stripeCustomerId`, `folderPath`, `notes` (optional)
- `primaryCareVet` (optional) - Primary care veterinarian for vet reports

**Relationships**:
- Has many Pets (CASCADE delete)
- Has many Events (CASCADE delete)
- Has many Tasks (SET NULL on delete)

**Indexes**: email, mobile, lastName+firstName, city+state

---

#### 2. **Pet** - Animal information linked to clients

**Key Fields**:
- `petId` (PK, autoincrement)
- `clientId` (FK → Client, required)
- `name`, `species` (required)
- `breed`, `sex`, `dateOfBirth`, `notes` (optional)

**Relationships**:
- Belongs to one Client (CASCADE on client delete)

**Indexes**: clientId, name

---

#### 3. **Event** - Bookings, consultations, training sessions, payments, follow-ups

**Key Fields**:
- `eventId` (PK, autoincrement)
- `clientId` (FK → Client, required)
- `eventType` (required) - e.g., "Booking", "Consultation", "TrainingSession", "Payment", "FollowUp", "ReportSent"
- `date` (required, ISO 8601 string)
- `notes` (optional, supports rich text/structured notes)
- `calendlyEventUri`, `calendlyStatus` (integration fields)
- `invoiceFilePath`, `hostedInvoiceUrl` (Stripe integration)
- `transcriptFilePath` (optional) - Path to saved consultation transcript (.txt file)
- `questionnaireFilePath` (optional) - Path to saved questionnaire file (.json file)
- `parentEventId` (FK → Event, optional) - for event hierarchies

**Relationships**:
- Belongs to one Client (CASCADE on client delete)
- Has many Tasks (SET NULL on event delete)
- Can have parent Event (self-referential)
- Can have child Events (self-referential)

**Indexes**: clientId, eventType, date, parentEventId

---

#### 4. **Task** - Action items, automation triggers, reminders

**Key Fields**:
- `taskId` (PK, autoincrement)
- `clientId` (FK → Client, nullable)
- `eventId` (FK → Event, nullable)
- `description` (required)
- `dueDate` (required, ISO 8601 string)
- `status` (required) - "Pending", "InProgress", "Blocked", "Done", "Canceled"
- `priority` (required, 1-5) - 1 = highest
- `automatedAction` (required) - label of automation that will/did run
- `triggeredBy` (required) - e.g., "Event:Booking", "Manual", "Schedule"
- `completedOn` (nullable, ISO 8601 string)
- `parentTaskId` (FK → Task, optional) - for task hierarchies

**Relationships**:
- Can belong to one Client (SET NULL on client delete)
- Can belong to one Event (SET NULL on event delete)
- Can have parent Task (self-referential)
- Can have child Tasks (self-referential)

**Indexes**: clientId, eventId, dueDate, status, priority, parentTaskId

---

## Key Patterns and Conventions

### Date Handling

**CRITICAL**: All dates must be handled with Australia/Melbourne timezone.

```typescript
import { formatISO, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "Australia/Melbourne";

// Store in database (ISO 8601 string)
function dateToISO(date: Date): string {
  return formatISO(toZonedTime(date, TIMEZONE));
}

// Display to user (convert from ISO string)
function displayDate(isoString: string): Date {
  return toZonedTime(parseISO(isoString), TIMEZONE);
}
```

**Storage**: ISO 8601 strings in UTC (or timezone-aware)
**Display**: Always show in Australia/Melbourne timezone
**Calculations**: Use date-fns for all date math

---

### Phone Number Formatting

**Format**: Australian mobile numbers displayed as `xxxx xxx xxx`

```typescript
import { formatAustralianMobile, getRawPhoneNumber } from "@/lib/utils/phoneUtils";

// Format for display (as user types)
const formatted = formatAustralianMobile("0412345678"); // "0412 345 678"

// Extract raw digits for storage
const raw = getRawPhoneNumber("0412 345 678"); // "0412345678"

// Validation
import { isValidAustralianMobile } from "@/lib/utils/phoneUtils";
const isValid = isValidAustralianMobile("0412 345 678"); // true
```

**Pattern**:
- Display: Real-time formatting as user types in form
- Storage: Raw digits only (no spaces) in database
- Validation: Must start with 04 and be 10 digits total

---

### Folder Management

**Client Folders**: Organized file storage per client

**Tauri Commands**:
```rust
// Create folder at specified path
create_folder(path: String) -> Result<String, String>

// Get default client records path (Documents/PBS_Admin/Client_Records)
get_default_client_records_path() -> Result<String, String>
```

**Folder Naming**: `{surname}_{clientId}` (lowercase)
- Example: "duncan_24" for Michelle Duncan with clientId 24

**Storage**: `client.folderPath` stores the full path to created folder

**Opening Folders**:
```typescript
import { invoke } from "@tauri-apps/api/core";

// Open folder in File Explorer
await invoke("plugin:opener|open_path", { path: folderPath });
```

**Permissions**: Requires `opener:allow-open-path` permission with `$DOCUMENT/**` scope in capabilities/default.json

**Opening URLs** (Google Maps, external links):
```typescript
import { invoke } from "@tauri-apps/api/core";

// Open URL in default browser
const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
await invoke("plugin:opener|open_url", { url });
```

**Permissions**: Requires `opener:allow-open-url` permission in capabilities/default.json

---

### Age Utilities

**Purpose**: Parse age strings from questionnaires and calculate current age for pets.

**Age String Parsing** (`parseAgeToDateOfBirth`):
```typescript
import { parseAgeToDateOfBirth } from "@/lib/utils/ageUtils";

// Supports various formats
parseAgeToDateOfBirth("2 years");        // → "2023-11-07"
parseAgeToDateOfBirth("18 months");      // → "2024-05-07"
parseAgeToDateOfBirth("12 weeks");       // → "2025-08-17"
parseAgeToDateOfBirth("one and a half years"); // → "2024-05-07"
parseAgeToDateOfBirth("2.5");            // → "2023-05-07" (assumes years)
```

**Supported Formats**:
- Numbers with units: "2 years", "18 months", "12 weeks", "10 days"
- Abbreviated units: "2 yr", "18 mo", "12 wk"
- Word numbers: "one year", "two months", "eighteen weeks"
- Fractions: "1.5 years", "one and a half years", "2 1/2 months"
- Numbers only: "2" (assumes years)

**Age Calculation** (`calculateAge`):
```typescript
import { calculateAge } from "@/lib/utils/ageUtils";

// Returns formatted string
calculateAge("2023-06-15");  // → "2 years, 5 months"
calculateAge("2025-09-01");  // → "8 weeks"
calculateAge("2024-11-01");  // → "6 days"
```

**Usage in Pet Form**:
- Age calculator field accepts questionnaire responses
- Auto-populates Date of Birth field
- Displays calculated age in real-time
- Manual DOB adjustment still available

---

### Rich Text Editor

**Technology**: Tiptap (modern WYSIWYG editor for React)

**Features**:
- Text formatting: Bold, Italic, Underline
- Headings: H2, H3
- Lists: Bullet lists, Numbered lists
- Text alignment: Left, Center, Right
- Placeholder support
- Maximum height constraint (300px) with automatic scrollbars for long content

**Usage**:
```typescript
import { RichTextEditor } from "@/components/ui/rich-text-editor";

<RichTextEditor
  content={htmlContent}
  onChange={(html) => setContent(html)}
  placeholder="Start typing..."
/>
```

**Storage**: HTML format in database
**Display**: Plain text in tables (HTML stripped automatically)

**Height Constraint**:
- Editor content limited to 300px max-height (prevents dialog overflow)
- Vertical scrollbar appears automatically when content exceeds height
- Ensures form controls remain visible in modal dialogs
- Implemented in `rich-text-editor.css` with `max-height` and `overflow-y: auto`

**Packages**:
- `@tiptap/react` - React integration
- `@tiptap/starter-kit` - Essential extensions
- `@tiptap/extension-underline` - Underline support
- `@tiptap/extension-text-align` - Text alignment
- `@tiptap/extension-placeholder` - Placeholder text

---

### Multi-Window System

**Purpose**: Allow multiple client records to be open simultaneously in draggable, resizable windows.

**Technology**: react-rnd (React Resizable and Draggable) + React Context for state management

**Features**:
- **Draggable windows** - Drag by title bar to reposition
- **Resizable windows** - Drag edges/corners to resize
- **Minimize to taskbar** - Windows minimize to a taskbar at the bottom
- **Maximize/Restore** - Toggle between maximized and normal state
- **Focus management** - Clicking a window brings it to front (z-index management)
- **Cascading positions** - New windows offset by 30px for visibility
- **Re-open detection** - Opening same client focuses existing window instead of duplicating

**Architecture**:
```
WindowProvider (Context)
    │
    ├── Dashboard (main UI)
    │     └── useWindow hook → openWindow(), closeWindow()
    │
    └── WindowManager (global container, pointer-events: none)
          │
          ├── Window (pointer-events: auto, react-rnd)
          │     ├── Title bar (drag handle)
          │     ├── Window controls (minimize, maximize, close)
          │     └── Content (e.g., ClientView)
          │
          └── WindowTaskbar (minimized windows)
```

**Usage**:
```typescript
import { useWindow, createWindowId, WINDOW_CONFIGS } from "@/hooks/useWindow";

function MyComponent() {
  const { openWindow, closeWindow } = useWindow();

  const handleOpenClient = (client: any) => {
    const windowId = createWindowId("client", client.clientId);
    openWindow({
      id: windowId,
      title: `${client.firstName} ${client.lastName}`,
      icon: <User className="h-4 w-4" />,
      component: (
        <ClientView
          client={client}
          onClose={() => closeWindow(windowId)}
        />
      ),
      defaultSize: WINDOW_CONFIGS.client.defaultSize,
      minSize: WINDOW_CONFIGS.client.minSize,
      data: { clientId: client.clientId },
    });
  };
}
```

**Window Configurations**:
```typescript
WINDOW_CONFIGS = {
  client: { defaultSize: { width: 1200, height: 800 }, minSize: { width: 800, height: 600 } },
  event: { defaultSize: { width: 900, height: 700 }, minSize: { width: 600, height: 500 } },
  task: { defaultSize: { width: 600, height: 500 }, minSize: { width: 400, height: 400 } },
  settings: { defaultSize: { width: 700, height: 600 }, minSize: { width: 500, height: 400 } },
}
```

**Implementation Files**:
- [WindowContext.tsx](src/contexts/WindowContext.tsx) - State management (windows, z-index, active window)
- [WindowManager.tsx](src/components/WindowManager/WindowManager.tsx) - Global container
- [Window.tsx](src/components/WindowManager/Window.tsx) - Draggable/resizable shell
- [WindowTaskbar.tsx](src/components/WindowManager/WindowTaskbar.tsx) - Minimized windows bar
- [useWindow.ts](src/hooks/useWindow.ts) - Hook for window operations

**Packages**:
- `react-rnd` - React Resizable and Draggable

---

### Email Template System

**Purpose**: Customizable email templates for client communications with variable substitution and draft preview.

**Technology**: localStorage persistence + variable replacement system

**Features**:
- 6 default templates (Dog/Cat questionnaire reminders, protocol send, follow-up, consultation report, general)
- Create, edit, duplicate, delete, and reset templates
- Variable substitution with {{variableName}} syntax
- Draft preview and editing before sending
- Support for both web-based (Gmail) and desktop email clients
- Template manager UI accessible via Settings menu
- Attachment reminder alerts for file-based workflows

**Template Structure**:
```typescript
interface EmailTemplate {
  id: string;              // Unique identifier
  name: string;            // Display name
  subject: string;         // Email subject line (supports variables)
  body: string;            // Email body content (supports variables)
  variables: string[];     // List of available variables
  description: string;     // Template description
}
```

**Available Variables**:
- `{{clientFirstName}}` - Client's first name
- `{{clientLastName}}` - Client's last name
- `{{clientEmail}}` - Client's email
- `{{petName}}` - Pet's name
- `{{petSpecies}}` - Dog or Cat
- `{{consultationDate}}` - Consultation date
- `{{formUrl}}` - Jotform URL
- `{{formType}}` - Dog or Cat
- `{{currentDate}}` - Today's date
- `{{dueDate}}` - Task due date

**Template Management**:
```typescript
import {
  getAllTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  resetToDefaultTemplate,
  processTemplate
} from "@/lib/emailTemplates";

// Get all templates (merged defaults + custom)
const templates = getAllTemplates();

// Save or update custom template
saveCustomTemplate(template);

// Delete custom template
deleteCustomTemplate(templateId);

// Reset customized default to original
resetToDefaultTemplate(templateId);

// Process template with variables
const emailContent = processTemplate(template.body, {
  clientFirstName: "Sarah",
  petName: "Max",
  consultationDate: "15 Nov 2025"
});
```

**Email Draft Dialog**:
```typescript
import { EmailDraftDialog, EmailAttachment } from "@/components/ui/email-draft-dialog";

<EmailDraftDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSend={(to, subject, body) => {
    // Fallback: Open mailto: link for desktop clients
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  }}
  onEmailSent={() => {
    // Called after successful Resend delivery
    console.log("Email sent successfully");
  }}
  initialTo={client.email}
  initialSubject={processedSubject}
  initialBody={processedBody}
  clientName={client.firstName + ' ' + client.lastName}
  attachments={[{ path: "/path/to/file.pdf", name: "report.pdf" }]}
/>
```

**Features**:
- **Direct sending via Resend API** with file attachments
- Editable To, Subject, and Body fields
- Attachment preview with remove buttons
- Automatic email signature with logo
- Character count display
- Copy to clipboard for web-based email clients (Gmail)
- Open in email app fallback for desktop clients
- Edit tracking indicator
- Loading state during send

**Accessing Template Manager**:
1. Click Settings (gear icon) in Dashboard header
2. Select "Email Templates" from dropdown menu
3. Two-pane layout: Template list (left) + Preview/Edit (right)
4. Search, filter, and manage templates
5. Preview shows Subject and Body with variable highlighting
6. Variables tab shows all available template variables

**Storage**: Custom templates stored in localStorage key `pbs_admin_email_templates`

**Template Merging Logic**:
- Default templates defined in code (EMAIL_TEMPLATES array)
- Custom templates stored in localStorage
- Custom templates with same ID as defaults override them
- Reset function restores default version by deleting custom override

**Packages**:
- `@radix-ui/react-tabs` - Template preview tabs
- `@radix-ui/react-dropdown-menu` - Settings menu
- `@radix-ui/react-icons` - UI icons

---

### Email Sending System (Resend API)

**Purpose**: Direct email delivery from PBS Admin with file attachments, replacing manual mailto: workflow.

**Technology**: Resend API via Tauri backend command

**Architecture**:
```
PBS Admin (Frontend)
        │
        │ sendEmail({ to, subject, body, attachments })
        ▼
emailService.ts (TypeScript)
        │
        │ invoke("send_email", { ... })
        ▼
lib.rs (Rust Backend)
        │
        │ Read files, encode Base64, POST to Resend API
        ▼
Resend API (api.resend.com)
        │
        │ Delivers email
        ▼
Recipient Inbox
```

**Email Receiving**:
- ImprovMX forwards `glenn@petbehaviourservices.com.au` → personal Gmail
- MX records point to `mx1.improvmx.com` and `mx2.improvmx.com`
- Reply from Gmail using "Send mail as" feature

**Configuration** (`.env`):
```bash
# Resend API for sending emails
VITE_RESEND_API_KEY=re_xxxxxxxxxxxx
VITE_EMAIL_FROM=glenn@petbehaviourservices.com.au
```

**DNS Requirements** (Vercel):
```
MX   @   mx1.improvmx.com (priority 10)
MX   @   mx2.improvmx.com (priority 20)
TXT  @   v=spf1 include:spf.improvmx.com include:amazonses.com ~all
TXT  resend._domainkey   (DKIM record from Resend)
```

**Email Service** (`src/lib/services/emailService.ts`):
```typescript
import { sendEmail, isEmailServiceConfigured } from "@/lib/services/emailService";

// Check if Resend is configured
if (isEmailServiceConfigured()) {
  const result = await sendEmail({
    to: "client@example.com",
    subject: "Consultation Report",
    body: "Please find attached...",
    attachments: ["/path/to/report.pdf"],
    includeSignature: true, // Adds logo and contact info
  });

  if (result.success) {
    console.log("Email sent:", result.id);
  } else {
    console.error("Failed:", result.error);
  }
}
```

**Email Signature**:
- Automatically appended to all emails when `includeSignature: true`
- Includes: Glenn Tobiansky name, website link, phone number, PBS logo
- Logo hosted at: `https://petbehaviourservices.com.au/images/pbs-logo-transparent.png`

**Context Menu Integration**:
Right-click on email field in Client view shows:
- Paste
- Copy email address
- Compose email...
- **Send with attachment →** (submenu showing files from client folder)
  - Reports section (files containing "report" or "clinical")
  - Other Files section (questionnaires, transcripts, etc.)
- Open client folder

**Tauri Backend Command** (`src-tauri/src/lib.rs`):
```rust
#[tauri::command]
async fn send_email(
    api_key: String,
    from: String,
    to: String,
    subject: String,
    html_body: String,
    attachment_paths: Option<Vec<String>>,
) -> Result<serde_json::Value, String>
```

**Helper Functions**:
- `sendConsultationReport()` - Pre-filled template for sending client reports
- `sendVetReport()` - Pre-filled template for vet communications
- `sendQuestionnaireReminder()` - Pre-filled template for questionnaire reminders
- `getEmailSignature()` - Returns HTML signature for preview
- `isEmailServiceConfigured()` - Checks if API key is set

**Implementation Files**:
- [emailService.ts](src/lib/services/emailService.ts) - Email sending service
- [email-draft-dialog.tsx](src/components/ui/email-draft-dialog.tsx) - UI component
- [email-input.tsx](src/components/ui/email-input.tsx) - Context menu with attachments
- [lib.rs](src-tauri/src/lib.rs) - Rust backend command (send_email)

---

### Prescription Generation System

**Purpose**: Template-based prescription generation system for behavior medications with DOCX output and letterhead integration.

**Technology**: Pandoc for markdown-to-DOCX conversion with reference document styling

**Features**:
- Template-based prescription format with variable substitution
- Medication database with 40+ behavior medications
- Dosing information (Dog/Cat dose ranges, formulations, brands)
- Bold formatting for labels and key text
- Multi-line address formatting with Pandoc hard line breaks
- DOCX generation with letterhead template integration
- Automatic Event notes updates with prescription summary
- PDF conversion workflow (DOCX → PDF via MS Word)

**Prescription Template Structure**:
```markdown
{{prescription_date}}

**Prescription for "{{pet_name}}" {{client_surname}}, a {{pet_breed}}**

**Owner:** {{client_name}}\
{{client_address}}

**To the Pharmacist,**

Please supply the following medication for this animal under my care:

**Drug name:** {{medication_name}}
**Formulation:** {{formulation}}
**Dosage and directions:** {{dosage_directions}}

**FOR ANIMAL TREATMENT ONLY**

**Quantity:** {{amount_to_dispense}}
**Number of repeats:** {{repeats}}

{{#if special_instructions}}
**Special instructions:** {{special_instructions}}

{{/if}}
Please contact us if more information is required.

Yours sincerely,

**Dr. Glenn Tobiansky (V2794)**
{{prescription_date}}
```

**Available Variables**:
- `{{prescription_date}}` - Current date (dd/MM/yyyy)
- `{{pet_name}}` - Pet name
- `{{client_surname}}` - Client surname
- `{{pet_breed}}` - Pet breed
- `{{client_name}}` - Full client name
- `{{client_address}}` - Multi-line address
- `{{medication_name}}` - Generic medication name
- `{{formulation}}` - Tablet, Capsule, Liquid, etc.
- `{{dosage_directions}}` - Dose rate + frequency (e.g., "1 tablet once daily")
- `{{amount_to_dispense}}` - Total quantity
- `{{repeats}}` - Number of repeats
- `{{special_instructions}}` - Optional instructions

**Medication Database**:
Located in [medications.ts](src/lib/medications.ts):
- 40+ behavior medications (SSRIs, TCAs, GABAergic, Alpha-2 agonists, etc.)
- Each medication includes:
  - Generic name and brand names
  - Drug category and schedule class (S3, S4, S8)
  - Description and mechanism of action
  - Dog/Cat dose ranges (mg/kg or fixed dose)
  - Common indications and contraindications
  - Side effects and important notes
  - Default frequency
  - Species-specific dosing

**Medication Update Service**:
Automated monthly check for updated brand names using web search:
1. Chemist Warehouse (primary source for Australian market availability)
2. PBS.gov.au (government pharmaceutical benefits scheme)
3. healthdirect.gov.au (government health information)

**Workflow**:
1. Select pet and medication from dropdown
2. Choose formulation type (Tablet, Capsule, Liquid, etc.)
3. Enter dose concentration (e.g., "20mg per tablet")
4. Enter pet weight (optional) to see suggested dose range
5. Set dose rate, frequency, amount to dispense, and repeats
6. Add special instructions (optional)
7. Click "Generate Prescription (DOCX)"
8. System generates DOCX with letterhead and opens file automatically
9. Event notes updated with simple prescription summary

**DOCX Generation** (Rust Backend):
```rust
// Uses Pandoc with hard_line_breaks extension
pandoc -f markdown+hard_line_breaks --reference-doc Prescription_Template.docx -o output.docx
```

**Letterhead Integration**:
- User provides `Prescription_Template.docx` in `Documents/PBS_Admin/Templates/`
- **IMPORTANT**: Letterhead must be in the **Header section** of the Word template, NOT in the document body
- To add letterhead to header: Open template in Word → Insert → Header → Edit Header → Add logo/letterhead content
- Pandoc's `--reference-doc` only applies content from **headers, footers, styles, and page settings** - not body content
- If letterhead appears in body instead of header, it will NOT appear in generated documents
- Pandoc applies template's header/footer, styles, and page settings

**File Naming**:
- Format: `{surname}_{YYYYMMDD}_prescription_{medication}.docx`
- Example: `chen_20251201_prescription_fluoxetine.docx`
- Location: Client folder

**Event Notes**:
Simple prescription summary saved to Event notes:
```
Drug name: Fluoxetine
Formulation: Tablet
Dosage and directions: 0.5 tablet once daily
FOR ANIMAL TREATMENT ONLY
Quantity: 28
Number of repeats: 5
Special instructions: Give with food
```

**Storage**: Template stored in localStorage key `pbs_admin_prescription_template`

**Implementation Files**:
- [prescriptionTemplates.ts](src/lib/prescriptionTemplates.ts) - Template management
- [medications.ts](src/lib/medications.ts) - Medication database
- [medicationUpdateService.ts](src/lib/services/medicationUpdateService.ts) - Brand name updates
- [PrescriptionEventPanel.tsx](src/components/Event/PrescriptionEventPanel.tsx) - UI component
- [lib.rs](src-tauri/src/lib.rs) - Pandoc integration (lines 485-560)

**Dependencies**:
- **Pandoc 3.8+**: Must be installed on system (`pandoc-3.8.2.1-windows-x86_64.msi`)
- **MS Word**: Required for DOCX → PDF conversion (desktop Office, not web version)

**Known Issues** (TODO):
- Event notes not updating after prescription generation (query invalidation issue)
- Letterhead not appearing in generated DOCX (template header configuration)

---

### Foreign Key Cascade Rules

| Relationship | On Delete Behavior | Rationale |
|--------------|-------------------|-----------|
| Client → Pet | CASCADE | Privacy/GDPR compliance |
| Client → Event | CASCADE | Historical records tied to client |
| Client → Task | SET NULL | Allow orphaned admin tasks |
| Event → Task | SET NULL | Tasks may be general admin items |

---

### Automation Rules Engine

**Design**: Event-driven architecture with declarative rules.

```typescript
interface AutomationRule {
  trigger: 'event.created' | 'event.updated' | 'task.created' | 'task.updated';
  condition: (entity: Event | Task) => boolean;
  actions: Action[];
}

interface Action {
  type: 'create.task' | 'create.event' | 'update.status' | 'notify';
  payload: any;
}
```

#### Example: Booking → Questionnaire Task

**Trigger**: Event.created where eventType === "Booking"

**Action**:
1. Create Task with:
   - description: "Check questionnaire returned ≥ 48 hours before consultation"
   - dueDate: Event.date minus 48 hours (Australia/Melbourne)
   - priority: 1 (high)
   - status: "Pending"
   - triggeredBy: "Event:Booking"
   - automatedAction: "CheckQuestionnaireReturned"
   - clientId: Event.clientId
   - eventId: Event.eventId

---

## UI Screens and Workflows

### 1. Dashboard (Landing Screen)

**Layout**: Two-pane layout

**Left Pane - Clients List**:
- Searchable, sortable, filterable table
- Columns: FirstName, LastName, Email, Mobile, City/State, #Pets, LastEventDate, Notes badge
- Actions:
  - "Add New Client" → Opens Client View with blank form
  - "View Selected Client" → Opens Client View populated with client data

**Right Pane - Overview**:
- **Upcoming Bookings** table:
  - Columns: EventType, Client, Pet(s), Date/Time, Status
  - Filter: Next 7/14/30 days
  - Sorted by date ascending
  - Quick actions: Open Event, Open Client

- **Tasks** table:
  - Columns: Description, Client, Event, Priority, Status, DueDate
  - Filter: Status (Pending/InProgress by default)
  - Overdue tasks highlighted
  - Quick actions: Mark Done, Edit, Open Client, Open Task

**Implementation Notes**:
- Use TanStack Table for high-performance tables
- Implement virtual scrolling for 10,000+ rows
- Persist filter/sort preferences in localStorage

---

### 2. Client View

**Layout**: Two-pane layout

**Left Pane - Client Form**:
- All fields from Client entity:
  - First Name, Last Name (required)
  - Email (required, validated format)
  - Mobile (required, auto-formatted to xxxx xxx xxx)
  - Street Address, City, State, Postcode
  - State: Dropdown with Australian states, defaults to Victoria (VIC)
  - Notes (textarea)
- **Change Tracking**:
  - Save button disabled until changes are made
  - Compares current values with original data
  - Clear visual feedback when fields are modified
- **Save Confirmation**:
  - Button states: "Save Changes" → "Saving..." → "Saved!"
  - Shows checkmark icon for 2 seconds after successful save
  - Automatically resets original data to disable button
  - Fields clear their "modified" state after save
- **Folder Management**:
  - "Create or Change Client Folder" button (if no folder exists)
  - "Open Folder" button (if folder path is set)
  - Opens folder in Windows File Explorer
- Validation:
  - Required: firstName, lastName, email, mobile
  - Email format validation
  - Mobile format validation (Australian)
  - Real-time error feedback

**Right Pane - Three CRUD Tables**:

1. **Pets Table**:
   - Columns: Name, Species, Breed, Sex, DOB, Notes
   - Inline add/edit/delete

2. **Events Table**:
   - Columns: EventType, Date/Time, Status, Notes (truncated), Invoice links
   - Click to open Event Detail window
   - Add button to create new event

3. **Tasks Table**:
   - Columns: Description, DueDate, Priority, Status, CompletedOn
   - Click to open Task Detail window
   - Add button to create new task

**Computed Summaries**:
- Number of open tasks
- Next upcoming event
- Last consultation date
- Total events count

**Implementation Notes**:
- Explicit save with change tracking (implemented)
- Shows "Saved!" confirmation after successful save
- Keyboard shortcuts: Ctrl+S to save, Esc to cancel (TODO)

---

### 3. Event Detail Window

**Layout**: Two-pane layout

**Left Pane - Structured Notes Editor**:
- Rich text editor with:
  - Headings (H1-H3)
  - Bullet lists
  - Numbered lists
  - Checkboxes for protocols
  - Bold, italic formatting
- Auto-save notes

**Right Pane - Event Controls**:
- Event metadata form:
  - EventType dropdown (extensible)
  - Date/Time picker (Australia/Melbourne timezone)
  - Status dropdown
  - CalendlyEventUri (link)
  - CalendlyStatus
  - InvoiceFilePath (file picker)
  - HostedInvoiceUrl (link)

- Actions:
  - "Create Related Task" → Opens Task form with clientId and eventId pre-filled
  - "Create Related Event" → Opens Event form with parentEventId set
  - "Mark as Completed/No-Show/Rescheduled" → Updates status

- Relationships View:
  - Parent event (if any) with link
  - Child events list with links
  - Related tasks list with links

**Implementation Notes**:
- Consider using Tiptap or similar for rich text
- Show event lineage as a breadcrumb or tree
- Warn before deleting events with children

---

### 4. Task Detail Window

**Layout**: Single pane form

**Fields**:
- Description (textarea)
- Client (searchable dropdown, can be null)
- Event (searchable dropdown, can be null)
- DueDate (date/time picker, Australia/Melbourne)
- Status (dropdown with status transitions)
- Priority (1-5 slider or dropdown)
- AutomatedAction (text input, read-only if automated)
- TriggeredBy (text input, read-only if automated)
- CompletedOn (auto-filled when status → Done)
- Recurrence (optional, for admin tasks)

**Actions**:
- "Open Client" → Navigate to Client View
- "Open Event" → Navigate to Event Detail
- "Mark Done" → Set status to Done, set CompletedOn
- "Create Child Task" → Opens Task form with parentTaskId set

**Status Transitions**:
- Pending → InProgress, Blocked, Canceled
- InProgress → Blocked, Done, Canceled
- Blocked → InProgress, Canceled
- Done → (final state)
- Canceled → (final state)

**Implementation Notes**:
- Show overdue indicator if dueDate < now and status ∉ [Done, Canceled]
- Keyboard shortcut: Ctrl+D to mark done

---

## Automation Workflows

### 1. Booking Event Workflow

**Trigger**: Event created with eventType === "Booking"

**Steps**:
1. **Client Creation/Matching**:
   - Search for existing client by email (primary) or mobile (fallback)
   - If not found, create new Client

2. **Pet Creation/Matching**:
   - If pet information provided (name, species)
   - Search for pet by name under the client
   - If not found, create new Pet

3. **Event Creation**:
   - Create Booking event with provided details

4. **Auto-create Questionnaire Task**:
   - description: "Check questionnaire returned ≥ 48 hours before consultation"
   - dueDate: Event.date minus 48 hours (Australia/Melbourne timezone)
   - priority: 1 (high)
   - status: "Pending"
   - triggeredBy: "Event:Booking"
   - automatedAction: "CheckQuestionnaireReturned"
   - clientId: Event.clientId
   - eventId: Event.eventId

5. **Overdue Handling**:
   - If dueDate passes and status still "Pending"
   - Show as overdue in Dashboard
   - Optional: Fire local notification (non-intrusive)

---

### 2. Consultation Event Workflow (Simplified)

**Purpose**: Manual workflow supporting flexible AI processing outside the app.

**Consultation Recording**:
- **Zoom consultations**: Record with Fathom (auto-generates transcript)
- **Home visits**: Record with iPhone voice memo app

**Transcript Processing**:
- **Fathom**: Copy transcript to .txt file
- **iPhone**: Download recording → Process through MS Word → Save as .txt

**PBS Admin Workflow**:
1. **Create/Open Consultation Event**:
   - User selects "Consultation" event type
   - Right panel shows ConsultationEventPanel with transcript section

2. **Save Transcript**:
   - Paste transcript text from MS Word/Fathom into textarea
   - Character count displayed for validation (minimum 10 characters)
   - Click "Save Transcript" button
   - System saves to client folder: `{surname}_{YYYYMMDD}_transcript.txt`
   - Textarea disappears, confirmation message appears: "Transcript saved: {filename}"
   - Event.transcriptFilePath updated in database
   - **Transcript files dropdown** appears showing all .txt files in client folder
   - Dropdown auto-refreshes after saving to show newly created file
   - Shows "No txt files found" if folder is empty

3. **Replace Transcript** (if needed):
   - Click "Replace Transcript" button
   - Confirmation dialog: "Are you sure you want to replace the existing transcript file?"
   - If confirmed, textarea reopens (empty)
   - Paste new transcript and save (overwrites previous file)

4. **Generate Abridged Clinical Notes** (in-app):
   - Click "Generate Abridged Notes" button in ConsultationEventPanel
   - AI generates HTML-formatted clinical summary from transcript
   - Preview shows generated content before saving
   - Click "Save to Event Notes" to store in Event.notes field
   - Appears in left panel for quick reference

5. **Generate Comprehensive Clinical Notes (DOCX)** (in-app):
   - Click "Generate Comprehensive Notes (DOCX)" button
   - AI generates detailed 3-5 page clinical report in markdown
   - Automatically converts to DOCX using Pandoc with letterhead template
   - Saves to client folder: `{surname}_{YYYYMMDD}_comprehensive-clinical_v{N}.docx`
   - Success notification with:
     - Green confirmation box showing filename
     - "Open Document" button to view in Word
     - "Regenerate" button if needed

6. **Generate Post-Consultation Tasks** (in-app):
   - Click "Post-Consultation Tasks" button
   - **Standard Tasks** (pre-checked, opt-out model):
     - Send consultation report to client (+5 days, priority 1)
     - Post-consultation follow-up email (+7 days, priority 2)
     - 2-week post-consultation follow-up email (+14 days, priority 2)
     - Uncheck any tasks not needed for this case
   - **Case-Specific Tasks** (AI-extracted):
     - Click "Extract Tasks from Notes" button
     - AI analyzes transcript AND clinical notes
     - Extracts practitioner tasks with descriptions, due dates, priorities
     - Review and remove any unwanted tasks
   - **Manual Task Entry**:
     - Click "Add Task Manually" button
     - Enter description, select due offset (+1 day to +8 weeks), set priority (1-5)
     - Manual tasks show "Manual" label and can be removed like AI tasks
   - Click "Create X Tasks" to create all tasks at once
   - Tasks linked to client and consultation event

7. **External AI Processing** (optional, outside PBS Admin):
   - User manually processes transcript + questionnaire through preferred AI:
     - ChatGPT 5.1
     - Claude Opus 4.5
     - Gemini 3 Pro
     - (Chooses best-performing AI at the time)
   - Uses custom prompts for:
     - Client report
     - Vet report (when needed)
   - Manually reviews/edits AI output in Word
   - Saves reports to client folder
   - Manually emails client report with cover letter

**Benefits**:
- **In-app AI**: Abridged notes, comprehensive DOCX, and task extraction built-in
- **Flexibility**: Choose in-app or external AI processing
- **Control**: Manual review/editing before finalizing
- **Simplicity**: No forced automation, opt-out model for standard tasks
- **Privacy**: Full reports stored locally in client folders
- **Gradual automation**: Can add more automation features incrementally

---

### 3. Client Creation Workflow

**Trigger**: Client created via ClientForm

**Steps**:
1. **Client Creation**:
   - User fills out ClientForm with required fields
   - Validation for firstName, lastName, email, mobile
   - Mobile phone auto-formatted to xxxx xxx xxx
   - State defaults to Victoria (VIC)

2. **Auto-create Note Event**:
   - eventType: "Note"
   - notes: "Client created"
   - date: Current timestamp (Australia/Melbourne timezone)
   - clientId: Newly created client
   - Automatic tracking for compliance and record-keeping

3. **Folder Creation Dialog**:
   - Modal prompts user to create client folder
   - Default location: Documents/PBS_Admin/Client_Records
   - Folder naming: `{surname}_{clientId}` (e.g., "duncan_24")
   - Options: Create Folder, Skip for Now, Cancel
   - Custom path option available

4. **Folder Management**:
   - If folder created, store path in `client.folderPath`
   - Success dialog with "Open Folder" button
   - ClientView button changes from "Create Folder" to "Open Folder"
   - Folder opens in Windows File Explorer via Tauri opener plugin

---

## AI Integration

### Bulk Task Importer

**Purpose**: Import AI-extracted tasks from consultation transcripts directly into PBS Admin.

**Technology**: JSON parsing + date calculation utilities

**Workflow**:
1. Record consultation (iPhone voice memo, Zoom with Fathom, etc.)
2. Get transcript (manually or via Fathom)
3. Paste transcript into ChatGPT or Claude with task extraction prompt
4. Copy JSON output from AI
5. In PBS Admin, click green "Import Tasks" button on Consultation event
6. Paste JSON, review/edit tasks, and import

**Features**:
- Auto-parses JSON with real-time validation
- Calculates due dates from consultation date + offset strings
- Preview table with editable fields (description, offset, priority)
- Remove unwanted tasks before importing
- Bulk creates all tasks linked to consultation event and client
- Automatically refreshes Dashboard and Client view

**Access**:
- Green checklist icon (📋) appears on all **Consultation** events in EventsTable
- Opens BulkTaskImporter dialog for that specific consultation
- Pre-fills consultation date and client information

**JSON Format**:
```json
[
  {
    "description": "Email behavior modification protocol to client",
    "dueDateOffset": "3 days",
    "priority": 1,
    "context": "Optional context for reference (not saved)"
  },
  {
    "description": "Schedule in-home follow-up visit",
    "dueDateOffset": "1 week",
    "priority": 2,
    "context": "Monday or Friday late afternoon preferred"
  }
]
```

**Date Offset Utilities** ([dateOffsetUtils.ts](src/lib/utils/dateOffsetUtils.ts)):
- `calculateDueDate(baseDate, offset)` - Converts offset to ISO date
- `isValidOffset(offset)` - Validates offset format
- `formatOffset(offset)` - Normalizes display format

**Supported Offset Formats**:
- Hours: "24 hours", "48 hours"
- Days: "1 day", "3 days", "7 days"
- Weeks: "1 week", "2 weeks"
- Months: "1 month", "2 months"

**Task Creation**:
- All tasks created with status "Pending"
- TriggeredBy: "Consultation"
- AutomatedAction: "Manual"
- Linked to consultation event and client

**AI Task Extraction Prompt**:
Standardized prompt for extracting practitioner tasks from consultation transcripts with:
- Task granularity guidelines (not too broad, not too granular)
- Priority definitions (1-5 scale based on urgency)
- Standardized date offset formats
- Validation rules (only practitioner tasks, no client homework)
- Quality checks to prevent manufactured tasks

**Query Invalidation**:
- Invalidates `["tasks", clientId]` for client view refresh
- Invalidates `["tasks", "dashboard"]` for Dashboard refresh
- Invalidates `["client", clientId]` for client summary refresh

**Implementation Files**:
- [BulkTaskImporter.tsx](src/components/Task/BulkTaskImporter.tsx) - Main component
- [dateOffsetUtils.ts](src/lib/utils/dateOffsetUtils.ts) - Date calculation utilities
- [EventsTable.tsx](src/components/Event/EventsTable.tsx) - Integration point (green button)

**Future Enhancements**:
1. Direct API integration with Claude/ChatGPT for one-click processing
2. Automatic transcription with Whisper API for voice memos
3. Fathom API integration for automatic transcript fetching
4. Template library for common consultation task sets
5. Task templates based on consultation type (aggression, anxiety, etc.)

---

### AI Report Generation

**Purpose**: Generate professional consultation reports and follow-up emails from consultation transcripts using Claude Sonnet 4.5 API.

**Technology**: Anthropic SDK with prompt caching for cost efficiency

**Workflow**:
1. Veterinarian conducts consultation (records via voice memo, Zoom, etc.)
2. Obtain transcript (manually or via transcription service)
3. In PBS Admin, click blue "Generate Report" button on Consultation event
4. Paste or upload transcript (.txt file)
5. AI generates two outputs: client report (markdown) and follow-up email
6. Preview both documents with tabs
7. Save report to client folder (markdown file)
8. Opens email draft dialog with pre-filled follow-up email
9. Creates "Report Sent" event for audit trail

**Features**:
- **Two-output generation**: Professional report for records + client-friendly follow-up email
- **Template-based structure**: 7-section report following established methodology
- **Prompt caching**: Cost optimization by caching system prompt (reduces API costs)
- **Preview and edit**: Review generated content before saving
- **Markdown storage**: Reports saved as .md files in client folders
- **Cost estimation**: Shows token count and estimated cost before generation
- **Transcript upload**: Paste text or upload .txt file
- **Email integration**: Opens draft with pre-filled content using email template system

**Report Structure** (7 sections):
1. **Header Block**: Client/pet info, consultation date, type
2. **Understanding Pet's Behaviour**: 4 factors explaining behaviour, positive reframe
3. **Safety Rules**: If applicable (aggression cases), KISS principle - simple enough for ADHD child
4. **What To Do Now**: Immediate actions before follow-up
5. **What to Expect**: Timeline, non-linear progress, medication option
6. **Next Steps**: Schedule follow-up, training packages info
7. **Questions & Closing**: Contact info, reassurance, signature

**Follow-up Email Template**:
- Subject: `[Pet name] - Check-in and [Next Step Action]`
- Check-in questions about implementing advice
- Schedule next appointment (with pricing/timing)
- Training package options
- Professional signature block

**Writing Rules** (AI enforced):
- **Australian English**: behaviour, recognise, organised, neighbourhood
- **KISS Principle**: Simple language, no jargon
- **Extraction-only**: Never invent advice not in transcript
- **Tone**: Warm, professional, empathetic, never condescending
- **Short paragraphs**: Maximum 3-4 sentences
- **Limited lists**: Maximum 3-4 bullet points
- **No quotes**: Paraphrase, never quote directly
- **Specific timelines**: Use exact numbers if mentioned (e.g., "6-8 weeks")

**Access**:
- Blue FileText icon (📄) appears on all **Consultation** events in EventsTable
- Opens ReportGeneratorDialog for that specific consultation
- Pre-fills consultation date, client, and pet information

**File Naming**:
- Format: `consultation-report-YYYYMMDD-HHmmss.md`
- Location: Client folder (same location as questionnaires)
- Example: `consultation-report-20251119-143022.md`

**Event Tracking**:
Creates "Note" event after successful save:
```html
<h2>Consultation Report Generated</h2>
<p><strong>File:</strong> consultation-report-20251119-143022.md</p>
<p><strong>Consultation Date:</strong> 15/11/2025</p>
<p>Report generated using AI and saved to client folder.</p>
```

**Cost Optimization**:
- **Prompt caching**: System prompt (methodology) cached with ephemeral cache control
- **Cache duration**: 5 minutes (Anthropic default)
- **Cache benefit**: Subsequent reports within 5 minutes use cached prompt (90% cost reduction on input tokens)
- **Token estimation**: Shows estimated cost before generation
- **Model**: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
- **Pricing**: ~$3/million input tokens, ~$15/million output tokens (as of March 2024)

**Configuration** (`.env`):
```bash
# Anthropic API (for report generation)
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Implementation Files**:
- [report-system-prompt.ts](src/lib/prompts/report-system-prompt.ts) - Full methodology and instructions for AI
- [reportGenerationService.ts](src/lib/services/reportGenerationService.ts) - Claude API integration with caching
- [ReportGeneratorDialog.tsx](src/components/Event/ReportGeneratorDialog.tsx) - UI component
- [EventsTable.tsx](src/components/Event/EventsTable.tsx) - Integration point (blue button)

**Query Invalidation**:
- Invalidates `["events", clientId]` for client view refresh
- Invalidates `["client", clientId]` for client summary refresh

**Dependencies**:
- `@anthropic-ai/sdk` - Official Anthropic SDK for Claude API
- `react-markdown` - Markdown rendering for report preview

### Report Export and Delivery Workflow

**Complete Pipeline**: MD → DOCX → PDF → Email

After generating the initial markdown report, the system provides a complete export and delivery workflow:

**Phase 1: Markdown Generation**
- AI generates report from transcript
- Saved as versioned MD file: `{surname}_{YYYYMMDD}_consultation-report_v{N}.md`
- Example: `swaneveld_20251117_consultation-report_v1.md`
- Versions increment only on regeneration (not when editing)
- 24-hour reminder task created to review report

**Phase 2: External Editing**
- User opens MD file in professional editor (Notepad++, VS Code, etc.)
- Edit and save (filename remains the same)
- Return to dialog when ready for conversion

**Phase 3: DOCX Conversion (Pandoc)**
- Convert MD to DOCX with letterhead template
- Template: `General_PBS_Letterhead.docx` (user-provided Word template)
- Uses Pandoc `--reference-doc` to apply letterhead styles/headers/footers
- Output: `{surname}_{YYYYMMDD}_consultation-report_v{N}.docx`
- Creates "DOCX Converted" event for tracking

**Phase 4: PDF Conversion (MS Word COM)**
- Convert DOCX to client-friendly PDF using MS Word automation
- PowerShell script controls Word.Application COM object
- Client-friendly filename: `{PetName}_Consultation_Report_{17Nov2025}.pdf`
- Example: `Beau_Consultation_Report_17Nov2025.pdf`
- Creates "PDF Converted" event for tracking

**Phase 5: Email Delivery**
- "Send Report to Client" button appears when PDF exists
- Opens EmailDraftDialog with pre-filled cover letter
- Template: "Consultation Report Cover Letter"
- Amber alert shows PDF filename and folder location
- User reviews/edits email
- Click "Open in Email App" → Opens mailto: link
- User manually attaches PDF from folder
- Creates "Report Sent" event with timestamp

**File Detection on Dialog Reopen**:
- Detects existing MD, DOCX, and PDF files
- Restores workflow state automatically
- Shows appropriate conversion buttons based on files present

**Implementation Files**:
- [docxConversionService.ts](src/lib/services/docxConversionService.ts) - Pandoc integration
- [pdfConversionService.ts](src/lib/services/pdfConversionService.ts) - MS Word COM automation
- [emailTemplates.ts](src/lib/emailTemplates.ts) - Consultation report cover letter template

**Tauri Commands**:
```rust
// Pandoc conversion (MD → DOCX)
run_pandoc(input_path: String, output_path: String, template_path: Option<String>)

// MS Word conversion (DOCX → PDF)
convert_docx_to_pdf(docx_path: String, pdf_path: String)

// Get templates folder
get_templates_path() -> Result<String, String>
```

**Template Location**:
- User must place `General_PBS_Letterhead.docx` in `Documents/PBS_Admin/Templates/`
- Template must be compatible with Pandoc `--reference-doc` format

**Dependencies**:
- **Pandoc**: Must be installed on system (`pandoc-3.8.2.1-windows-x86_64.msi`)
- **MS Word**: Must be installed for COM automation (desktop Office, not web version)

**Future Enhancements**:
1. Direct transcription integration (Whisper API for voice memos)
2. Fathom.video API integration for automatic Zoom transcript retrieval
3. Automatic email attachment (requires file dialog integration)
4. Template customization UI for adjusting report structure
5. Report version history and comparison
6. Batch processing for multiple consultations

---

### AI Prompt Template Management System

**Purpose**: Manage and customize AI prompts for multiple report types with easy editing workflow via Claude Chat.

**Technology**: localStorage persistence + variable substitution system

**Workflow**:
1. User opens Settings menu → "AI Prompts"
2. View all available prompt templates (3 default templates)
3. Select template to view/edit
4. Copy prompt to clipboard
5. Paste into Claude Chat for editing
6. Copy updated prompt from Claude Chat
7. Paste back into PBS Admin
8. Save customized template

**Features**:
- **3 Default Templates**:
  1. **Comprehensive Clinical Report** (3-5 pages, markdown)
     - Detailed behavior analysis with 7-section structure
     - Output: Markdown for DOCX conversion
     - Max tokens: 8000
  2. **Abridged Clinical Notes** (1-2 pages, HTML)
     - Concise summary for in-app Event notes
     - Output: HTML for database storage
     - Max tokens: 4000
  3. **Veterinary Report** (3/4-1 page, markdown)
     - Professional vet-to-vet communication
     - Output: Markdown for DOCX conversion
     - Max tokens: 4000
     - Requires primaryCareVet field on Client

- **Template Management**:
  - Create, edit, duplicate, delete custom templates
  - Reset customized templates to defaults
  - Search and filter templates by name/category
  - Track customization status with badges

- **UI Components**:
  - Two-pane layout: Template list (left) + Editor (right)
  - Tabs: System Prompt, Variables
  - Copy button for Claude Chat workflow
  - Real-time character count
  - Unsaved changes tracking
  - **AI Model Info Card**: Displays current model (provider, name, ID, release date)
  - **Check for Updates button**: Opens Anthropic models documentation to check for newer versions

**Template Structure**:
```typescript
interface PromptTemplate {
  id: string;              // Unique identifier
  name: string;            // Display name
  description: string;     // Template description
  systemPrompt: string;    // Full AI instruction set
  outputFormat: 'markdown' | 'html';
  maxTokens: number;       // Claude API max tokens
  variables: string[];     // Available template variables
  enabled: boolean;        // Active/inactive status
  category?: string;       // Grouping (e.g., "Clinical Reports")
}
```

**Variable Substitution**:
Templates support dynamic content replacement:
- `{{clientName}}` - Client full name
- `{{petName}}` - Pet name
- `{{petSpecies}}` - Dog or Cat
- `{{petBreed}}` - Breed (optional)
- `{{petAge}}` - Age (optional)
- `{{petSex}}` - Sex (optional)
- `{{consultationDate}}` - Consultation date formatted
- `{{transcript}}` - Full consultation transcript
- `{{questionnaire}}` - Questionnaire data (optional)
- `{{vetClinicName}}` - Primary care vet clinic (optional)

**Storage**:
- Custom templates stored in localStorage: `pbs_admin_prompt_templates`
- Merging logic: Custom templates override defaults by ID
- Reset functionality restores default version

**Access**:
- Settings menu (gear icon) in Dashboard header
- Select "AI Prompts" from dropdown

**Implementation Files**:
- [promptTemplates.ts](src/lib/prompts/promptTemplates.ts) - Template management service
- [PromptTemplateManager.tsx](src/components/PromptTemplateManager/PromptTemplateManager.tsx) - UI component
- [Dashboard.tsx](src/components/Dashboard/Dashboard.tsx) - Integration point

**User Workflow Quote**:
> "what I am likely to do is to copy the existing prompt and paste it into claude chat and describe what I want changed, then copy the updated prompt created by claude chat back into the app"

---

### Multi-Report Generation Service

**Purpose**: Generate multiple report types in parallel from a single consultation transcript using Claude Sonnet 4.5 API.

**Technology**: Anthropic SDK with parallel execution and prompt caching

**Architecture**:
```
Consultation Transcript
        │
        ├──> Comprehensive Clinical Report (MD)
        │    - Saved to client folder as DOCX
        │    - 3-5 pages, detailed analysis
        │
        ├──> Abridged Clinical Notes (HTML)
        │    - Saved to Event.notes field
        │    - 1-2 pages, concise summary
        │
        └──> Veterinary Report (MD) [Optional]
             - Saved to client folder as DOCX
             - 3/4-1 page, vet-to-vet communication
             - Requires primaryCareVet field
```

**Report Types**:

1. **Comprehensive Clinical Report**:
   - **Purpose**: Detailed record for client folder
   - **Format**: Markdown → DOCX (via Pandoc) → PDF (via MS Word)
   - **Structure**: 7 sections (Header, Understanding Behaviour, Safety Rules, What To Do Now, What to Expect, Next Steps, Questions & Closing)
   - **Output**: `{surname}_{YYYYMMDD}_consultation-report.docx`
   - **Use Case**: Primary client record, sent to client after consultation

2. **Abridged Clinical Notes**:
   - **Purpose**: Quick reference for in-app viewing
   - **Format**: HTML (stored in Event.notes field)
   - **Structure**: Concise summary with key points
   - **Output**: Directly saved to database
   - **Use Case**: Fast lookup without opening files

3. **Veterinary Report**:
   - **Purpose**: Professional communication to referring vet
   - **Format**: Markdown → DOCX (via Pandoc)
   - **Structure**: Vet-to-vet professional language
   - **Output**: `{surname}_{YYYYMMDD}_vet-report.docx`
   - **Use Case**: On-demand generation when vet follow-up required

**Parallel Generation**:
```typescript
export async function generateConsultationReports(
  params: ReportGenerationParams,
  options: {
    generateComprehensive?: boolean;
    generateAbridged?: boolean;
    generateVet?: boolean;
  }
): Promise<MultiReportResult> {
  const promises = [];

  // Queue all selected reports
  if (options.generateComprehensive) promises.push(generateComprehensiveClinicalReport(params));
  if (options.generateAbridged) promises.push(generateAbridgedClinicalNotes(params));
  if (options.generateVet) promises.push(generateVeterinaryReport(params));

  // Execute in parallel
  const results = await Promise.all(promises);

  return {
    comprehensiveReport: /* ... */,
    abridgedNotes: /* ... */,
    vetReport: /* ... */,
    errors: /* ... */
  };
}
```

**Prompt Caching**:
- System prompts cached with `cache_control: { type: "ephemeral" }`
- Cache duration: 5 minutes (Anthropic default)
- **Cost savings**: 90% reduction on cached input tokens
- Subsequent reports within 5 minutes use cached prompt
- Estimated cost per report set: ~$0.15-0.30 (varies by transcript length)

**Token Tracking**:
```typescript
interface ReportGenerationResult {
  content: string;
  template: PromptTemplate;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  error?: string;
}
```

**Cost Estimation**:
- `estimateReportCost(transcriptLength, questionnaireLength, reportTypes)` function
- Shows estimated tokens and USD cost before generation
- Pricing (as of March 2024):
  - Input: ~$3/million tokens
  - Output: ~$15/million tokens

**Error Handling**:
- Per-report error tracking (one failure doesn't block others)
- Errors array contains specific failure messages
- Successful reports still returned even if some fail

**Implementation Files**:
- [multiReportGenerationService.ts](src/lib/services/multiReportGenerationService.ts) - Core service
- [promptTemplates.ts](src/lib/prompts/promptTemplates.ts) - Template retrieval
- [ReportGeneratorDialog.tsx](src/components/Event/ReportGeneratorDialog.tsx) - UI integration (future)

**Configuration** (`.env`):
```bash
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Model**: `claude-sonnet-4-20250514` (Claude Sonnet 4.5)

---

### Transcript File Management

**Purpose**: Save consultation transcripts to client folders for on-demand report generation and compliance record-keeping.

**Technology**: Tauri file system API with versioning support

**Workflow**:
1. User conducts consultation (voice memo, Zoom, etc.)
2. Obtain transcript (manual typing, transcription service, Fathom, etc.)
3. In Consultation event, paste or upload transcript
4. Save transcript to client folder as .txt file
5. Store file path in `Event.transcriptFilePath` field
6. Use saved transcript for:
   - Initial multi-report generation
   - On-demand vet report generation (weeks later)
   - Re-generation if needed
   - Compliance and audit trail

**File Naming Convention**:
- Format: `{surname}_{YYYYMMDD}_transcript.txt`
- Example: `duncan_20251115_transcript.txt`
- Lowercase surname for consistency

**Auto-Versioning**:
- If file exists, append version number
- Format: `{surname}_{YYYYMMDD}_transcript_v{N}.txt`
- Example: `duncan_20251115_transcript_v2.txt`
- Versions increment automatically (v2, v3, v4, ...)

**Database Schema Updates**:

**Client Model**:
```prisma
model Client {
  // ... existing fields
  primaryCareVet   String?  // Primary care veterinarian for vet reports
  // ...
}
```

**Event Model**:
```prisma
model Event {
  // ... existing fields
  transcriptFilePath   String?  // Path to saved consultation transcript (.txt file)
  questionnaireFilePath String? // Path to saved questionnaire file (.json file)
  // ...
}
```

**Service Functions**:

```typescript
// Save transcript to client folder
export async function saveTranscriptFile(
  clientFolderPath: string,
  clientSurname: string,
  consultationDate: string,
  transcriptContent: string
): Promise<TranscriptSaveResult> {
  // Generates filename, checks for duplicates, auto-versions
  // Uses Tauri invoke: write_text_file
  // Returns { success, filePath, fileName }
}

// Read transcript from saved file
export async function readTranscriptFile(filePath: string): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  // Uses Tauri fs plugin: readTextFile
  // Returns transcript content or error
}

// Copy questionnaire JSON to client folder
export async function copyQuestionnaireFile(
  sourcePath: string,
  clientFolderPath: string,
  clientSurname: string,
  consultationDate: string
): Promise<TranscriptSaveResult> {
  // Copies questionnaire JSON from Jotform downloads
  // Same naming convention and versioning logic
}

// List available questionnaires in client folder
export async function listQuestionnaireFiles(
  clientFolderPath: string
): Promise<{
  success: boolean;
  files?: Array<{ name: string; path: string }>;
  error?: string;
}> {
  // Filters for .json files containing 'questionnaire'
  // Used for dropdown selection in report generation
}

// Validate transcript content
export function validateTranscriptContent(content: string): {
  valid: boolean;
  errors: string[];
} {
  // Checks: not empty, minimum 100 characters, maximum 1MB
}

// Check if transcript file exists
export async function transcriptFileExists(filePath: string | null): Promise<boolean> {
  // Quick existence check for UI state
}
```

**Tauri Commands Used**:
```rust
// Write text file to disk
invoke("write_text_file", { filePath, content })

// Read directory entries
invoke("plugin:fs|read_dir", { path: clientFolderPath })
```

**On-Demand Generation Workflow**:
1. User opens existing Consultation event (e.g., 2 weeks after initial consultation)
2. Clicks "Generate Vet Report" button
3. System checks `Event.transcriptFilePath` for saved transcript
4. Reads transcript file from client folder
5. Prompts for vet clinic name (if `Client.primaryCareVet` not set)
6. Generates vet report using saved transcript
7. Saves vet report to client folder as DOCX

**Benefits**:
- **Privacy**: Transcripts stay local, not sent to cloud storage
- **Compliance**: Permanent record in client folder
- **Flexibility**: Generate different report types at different times
- **Efficiency**: No need to re-paste transcript for additional reports
- **Audit Trail**: File timestamp shows when consultation occurred

**Implementation Files**:
- [transcriptFileService.ts](src/lib/services/transcriptFileService.ts) - Complete file management
- [schema.prisma](prisma/schema.prisma) - Database schema with new fields
- [types.ts](src/lib/types.ts) - TypeScript interfaces

**Migration**:
- Migration: `20251121040644_add_transcript_vet_fields`
- Adds nullable fields (backwards compatible)
- Existing events unaffected

**Future UI Integration** (Phase 3C):
- Consultation creation form with transcript input
- File upload option (drag-and-drop .txt files)
- Questionnaire selection dropdown
- Multi-report generation checkboxes
- Progress indicators for parallel generation

---

## Extension Points

### Adding New Event Types

1. Add to EventType enum/constants:
   ```typescript
   // src/lib/constants.ts
   export const EVENT_TYPES = [
     "Booking",
     "Consultation",
     "TrainingSession",
     "Payment",
     "FollowUp",
     "Note", // For tracking client creation and other notes
     "Assessment", // NEW - Example of adding a new type
   ] as const;
   ```

2. Add automation rule if needed:
   ```typescript
   // src/lib/automation/rules.ts
   {
     trigger: 'event.created',
     condition: (event) => event.eventType === 'Assessment',
     actions: [
       {
         type: 'create.task',
         payload: {
           description: 'Prepare assessment materials',
           dueDate: /* event.date minus 3 days */,
           priority: 2,
           // ...
         }
       }
     ]
   }
   ```

3. Update UI dropdown in Event forms

---

### Adding New Automated Actions

1. Define action in automation engine:
   ```typescript
   // src/lib/automation/actions.ts
   export const actions = {
     CheckQuestionnaireReturned: async (task: Task) => {
       // Implementation
     },
     SendReminderEmail: async (task: Task) => {
       // Implementation (requires email integration)
     },
     // NEW ACTION
     GenerateInvoice: async (event: Event) => {
       // Implementation
     }
   };
   ```

2. Add trigger condition and rule as shown above

---

### Adding Integrations (Optional)

**Calendly Integration** (REPLACED by custom Next.js calendar):
- Store: calendlyEventUri, calendlyStatus
- Sync: Poll for status updates or use webhooks
- Togglable in settings

**Stripe Integration**:
- Store: invoiceFilePath, hostedInvoiceUrl
- Actions: Open invoice URL, download invoice
- Togglable in settings

**Email Integration** (future):
- Would require SMTP configuration
- Actions: Send protocol, send reminder, send invoice
- Togglable in settings

---

## Website Booking Integration

### Overview

PBS Admin integrates with the Pet Behaviour Services website (petbehaviourservices.com.au) to automatically import bookings made through the online booking wizard. This integration uses **Supabase** as the shared database between the Next.js website and the Tauri desktop app.

### Architecture

```
┌─────────────────────────┐
│  Website Booking Wizard │ (Next.js)
│  petbehaviourservices   │
└───────────┬─────────────┘
            │
            │ (Creates booking record)
            ▼
   ┌────────────────────┐
   │  Supabase Database │ (PostgreSQL)
   │  bookings table    │
   └────────┬───────────┘
            │
            │ (Polls for new bookings)
            ▼
    ┌──────────────────┐
    │   PBS Admin App  │ (Tauri Desktop)
    │   bookingSync    │
    └──────────────────┘
            │
            │ (Creates local records)
            ▼
    ┌──────────────────┐
    │  Local SQLite DB │
    │  Client/Pet/Event│
    └──────────────────┘
```

### Data Flow

1. **Customer books consultation** via website booking wizard
2. **Website creates booking** in Supabase `bookings` table (status: 'confirmed')
3. **PBS Admin polls** Supabase for unsynced bookings
4. **Booking sync service** processes each booking:
   - Matches existing client by email (primary) or mobile (fallback)
   - Creates new Client if not found, updates if found
   - Creates Pet record (or matches existing pet by name)
   - Creates "Note" Event (for new clients only) - "Client created via website booking"
   - Creates "Booking" Event with all consultation details
   - **Downloads referral file** (if uploaded) to client folder
5. **Marks booking as synced** in Supabase (sets `synced_to_admin: true`)
6. **When consultation complete**: Updates booking status to 'completed' in Supabase

### Client Matching Logic

**Matching Priority**:
1. **Email** (primary, case-insensitive)
2. **Mobile** (fallback, normalized to digits only)

**New vs Existing**:
- If match found → Update existing client with new information (email, mobile, postcode, Stripe ID)
- If no match → Create new client with booking data

### Booking Data Mapping

**Supabase Booking → PBS Admin Entities**:

#### Client Record
```typescript
{
  firstName: customerName.split(' ')[0],
  lastName: customerName.split(' ').slice(1).join(' '),
  email: customerEmail,
  mobile: customerPhone,
  postcode: customerPostcode,
  stripeCustomerId: stripeCustomerId,
  notes: "Imported from website booking PBS-XXX\n{problemDescription}"
}
```

#### Pet Record
```typescript
{
  clientId: clientId,
  name: petName,
  species: petSpecies,
  breed: petBreed,
  notes: problemDescription
}
```

#### "Note" Event (New Clients Only)
```typescript
{
  clientId: clientId,
  eventType: 'Note',
  date: bookingDate, // When booking was made
  notes: '<p>Client created via website booking</p>'
}
```

#### "Booking" Event
```typescript
{
  clientId: clientId,
  eventType: 'Booking',
  date: consultationDate + 'T' + consultationTime, // ISO 8601
  notes: `
    <h2>Website Booking Details</h2>
    <p><strong>Booking Reference:</strong> PBS-XXX</p>
    <p><strong>Service:</strong> VBC/BAAC (Zoom/Home Visit)</p>
    <p><strong>Pet:</strong> {petName} ({petSpecies})</p>

    Zoom Link: {zoomLink} (if applicable)

    <h3>Pricing</h3>
    Base: $280.00
    Travel: ${travelCharge} (if home visit)
    Total: ${totalPrice}

    <h3>Referral</h3>
    Status: Uploaded / Pending / N/A

    <h3>Problem Description</h3>
    {problemDescription}

    Stripe Session: {stripeSessionId}
  `
}
```

### UI Component

**Location**: Dashboard → Website Bookings card (top of right pane)

**Features**:
- **Real-time badge**: Shows count of unsynced bookings
- **Refresh button**: Manually poll Supabase for new bookings
- **Import button**: Imports all unsynced bookings with one click
- **Booking table**: Displays customer, pet, service, appointment details
- **Sync results**: Shows success/failure for each import with "New Client" badge
- **Status indicators**: Payment status, referral pending alerts

**User Workflow**:
1. User opens PBS Admin
2. Dashboard automatically loads unsynced bookings from Supabase
3. User reviews bookings in the table
4. User clicks "Import X Bookings" button
5. System processes each booking and shows results
6. Imported bookings marked as synced (won't appear again)
7. User can navigate to newly created client records

### Service Layer

**File**: `src/lib/services/bookingSyncService.ts`

**Key Functions**:

- `fetchUnsyncedBookings()` - Queries Supabase for confirmed, unsynced bookings
- `findExistingClient(email, mobile)` - Matches clients by email or mobile
- `findExistingPet(clientId, petName)` - Matches pets by name within client
- `importWebsiteBooking(booking)` - Processes single booking, creates all records
- `syncAllWebsiteBookings()` - Batch imports all unsynced bookings
- `markBookingAsSynced(bookingId)` - Updates Supabase to prevent re-import

### Supabase Configuration

**Environment Variables** (`.env`):
```bash
VITE_SUPABASE_URL=https://qltdzszkjoiyulscyupe.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Database Table**: `bookings` (PostgreSQL)

**Key Columns**:
- `id` (UUID, primary key)
- `booking_reference` (VARCHAR) - Short PBS-XXX format
- `customer_name`, `customer_email`, `customer_phone`
- `pet_name`, `pet_species`, `pet_breed`
- `service_type` ('VBC' | 'BAAC')
- `service_delivery` ('Zoom' | 'Home Visit')
- `consultation_date` (DATE), `consultation_time` (TIME)
- `base_price`, `travel_charge`, `total_price` (DECIMAL)
- `payment_status`, `status`
- `stripe_session_id`, `stripe_customer_id`
- `referral_required`, `referral_file_path`, `referral_file_name`
- `problem_description`, `notes`
- `synced_to_admin` (BOOLEAN, nullable) - Tracks if imported to PBS Admin
- `created_at`, `updated_at`

### Error Handling

**Resilient Design**:
- If `synced_to_admin` column doesn't exist → Fetches all confirmed bookings
- If client matching fails → Creates new client
- If pet matching fails → Creates new pet
- If sync fails → Logs error, continues with next booking
- If Supabase unreachable → Shows empty state, allows manual retry

**Sync Results Display**:
- ✅ Success: "Imported Sarah Johnson (Max)" + "New Client" badge
- ❌ Failure: "Failed: Sarah Johnson - {error message}"

### Referral File Download

When importing a booking that has a referral file uploaded, PBS Admin automatically:
1. Creates a signed URL from Supabase Storage (valid 1 hour)
2. Downloads the referral file to the client folder
3. Names it: `referral_{booking_reference}_{YYYYMMDD}.{ext}`
4. Reports success/failure in the import result

**Requirements**:
- Client must have a folder path set
- Booking must have `referral_file_path` populated

### Bidirectional Status Sync

When a consultation report is sent to the client, PBS Admin updates the booking status in Supabase:

1. **Automatic trigger**: When report is emailed via ReportSentEventPanel
2. **Flow**:
   - Extracts booking reference from the Booking event notes
   - Finds the booking in Supabase by reference
   - Updates status to 'completed'
   - Shows toast notification on success

**Functions**:
- `updateBookingStatus(bookingId, status)` - Direct status update
- `markConsultationComplete(clientId, consultationDate)` - High-level function called after report sent
- `findBookingByReference(reference)` - Lookup booking by PBS-XXX reference

### Future Enhancements

**Potential Improvements**:
1. **Realtime Sync**: Use Supabase Realtime subscriptions for instant notifications
2. **Auto-sync on Startup**: Automatically sync when app launches
3. **Background Polling**: Check for new bookings every N minutes
4. **Duplicate Detection**: Warn if booking might be duplicate (same client + date + time)
5. **Conflict Resolution**: UI for handling sync conflicts (e.g., different pet details)
6. ~~**Bidirectional Sync**: Update website booking status from PBS Admin~~ ✅ Implemented
7. **Sync History**: Log all sync operations with timestamps
8. **Selective Import**: Allow user to choose which bookings to import

---

## Jotform Questionnaire Integration

### Overview

PBS Admin integrates with Jotform to automatically download submitted questionnaires (both Dog and Cat behaviour questionnaires) and save them to client folders. This integration uses the **Jotform API** to poll for new submissions and downloads both JSON data and PDF files.

### Architecture

```
┌─────────────────────────┐
│  Client Fills Form      │ (Jotform)
│  Dog/Cat Questionnaire  │
└───────────┬─────────────┘
            │
            │ (Submits form)
            ▼
   ┌────────────────────┐
   │  Jotform API       │
   │  Submissions       │
   └────────┬───────────┘
            │
            │ (Polls for new submissions)
            ▼
    ┌──────────────────┐
    │   PBS Admin App  │ (Tauri Desktop)
    │   jotformService │
    └──────────────────┘
            │
            │ (Downloads JSON + PDF)
            ▼
    ┌──────────────────┐
    │  Client Folder   │
    │  JSON + PDF files│
    └──────────────────┘
```

### Data Flow

1. **Client fills questionnaire** via Jotform link (sent after booking)
2. **Jotform stores submission** in their database
3. **PBS Admin polls** Jotform API for submissions from last 30 days
4. **Questionnaire sync service** processes each submission:
   - Matches existing client by email (primary) or mobile (fallback)
   - Validates client has folder created
   - Downloads JSON data (full submission)
   - Downloads PDF (formatted questionnaire)
   - Saves files to client folder with timestamped filenames
   - Creates "Questionnaire Received" event
5. **Submissions tracked** locally to prevent re-downloading (✅ localStorage tracking)

### Client Matching Logic

**Matching Priority**:
1. **Email** (primary, case-insensitive) - QID 6
2. **Mobile** (fallback, normalized to digits only) - QID 32

**Requirements**:
- Client must exist in database (won't create new clients)
- Client must have folder path set (won't process if no folder)
- If no match found → Skips submission with error message

### Form Field Mapping

**Both Dog and Cat forms use the same Question IDs (QIDs)**:

| QID | Field Name | Type | Usage |
|-----|-----------|------|-------|
| 3 | Your Name | Full Name | Client first/last name |
| 6 | Email | Email | Client matching (primary) |
| 32 | Phone Number | Text | Client matching (fallback) |
| 8 | Pet Name | Text | Pet identification |
| 19 | Breed | Text | Pet details |
| 23 | Age | Text | Pet age |
| 22 | Sex | Dropdown | Pet sex (4 options) |
| 68 | Address | Address | Client address |
| 69 | Weight | Text | Pet weight |

### File Downloads

**JSON File**:
- Filename: `questionnaire_{submissionId}_{timestamp}.json`
- Contains: Full submission data (all answers, client info, pet info)
- Location: Client folder

**PDF File**:
- Filename: `questionnaire_{submissionId}_{timestamp}.pdf`
- Contains: Formatted questionnaire (Jotform PDF export)
- Downloaded from: `https://api.jotform.com/generatePDF?formid={form_id}&submissionid={id}&apiKey={key}&download=1`
- Location: Client folder

**Tauri Commands Used**:
- `write_text_file(filePath, content)` - Saves JSON
- `download_file(url, filePath)` - Downloads PDF from URL (bypasses CORS)

**CORS Solution**:
PDF downloads use a Rust backend command instead of browser fetch to bypass CORS restrictions:
- Browser fetch to Jotform API was blocked by CORS policy
- Solution: `download_file` Tauri command runs in Rust backend (not subject to browser CORS)
- Backend uses `reqwest` HTTP client to download files
- This allows PDF downloads without CORS errors

### Tracking Processed Submissions

**Implementation**: localStorage-based tracking to prevent duplicate downloads

**Storage Key**: `pbs_admin_processed_jotform_submissions`

**How It Works**:
1. After successful processing, submission ID saved to localStorage array
2. On refresh/poll, `fetchUnprocessedSubmissions()` filters out tracked IDs
3. Only unprocessed submissions appear in dashboard list
4. Failed downloads NOT tracked (allows retry)
5. Tracking persists across app sessions

**Functions**:
- `getProcessedSubmissionIds()` - Reads Set of submission IDs from localStorage
- `markSubmissionAsProcessed(submissionId)` - Adds ID to localStorage after success
- Automatic filtering in `fetchUnprocessedSubmissions()`

### Event Creation

Creates "Questionnaire Received" event (type: Note):

```html
<h2>Questionnaire Received</h2>
<p><strong>Submission ID:</strong> {submissionId}</p>
<p><strong>Form Type:</strong> Dog/Cat Behaviour Questionnaire</p>
<p><strong>Pet:</strong> {petName} ({species})</p>
<p><strong>Breed:</strong> {breed}</p>
<p><strong>Age:</strong> {age}</p>
<p><strong>Sex:</strong> {sex}</p>
<p><strong>Weight:</strong> {weight}</p>
<p><em>Files saved to client folder:</em></p>
<ul>
  <li>✓/✗ JSON data</li>
  <li>✓/✗ PDF questionnaire</li>
</ul>
```

### UI Component

**Location**: Dashboard → Questionnaires card

**Features**:
- **Real-time badge**: Shows count of unprocessed submissions
- **Refresh button**: Manually poll Jotform for new submissions
- **Process button**: Processes all submissions with one click
- **Submissions table**: Displays client, pet, form type, email, submitted date
- **Sync results**: Shows success/failure for each download with file status
- **Form type indicators**: Dog (blue badge) or Cat (orange badge)

**User Workflow**:
1. User opens PBS Admin
2. Dashboard shows "X new" questionnaires badge
3. User reviews submissions in table
4. User clicks "Process X Submissions" button
5. System downloads files and creates events
6. Results show which files were downloaded (JSON, PDF)
7. User can navigate to client folder to view files

### Service Layer

**File**: `src/lib/services/jotformService.ts`

**Key Functions**:

- `fetchUnprocessedSubmissions()` - Polls Jotform API for both forms (last 30 days)
- `parseSubmission(submission)` - Extracts client/pet data from QID-based answers
- `findExistingClient(email, mobile)` - Matches clients by email or mobile
- `downloadSubmissionFiles()` - Downloads JSON + PDF to client folder
- `processQuestionnaire(submission)` - Processes single submission, creates event
- `syncAllQuestionnaires()` - Batch processes all submissions

### Jotform Configuration

**Environment Variables** (`.env`):
```bash
# Jotform (for questionnaire sync)
VITE_JOTFORM_API_KEY=your_jotform_api_key
VITE_JOTFORM_DOG_FORM_ID=212500923595050
VITE_JOTFORM_CAT_FORM_ID=241828180919868
```

**API Endpoints Used**:
- `GET /form/{formId}/submissions` - Fetch submissions
- `GET /form/{formId}/questions` - Get form structure
- `GET /submission/{submissionId}/pdf` - Download PDF

### Error Handling

**Resilient Design**:
- If client not found → Skips with "Client not found" error
- If client has no folder → Skips with "Client folder not created" error
- If JSON download fails → Continues with PDF download
- If PDF download fails → Continues with next submission
- If Jotform unreachable → Shows empty state, allows manual retry

**Sync Results Display**:
- ✅ Success: "Processed Sarah Johnson (Max)" + file icons (JSON/PDF)
- ❌ Failure: "Failed: Sarah Johnson - {error message}"

### Future Enhancements

**Potential Improvements**:
1. ✅ **Track Processed Submissions**: Implemented with localStorage tracking (prevents duplicate downloads)
2. **Auto-Update Client/Pet Records**: Use questionnaire data to enrich client (address) and pet (breed, age, weight) records
3. **Auto-Poll on Startup**: Automatically sync when app launches
4. **Background Polling**: Check for new submissions every N minutes
5. **Notification**: Alert when new questionnaire available
6. **Submission History**: View all past questionnaire submissions per client
7. **Re-download**: Allow manual re-download of specific submissions
8. **Form Version Tracking**: Handle different questionnaire versions over time

---

## Data Import and Migration

### Legacy Data Import Tool

**Purpose**: Import data from previous software with same four-table structure.

**Process**:
1. **Parse Source**:
   - SQLite database or CSV files
   - Validate format and required columns

2. **Map and Validate**:
   - Map legacy IDs to new IDs (preserve if possible)
   - Validate dates (convert to ISO 8601)
   - Validate foreign keys
   - Flag orphaned records

3. **Import**:
   - Use transactions for atomicity
   - Import in order: Clients → Pets, Events, Tasks
   - Maintain ID mapping table

4. **Generate Report**:
   - Counts: imported, skipped, errors
   - List of orphaned/broken records
   - ID mapping cross-reference
   - Save report as JSON/CSV

**Implementation Location**: `src-tauri/src/import/` or `src/lib/import/`

**UI**: Modal with file picker, progress bar, report display

---

## Backup and Restore

### Overview

PBS Admin provides automatic scheduled backups with configurable frequency and retention policies.

**Features**:
- **Scheduled Backups**: Daily, weekly, or manual-only
- **Retention Policy**: Automatically delete old backups (configurable: 3-30 backups)
- **Manual Backup**: Create backup on demand
- **Restore**: Restore database from any backup file
- **Backup Manager UI**: Settings menu → Backup & Restore

### Backup Strategy

**Format**: SQLite database file copy with timestamp

**Location**: `Documents/PBS_Admin/Backups/`

**Naming**: `pbs-admin-backup-YYYY-MM-DD-HHmmss.db`

**Scheduled Backup Logic**:
- Checks every hour if backup is due
- Creates backup if last backup exceeds frequency threshold
- Applies retention policy after each backup
- Settings stored in localStorage

### Backup Settings

```typescript
interface BackupSettings {
  enabled: boolean;           // Enable/disable automatic backups
  frequency: 'daily' | 'weekly' | 'manual';
  retentionCount: number;     // Number of backups to keep (3-30)
  lastBackupDate: string | null;
}
```

**Storage Key**: `pbs_admin_backup_settings`

### Tauri Backend Commands

```rust
// Get backups folder path
get_backups_path() -> Result<String, String>

// Create backup with timestamp
create_database_backup() -> Result<serde_json::Value, String>

// Restore from backup file
restore_database_backup(backup_path: String) -> Result<String, String>

// List all backup files
list_database_backups() -> Result<Vec<serde_json::Value>, String>

// Delete a backup file
delete_backup_file(backup_path: String) -> Result<String, String>
```

### Backup Service Functions

```typescript
// Settings management
getBackupSettings(): BackupSettings
saveBackupSettings(settings: Partial<BackupSettings>): void

// Backup operations
createBackupWithTracking(): Promise<BackupResult>
restoreBackup(backupPath: string): Promise<RestoreResult>
listBackups(): Promise<BackupInfo[]>
deleteBackup(backupPath: string): Promise<boolean>

// Scheduled backups
startScheduledBackups(): void  // Called on app start
stopScheduledBackups(): void   // Called on app close
restartScheduledBackups(): void // Called after settings change
```

### Restore Strategy

**Process**:
1. User selects backup file from list
2. Confirmation dialog warns about overwriting data
3. Safety backup created before restore
4. Database file replaced with backup
5. User prompted to restart application

**Safety Features**:
- Pre-restore safety backup created
- Original database preserved if restore fails
- Requires app restart for changes to take effect

### Implementation Files

- [backupService.ts](src/lib/services/backupService.ts) - Backup operations and scheduling
- [BackupManager.tsx](src/components/BackupManager/BackupManager.tsx) - UI component
- [lib.rs](src-tauri/src/lib.rs) - Tauri backend commands (lines 740-880)

---

## Startup + Background Mode

### Overview

PBS Admin supports running in the background with a system tray icon and optional auto-start at Windows login.

**Features**:
- **System Tray Icon**: App minimizes to system tray instead of closing
- **Tray Menu**: Right-click for Show/Hide/Quit options
- **Auto-Start**: Optional launch at Windows login
- **Minimized Start**: When auto-started, app starts minimized to tray
- **Settings UI**: Configure via Settings menu → Startup Settings

### System Tray

**Tray Icon**: Located in Windows system tray (notification area)

**Menu Options**:
- **Show PBS Admin**: Bring window to foreground
- **Hide to Tray**: Minimize window to tray
- **Quit**: Exit application completely

**Behavior**:
- Double-click tray icon: Show window
- Close window (X button): Minimize to tray instead of quit
- Window stays hidden until user clicks Show or double-clicks icon

### Auto-Start Configuration

**Windows Registry Integration**: Uses `tauri-plugin-autostart` to manage Windows startup entries

**Startup Args**: When auto-started, launches with `--minimized` flag to start hidden

**Tauri Plugin**:
```rust
.plugin(tauri_plugin_autostart::init(
    MacosLauncher::LaunchAgent,
    Some(vec!["--minimized"])
))
```

### Auto-Start Service

**File**: `src/lib/services/autostartService.ts`

```typescript
// Check if auto-start is enabled
isAutoStartEnabled(): Promise<boolean>

// Enable auto-start at Windows login
enableAutoStart(): Promise<{ success: boolean; error?: string }>

// Disable auto-start
disableAutoStart(): Promise<{ success: boolean; error?: string }>

// Toggle auto-start state
toggleAutoStart(enable: boolean): Promise<{ success: boolean; error?: string }>

// Minimize to tray preference (localStorage)
getMinimizeToTray(): boolean
setMinimizeToTray(enabled: boolean): void
```

### Tauri Backend Setup

**File**: `src-tauri/src/lib.rs`

**System Tray Setup**:
```rust
.setup(|app| {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show PBS Admin", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide to Tray", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("PBS Admin")
        .on_menu_event(...)
        .on_tray_icon_event(...)
        .build(app)?;

    // Check for --minimized flag
    if args.contains(&"--minimized".to_string()) {
        window.hide();
    }
    Ok(())
})
```

**Window Close Handler**:
```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        window.hide();
        api.prevent_close();
    }
})
```

### Capabilities Permissions

**File**: `src-tauri/capabilities/default.json`

Required permissions:
```json
"autostart:default",
"autostart:allow-enable",
"autostart:allow-disable",
"autostart:allow-is-enabled"
```

### Settings UI

**Component**: `src/components/Settings/StartupSettingsDialog.tsx`

**Access**: Settings menu → Startup Settings

**Options**:
- **Start at Windows login**: Toggle auto-start on/off
- **Minimize to system tray**: Toggle close-to-tray behavior

### Implementation Files

- [autostartService.ts](src/lib/services/autostartService.ts) - Auto-start and tray preferences
- [StartupSettingsDialog.tsx](src/components/Settings/StartupSettingsDialog.tsx) - Settings UI
- [lib.rs](src-tauri/src/lib.rs) - System tray setup (lines 1215-1290)
- [Cargo.toml](src-tauri/Cargo.toml) - `tauri-plugin-autostart` dependency
- [default.json](src-tauri/capabilities/default.json) - Autostart permissions

---

## Privacy and Security

### Local-First Architecture

- **No cloud storage** by default
- **No telemetry** or analytics
- **No third-party API calls** unless explicitly enabled

### Data Protection

- All data stored locally in SQLite
- Sensitive fields (notes, addresses) stay on device
- Logs should redact PII

### Optional Integrations

- Calendly: Opt-in, togglable in settings
- Stripe: Opt-in, togglable in settings
- Email: Future, opt-in if implemented

### Backup Security

- User responsible for backup file security
- No cloud sync (user can use OneDrive/Dropbox manually)
- Consider adding backup encryption (future)

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (frontend + Tauri)
npm run tauri dev

# Build for production
npm run tauri build

# Database operations
npx prisma migrate dev      # Create new migration
npx prisma migrate reset    # Reset database
npx prisma studio           # GUI database browser
npm run db:seed             # Seed sample data

# Generate Prisma Client
npx prisma generate
```

---

## Testing Strategy

### Manual Testing (Primary)

- Documented test plan in `docs/TEST_PLAN.md`
- Test scenarios for all workflows
- Regression checklist before releases

### Unit Tests (Critical Logic)

- Rules engine automation
- Date utilities (timezone conversions)
- Validation functions
- Service layer business logic

**Framework**: Vitest (fast, Vite-native)

```bash
npm test
npm test -- --watch
```

### Integration Tests (Database)

- Service layer with actual SQLite database
- CRUD operations
- Foreign key constraints
- Transaction rollbacks

---

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| App start (cold) | < 3s | Lazy loading, optimized bundle |
| Client list (10k rows) | < 1s render | Virtual scrolling, indexed queries |
| Search/filter | < 500ms | Debounced input, indexed columns |
| CRUD operation | < 200ms perceived | Optimistic UI updates |

---

## Known Limitations and TODOs

### Current Status

✅ **Complete - MVP Ready**:
- Project setup (Tauri + React + TypeScript)
- Database schema with all entities (Client, Pet, Event, Task)
- Migrations and seed data
- ADR documentation
- CLAUDE.md (this file)
- Database connection using Tauri SQL plugin
- **Complete service layer** for all entities with timestamp handling
  - clientService.ts - Full CRUD operations
  - petService.ts - Full CRUD operations
  - eventService.ts - Full CRUD operations
  - taskService.ts - Full CRUD operations with status tracking
- **Client Management** - Complete CRUD with two-pane layout
  - ClientForm with validation and required field checking
  - ClientView screen with integrated pet/event/task tables
  - Change tracking with auto-disable Save button
  - Save confirmation with "Saved!" feedback
  - Australian state dropdown with Victoria as default
  - Mobile phone auto-formatting (xxxx xxx xxx format)
- **Folder Management** - Client records organization
  - Create client folder on save (Documents/PBS_Admin/Client_Records)
  - Folder naming: surname_clientId (e.g., "smith_24")
  - FolderCreationDialog with custom path option
  - FolderSuccessDialog with "Open Folder" action
  - Dynamic button: "Create Folder" → "Open Folder" based on state
  - Tauri opener plugin integration with proper permissions
- **Pet Management** - Complete CRUD integrated into ClientView
  - PetForm with species, breed, sex (5 options including castrated/spayed), DOB
  - Age calculator: Parses age strings like "2 years", "18 months", "12 weeks" into approximate DOB
  - Supports various formats: word numbers, fractions, abbreviated units
  - Auto-populates Date of Birth field from age input
  - PetsTable with inline add/edit/delete
  - Displays current age instead of DOB (dynamically calculated)
- **Event Management** - Complete CRUD with automation hooks
  - EventForm with event type, date/time, rich text notes
  - Rich text editor (Tiptap) with formatting toolbar:
    - Text formatting: Bold, Italic, Underline
    - Headings: H2, H3
    - Lists: Bullet lists, Numbered lists
    - Text alignment: Left, Center, Right
  - EventsTable with inline add/edit/delete
  - HTML notes stripped to plain text in table display
  - Integrated with automation engine
  - "Note" event type for client creation tracking
- **Task Management** - Complete CRUD with priority/status tracking
  - TaskForm with description, due date, priority (1-5), status, triggered by
  - Task Templates: 5 predefined templates for quick task creation
    - General Task, Questionnaire Return Follow-up, Protocol Send, Follow-up Call, Training Session Prep
    - Auto-populates all fields based on template selection
  - TasksTable with overdue alerts, priority colors, quick "Mark Done" action
  - Dashboard task management: Click to view/edit/delete tasks
    - Task detail dialog with client name display
    - "Send Reminder" button for questionnaire tasks with email integration
    - Safe spacing between close button and delete button
  - In-app notifications for due/overdue tasks
    - Toast notifications: error (overdue), warning (due today), info (due tomorrow)
    - 5-minute polling interval with 30-second initial delay
    - Notification bell with badge count in Dashboard header
    - Deduplication to prevent repeat notifications
- **Email Template System** - Comprehensive template management and email integration
  - 5 default templates: Dog/Cat questionnaire reminders, protocol send, follow-up, general
  - Email Template Manager: Full CRUD for templates
    - Create, edit, duplicate, delete, and reset templates
    - Two-pane layout with search and filtering
    - Preview tab shows processed template
    - Variables tab shows available template variables
    - Accessible via Settings menu in Dashboard
  - Email Draft Dialog: Preview and edit before sending
    - Editable To, Subject, and Body fields
    - Copy to clipboard for Gmail/web-based clients
    - Open in email app for desktop clients (Outlook, Mail)
    - Character count and edit tracking
  - Variable substitution system with {{variableName}} syntax
  - localStorage persistence for custom templates
  - Template merging: Custom templates override defaults by ID
  - Reset to default functionality for customized templates
- **Automation Rules Engine** - Fully functional with 4 active workflows
  - Rule 1: Booking → Questionnaire Check Task (48 hours before)
  - Rule 2: Consultation Complete → Protocol Send Task
  - Rule 3: Training Session → Preparation Task (2 days before)
  - Rule 4: Client Created → Note Event (automatic tracking)
  - Extensible architecture for adding new rules
- **UI Components** - Complete shadcn/ui component library
  - Button, Input, Card, Table, Badge, Dialog, Select, Textarea, Label
  - RichTextEditor (Tiptap-based) with formatting toolbar
  - EmailInput with context menu (Paste, Copy, Copy email address, Create email)
  - AddressInput with context menu (Paste, Copy, Copy full address, Open in Google Maps)
  - EmailDraftDialog for email preview and editing
  - ContextMenu (Radix UI) - Right-click context menus on form fields
  - Tabs, DropdownMenu (Radix UI)
  - Toggle, Separator (Radix UI)
- **UI Design and Consistency** - Compact, data-dense interface
  - Dashboard-style font sizes throughout (11px/text-[11px] for content, 10px for labels)
  - Reduced table row heights (h-10) and padding (py-1.5)
  - Compact form controls (h-7 inputs, h-7 buttons)
  - Client forms fully compacted: text-[11px] inputs, text-[10px] labels, minimal spacing
  - Consistent spacing (space-y-1.5, gap-2)
  - Rich text editor styled at 11px to match tables
  - Badge text at 10px for compact status indicators
  - Maximizes information density while maintaining readability
- **Date Handling** - Australia/Melbourne timezone throughout
- **Form validation** with real-time feedback
- **Phone number utilities** - Formatting and validation for Australian mobiles
- **Age utilities** - Parse age strings and calculate current age
  - Supports: "2 years", "18 months", "12 weeks", "one and a half years", etc.
  - Automatic DOB calculation from questionnaire responses
  - Dynamic age display (updates as pet gets older)
- Desktop shortcut for quick launch
- **Website Booking Integration** - Sync bookings from petbehaviourservices.com.au
  - Supabase client integration
  - Booking sync service with client/pet matching logic
  - Auto-create Client, Pet, Note event (new clients), and Booking event
  - UI component in Dashboard with import button and sync status
  - Email/mobile matching with existing clients
  - Resilient error handling
- **Jotform Questionnaire Sync** - Automatic questionnaire downloads
  - Jotform API integration for Dog and Cat forms
  - QID-based field extraction and parsing
  - Client matching by email/mobile
  - Download JSON (structured data) and PDF (formatted questionnaire)
  - Save files to client folder with timestamps
  - Create "Questionnaire Received" event with submission details
  - UI component in Dashboard with sync status and file indicators
  - Tauri file writing commands (write_text_file, write_binary_file)
  - localStorage tracking to prevent duplicate downloads

📋 **TODO - Future Enhancements**:
- ✅ Email integration for task reminders (Completed - Template system with draft preview)
- SMTP integration for automated email delivery (optional future enhancement)
- **Drug Compendium** (Settings → Medication Reference Table)
  - Editable table displaying all medications from database
  - User-editable fields (manual updates to medication information)
  - Web-updatable (integration with online pharmaceutical databases)
  - Table includes: Generic name, Brand names, Drug category, Dosing information, Indications, Contraindications, Side effects, Australian scheduling (S3/S4/S8)
  - Export/import functionality for backup
  - Version control for medication database changes
  - Could leverage existing medicationUpdateService.ts and monthly update checker infrastructure
  - Consider using DataTable component with inline editing
- System tray background service for persistent notifications
- Legacy data import tool
- Backup/restore functionality
- UX enhancements (keyboard shortcuts, persistence, search)
- README with setup instructions
- Test Plan documentation
- Extension Guide documentation

### Known Limitations

1. **Single-user only** - No concurrent access support
2. **Windows 11 only** - Not tested on other platforms
3. **No cloud sync** - Intentional, may be requested later
4. **Manual testing emphasis** - No comprehensive E2E test suite

### Future Enhancements

1. Optional cloud backup to secure storage
2. Mobile companion app (read-only view)
3. Advanced reporting and analytics
4. Email integration for automated communications
5. Calendar sync beyond Calendly (custom Next.js calendar integration)
6. Batch operations (bulk client import, bulk task creation)
7. Custom report templates
8. Export to PDF/Excel
9. **Video Behavior Analysis Tool** - Extract frames from client-submitted videos (.mov, .mp4) using ffmpeg, send to Claude API for AI-powered behavior analysis (body language, triggers, context). Would integrate into consultation workflow for analyzing behavior videos.

---

## Common Development Tasks

### Adding a New Field to Client Entity

1. Update Prisma schema:
   ```prisma
   model Client {
     // ...
     newField String?
   }
   ```

2. Create migration:
   ```bash
   npx prisma migrate dev --name add_new_field_to_client
   ```

3. Update TypeScript types (auto-generated by Prisma)

4. Update Client form UI in [src/components/Client/ClientForm.tsx](src/components/Client/ClientForm.tsx)

5. Update seed script if needed

---

### Adding a New Automation Rule

1. Define rule in [src/lib/automation/rules.ts](src/lib/automation/rules.ts):
   ```typescript
   {
     trigger: 'event.created',
     condition: (event) => event.eventType === 'NewType',
     actions: [
       {
         type: 'create.task',
         payload: { /* ... */ }
       }
     ]
   }
   ```

2. Register action handler in [src/lib/automation/actions.ts](src/lib/automation/actions.ts)

3. Test with seed data and manual UI testing

---

### Debugging Database Issues

```bash
# Open Prisma Studio to inspect database
npx prisma studio

# Reset database and re-seed
npx prisma migrate reset

# Check migration status
npx prisma migrate status

# View raw SQL
cat prisma/migrations/<timestamp>_<name>/migration.sql
```

---

## Resources

- **Tauri Docs**: https://v2.tauri.app
- **Prisma Docs**: https://www.prisma.io/docs
- **Shadcn/ui**: https://ui.shadcn.com
- **TanStack Query**: https://tanstack.com/query
- **date-fns**: https://date-fns.org
- **date-fns-tz**: https://github.com/marnusw/date-fns-tz

---

## Contact and Support

This is an internal tool for Pet Behaviour Services.

For technical questions or issues, refer to:
- [ADR.md](ADR.md) for architectural decisions
- [README.md](README.md) for setup instructions
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) for testing procedures
- [docs/EXTENSION_GUIDE.md](docs/EXTENSION_GUIDE.md) for customization

---

**Last Updated**: 2025-11-21
**Version**: 2.0.0 (Advanced AI Integration - Multi-Report Generation System with AI Prompt Template Manager, 3-report parallel generation (Comprehensive Clinical, Abridged Notes, Veterinary Report), transcript file management for on-demand generation, and ReportSent event type)
