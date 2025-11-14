# PBS Admin - Claude Code Context

**Pet Behaviour Services Administration System**

A Windows 11 desktop application for managing clients, pets, events, tasks, and automations for a pet behaviour services business.

---

## Project Overview

**Purpose**: Local, privacy-preserving record-keeping and client management system that streamlines day-to-day operations, automates repetitive tasks, and provides at-a-glance visibility into upcoming bookings and tasks.

**Status**: ✅ MVP Complete + Email Template System - Full CRUD operations for Clients, Pets, Events, and Tasks. Automation rules engine implemented and working. Application is production-ready with five active automation workflows. Task templates for quick creation, in-app notifications for due/overdue tasks, Dashboard task management with email reminder integration. Comprehensive email template system with in-app manager, draft preview, variable substitution, and support for both web-based (Gmail) and desktop email clients. Client folder management, rich text notes, age calculator, website booking integration, Jotform questionnaire sync with automatic file downloads, and compact, consistent UI with reduced font sizes throughout.

**Last Updated**: 2025-11-14

**Next Session**: Consider system tray background service for persistent notifications. Explore automated email delivery for reminders (SMTP integration).

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
| **External Services** | Supabase, Jotform API | Booking sync, questionnaire downloads |

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
│   │   ├── Task/           # ✅ TaskForm, TasksTable (priority/status tracking)
│   │   ├── EmailTemplateManager/  # ✅ Full email template management UI
│   │   │   └── EmailTemplateManager.tsx  # ✅ Create/edit/duplicate/delete templates
│   │   └── ui/             # ✅ shadcn/ui components (Button, Input, Dialog, Select, etc.)
│   │       ├── email-draft-dialog.tsx  # ✅ Email preview and editing dialog
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
│   │   │   └── notificationService.ts # ✅ Task notification queries
│   │   ├── types.ts        # ✅ TypeScript types for all entities
│   │   ├── taskTemplates.ts # ✅ Predefined task templates with preset values
│   │   ├── emailTemplates.ts # ✅ Email template definitions and management functions
│   │   ├── utils/          # ✅ Helpers (date, validation, phoneUtils)
│   │   ├── constants.ts    # ✅ Application constants
│   │   └── db.ts           # ✅ Database connection with Tauri SQL plugin
│   ├── hooks/
│   │   └── useTaskNotifications.ts  # ✅ Polling hook for task notifications
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
- `eventType` (required) - e.g., "Booking", "Consultation", "TrainingSession", "Payment", "FollowUp"
- `date` (required, ISO 8601 string)
- `notes` (optional, supports rich text/structured notes)
- `calendlyEventUri`, `calendlyStatus` (integration fields)
- `invoiceFilePath`, `hostedInvoiceUrl` (Stripe integration)
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

**Packages**:
- `@tiptap/react` - React integration
- `@tiptap/starter-kit` - Essential extensions
- `@tiptap/extension-underline` - Underline support
- `@tiptap/extension-text-align` - Text alignment
- `@tiptap/extension-placeholder` - Placeholder text

---

### Email Template System

**Purpose**: Customizable email templates for client communications with variable substitution and draft preview.

**Technology**: localStorage persistence + variable replacement system

**Features**:
- 5 default templates (Dog/Cat questionnaire reminders, protocol send, follow-up, general)
- Create, edit, duplicate, delete, and reset templates
- Variable substitution with {{variableName}} syntax
- Draft preview and editing before sending
- Support for both web-based (Gmail) and desktop email clients
- Template manager UI accessible via Settings menu

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
import { EmailDraftDialog } from "@/components/ui/email-draft-dialog";

<EmailDraftDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSend={(to, subject, body) => {
    // Open mailto: link for desktop clients
    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_blank');
  }}
  initialTo={client.email}
  initialSubject={processedSubject}
  initialBody={processedBody}
  clientName={client.firstName + ' ' + client.lastName}
/>
```

**Features**:
- Editable To, Subject, and Body fields
- Character count display
- Copy to clipboard for web-based email clients (Gmail)
- Open in email app for desktop clients (Outlook, Thunderbird, Mail)
- Edit tracking indicator

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

### 2. Consultation Event Workflow

**Trigger**: Event created with eventType === "Consultation"

**Steps**:
1. Allow structured note-taking during consultation
2. Optionally generate follow-up tasks:
   - "Email protocol document to client"
   - "Schedule training session"
   - "Invoice reminder"
3. Optionally spawn related events:
   - "TrainingSession scheduled" (with parentEventId)
   - "FollowUp scheduled" (with parentEventId)

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
5. **Marks booking as synced** in Supabase (sets `synced_to_admin: true`)

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

### Future Enhancements

**Potential Improvements**:
1. **Realtime Sync**: Use Supabase Realtime subscriptions for instant notifications
2. **Auto-sync on Startup**: Automatically sync when app launches
3. **Background Polling**: Check for new bookings every N minutes
4. **Duplicate Detection**: Warn if booking might be duplicate (same client + date + time)
5. **Conflict Resolution**: UI for handling sync conflicts (e.g., different pet details)
6. **Bidirectional Sync**: Update website booking status from PBS Admin (e.g., mark as completed)
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

### Backup Strategy

**Format**: SQLite database file copy with timestamp

**Location**: User-selected directory (default: Documents/PBS_Admin/Backups/)

**Naming**: `pbs-admin-backup-YYYY-MM-DD-HHmmss.db`

**Optional**: JSON export for human readability

**Implementation**:
```typescript
// src-tauri/src/backup.rs
async fn backup_database(destination: String) -> Result<String> {
  // Copy dev.db to destination
  // Return backup file path
}
```

**UI**: Settings screen with "Backup Now" button, auto-backup schedule

---

### Restore Strategy

**Process**:
1. User selects backup file
2. Validate backup file (check schema version)
3. Warn about overwriting current data
4. Close all database connections
5. Replace dev.db with backup file
6. Restart application

**Implementation**:
```typescript
// src-tauri/src/backup.rs
async fn restore_database(source: String) -> Result<()> {
  // Validate backup
  // Replace dev.db
  // Trigger app restart
}
```

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
  - EmailDraftDialog for email preview and editing
  - Tabs, DropdownMenu (Radix UI)
  - Toggle, Separator (Radix UI)
- **UI Design and Consistency** - Compact, data-dense interface
  - Dashboard-style font sizes throughout (11px/text-[11px] for table content)
  - Reduced table row heights (h-10) and padding (py-1.5)
  - Compact form controls (h-8 inputs, h-7 buttons)
  - Consistent spacing (space-y-2, gap-2)
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

**Last Updated**: 2025-11-14
**Version**: 1.6.0 (MVP Complete - Email Template System + Dashboard Task Management + Task Templates + In-app Notifications + All Previous Features)
