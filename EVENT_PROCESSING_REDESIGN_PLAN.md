# Event Processing Redesign - Implementation Plan

## Executive Summary

This plan outlines a comprehensive redesign of how Events and Tasks interact in PBS Admin. The goal is to consolidate all event-related processing (report generation, task creation, file management) into a unified event modal interface, with event-type-specific workflows.

**Current State:** Report generation and task import happen through separate dialogs triggered by icons in EventsTable.

**Desired State:** All processing happens within the Event modal, with event-specific panels that handle inputs, outputs, and task creation in a cohesive workflow.

**Priority:** Consultation events first, with architecture designed to support other event types (Booking, Training, FollowUp) in future phases.

---

## 1. Database Schema Changes

### Add Processing State Field to Event Model

**Migration:**
```prisma
model Event {
  // ... existing fields ...
  processingState String? // JSON string storing workflow state

  // Existing fields that will be used:
  // transcriptFilePath   String?
  // questionnaireFilePath String?
  // notes                String?  // Clinical notes (HTML)
}
```

**Processing State Structure:**
```typescript
interface EventProcessingState {
  status: 'draft' | 'in_progress' | 'completed';
  step: string; // Current step: 'selecting_files' | 'generating' | 'editing' | 'complete'

  // Input selections
  transcriptSource: 'file' | 'pasted' | null;
  transcriptPasted: string | null; // Temporary storage for pasted transcript
  questionnaireSelected: boolean;

  // Output selections
  selectedOutputs: ('clinicalNotes' | 'clientReport' | 'vetReport' | 'prescription')[];

  // Generated outputs tracking
  outputs: {
    clinicalNotes?: OutputState;
    clientReport?: OutputState;
    vetReport?: OutputState;
    prescription?: OutputState;
  };

  // Task creation
  tasksCreated: boolean;
  incompleteTaskId: number | null; // Task ID of "Complete this event" reminder task
}

interface OutputState {
  status: 'not_started' | 'generating' | 'generated' | 'saved';
  content?: string; // For clinical notes (HTML)
  filePath?: string; // For reports (MD/DOCX/PDF)
  fileName?: string;
  version?: number; // Version number (v1, v2, v3...)
  generatedAt?: string; // ISO timestamp
  error?: string;
}
```

**Benefits of This Approach:**
- Single source of truth for workflow state
- Flexible JSON structure can accommodate different event types
- Easy to extend without schema migrations
- Supports pause/resume naturally
- Tracks progress granularly

---

## 2. Component Architecture

### 2.1 Overview

```
EventsTable
    │
    ├─> EventFormModal (NEW - wraps EventForm)
    │       │
    │       ├─> LeftPanel: EventForm (existing, minor mods)
    │       │   - Event type dropdown
    │       │   - Date/time picker
    │       │   - Rich text notes
    │       │
    │       └─> RightPanel: EventSpecificPanel (conditional)
    │           │
    │           ├─> ConsultationEventPanel (Phase 1)
    │           ├─> BookingEventPanel (Future)
    │           ├─> TrainingSessionEventPanel (Future)
    │           └─> FollowUpEventPanel (Future)
```

### 2.2 New Components

**1. EventFormModal.tsx**
- Replaces the Dialog wrapper in EventsTable
- Two-column layout (standard fields left, event-specific panel right)
- Manages overall dialog state
- Conditionally renders event-specific panel based on eventType
- Handles save/complete/cancel actions

**2. ConsultationEventPanel.tsx**
- Right panel content for Consultation events
- File selection (transcript, questionnaire)
- Output selection checkboxes
- Generation workflow
- Output preview/edit
- Task creation options
- Progress indicators
- State management for processing workflow

**3. EventSpecificPanelProps.ts** (interface)
```typescript
interface EventSpecificPanelProps {
  clientId: number;
  event: Event | null; // null for new events
  clientFolderPath: string | undefined;
  onStateChange: (state: EventProcessingState) => void;
  onSaveEvent: (updates: Partial<EventInput>) => void;
  onComplete: () => void;
}
```

**4. Supporting Components (Consultation-specific)**
- `TranscriptInput.tsx` - File picker + paste area
- `QuestionnaireSelector.tsx` - Dropdown of available questionnaire files
- `OutputSelector.tsx` - Checkboxes for output types
- `OutputPreview.tsx` - Preview/edit generated content
- `TaskCreationOptions.tsx` - Checkboxes for tasks to create

### 2.3 Modified Components

**EventForm.tsx**
- Remove Dialog wrapper handling (moved to EventFormModal)
- Keep standard fields (type, date, notes)
- Add prop: `hideNotes?: boolean` (Consultation will hide this, use generated notes instead)
- Expose `formData` to parent for coordination

**EventsTable.tsx**
- Remove blue FileText icon (report generation)
- Remove green CheckSquare icon (task import)
- Keep pencil icon for edit (opens EventFormModal)
- Add badge for in-progress events
- Color code rows: amber/yellow background for status='in_progress'

---

## 3. Consultation Event Workflow

### 3.1 User Flow

**Step 1: Open/Create Consultation Event**
1. User clicks "Add Event" or edits existing Consultation
2. EventFormModal opens with two panels
3. Left: Standard fields (type=Consultation, date, notes hidden)
4. Right: ConsultationEventPanel

**Step 2: Input Selection**
- User selects or pastes transcript
  - **Option A**: Browse to select existing .txt file from client folder
  - **Option B**: Paste transcript text directly into text area
  - If pasted, auto-save to client folder when event saved
- User optionally selects questionnaire
  - Dropdown populated from client folder (*.json files)
  - Pre-selected if Event.questionnaireFilePath exists

**Step 3: Output Selection**
- Checkboxes (default checked):
  - ☑ Clinical Notes (HTML → Event.notes)
  - ☑ Client Report (MD → DOCX → PDF → client folder)
- Checkboxes (unchecked by default):
  - ☐ Vet Report (MD → DOCX → PDF → client folder)
  - ☐ Prescription (MD → DOCX → PDF → client folder)

**Step 4: Generate**
- User clicks "Generate Reports" button
- Progress indicators show:
  - ⏳ Generating clinical notes...
  - ⏳ Generating client report...
  - ⏹ Vet report (skipped)
  - ⏹ Prescription (skipped)
- AI generates selected outputs in parallel
- Results appear in preview sections below

**Step 5: Review/Edit**
- Each generated output shows:
  - Preview of content
  - "Edit" button → Opens edit dialog
  - "Regenerate" button → Re-runs AI for this output only
  - Version indicator (v1, v2, etc.)
- User can edit directly or regenerate if not satisfied

**Step 6: Save or Complete**
- **"Save as Draft" button**:
  - Saves Event with processingState
  - status = 'in_progress'
  - Creates "Complete Consultation for [Client]" task (due 24 hours)
  - User can close and come back later
- **"Complete" button** (enabled when all selected outputs generated):
  - Saves all generated outputs
    - Clinical notes → Event.notes
    - Client report → Save MD/convert DOCX/convert PDF
    - Vet report → Save MD/convert DOCX (if selected)
    - Prescription → Save MD/convert DOCX/convert PDF (if selected)
  - Updates Event.transcriptFilePath, Event.questionnaireFilePath
  - Creates tasks:
    - "Email client report to [Client]" (if client report generated)
    - "Email vet report to [Vet]" (if vet report generated)
    - "Post prescription to [Client]" (if prescription generated)
  - Sets processingState.status = 'completed'
  - Marks "Complete Consultation" task as Done (if exists)
  - Closes dialog

**Step 7: Resume Later (if saved as draft)**
1. User reopens event from EventsTable (amber row, "In Progress" badge)
2. EventFormModal loads with ConsultationEventPanel
3. processingState restored from database
4. Previously selected files restored
5. Previously generated outputs shown in preview
6. User can:
   - Edit existing outputs
   - Regenerate specific outputs
   - Generate remaining outputs
   - Complete the event

### 3.2 State Transitions

```
draft (new event, nothing done)
  ↓
  [User selects inputs and outputs, clicks Generate]
  ↓
in_progress (generating)
  ↓
  [Generation complete, user can edit/regenerate]
  ↓
in_progress (editing/regenerating)
  ↓
  [User clicks "Save as Draft" OR "Complete"]
  ↓
in_progress (saved draft) ──┐
  ↑                          │
  └──────[Reopen later]──────┘
  ↓
  [User clicks "Complete"]
  ↓
completed (all outputs saved, tasks created)
```

### 3.3 Report Types and Tasks

| Output | Format | Destination | Auto-Task |
|--------|--------|-------------|-----------|
| Clinical Notes | HTML | Event.notes | None |
| Client Report | MD → DOCX → PDF | Client folder | "Email client report to [Client]" |
| Vet Report | MD → DOCX | Client folder | "Email vet report to [Vet]" |
| Prescription | MD → DOCX → PDF | Client folder | "Post prescription to [Client]" (real mail) |

**Note:** Prescription report template needs to be created (doesn't exist yet)

---

## 4. File Management

### 4.1 Transcript Handling

**Input Options:**
1. **Browse and select existing file**
   - Uses file picker to select from client folder
   - Filters: *.txt files
   - Stores path in Event.transcriptFilePath

2. **Paste text directly**
   - Text area for pasting transcript
   - Auto-save to client folder when event saved
   - Filename: `{surname}_{YYYYMMDD}_transcript.txt` (or _v2, _v3)
   - Stores path in Event.transcriptFilePath

**Benefits:** Maximum flexibility - quick paste for immediate processing, or select existing file

### 4.2 Questionnaire Handling

**Input:**
- Dropdown populated from client folder
- Lists all *.json files
- Pre-selects if Event.questionnaireFilePath exists
- Optional (can generate reports without questionnaire)

### 4.3 Report File Naming

**Existing conventions (keep consistent):**
- MD: `{surname}_{YYYYMMDD}_consultation-report_v{N}.md`
- DOCX: `{surname}_{YYYYMMDD}_consultation-report_v{N}.docx`
- PDF (client-friendly): `{PetName}_Consultation_Report_{DDMmmYYYY}.pdf`

**New additions:**
- Vet report MD: `{surname}_{YYYYMMDD}_vet-report_v{N}.md`
- Vet report DOCX: `{surname}_{YYYYMMDD}_vet-report_v{N}.docx`
- Prescription MD: `{surname}_{YYYYMMDD}_prescription_v{N}.md`
- Prescription DOCX: `{surname}_{YYYYMMDD}_prescription_v{N}.docx`
- Prescription PDF: `{PetName}_Prescription_{DDMmmYYYY}.pdf`

### 4.4 Version Management

**Strategy: Keep all versions (v1, v2, v3...)**
- Auto-increment version number on regeneration
- Provides audit trail
- Allows user to refer back to previous versions
- Disk space is negligible for text/PDF files

**Version detection:**
- Scan client folder for existing files with same base name
- Extract highest version number
- Use next version for new generation

---

## 5. AI Report Generation

### 5.1 Report Templates

**Existing (use as-is):**
1. `comprehensive-clinical` → Client Report (MD)
2. `abridged-notes` → Clinical Notes (HTML)
3. `vet-report` → Vet Report (MD)

**New (needs creation):**
4. `prescription` → Prescription (MD)

**Prescription Template Requirements:**
- Output format: Markdown (converted to DOCX/PDF)
- Max tokens: 2000 (short, focused document)
- Variables: clientName, petName, petSpecies, petBreed, petAge, petSex, consultationDate, transcript
- Structure:
  - Header (Client/Pet info, Date, Vet signature)
  - Diagnosis
  - Prescribed medication
  - Dosage instructions
  - Duration
  - Purpose/rationale
  - Warnings/contraindications
  - Follow-up instructions

### 5.2 Generation Strategy

**Parallel generation:**
- Generate all selected outputs in parallel (Promise.all)
- Reduces total wait time
- Uses existing `generateConsultationReports()` from multiReportGenerationService

**Regeneration:**
- User can regenerate individual outputs
- Increments version number
- Re-runs AI for that specific output only
- Preserves other outputs

### 5.3 Cost Estimation

- Show estimated tokens and cost before generation
- Use existing `estimateReportCost()` function
- Display in UI before user clicks "Generate"

---

## 6. Task Auto-Creation

### 6.1 Task Creation Timing

**Tasks created only when user clicks "Complete"**
- Not created during draft saves
- Prevents duplicate tasks if user regenerates reports
- Allows user to finalize outputs before committing to tasks

### 6.2 Task Definitions

**1. Email Client Report**
- Created if: Client report generated
- Description: `Email consultation report to {ClientName}`
- Due date: Event.date + 1 day
- Priority: 2
- Status: Pending
- triggeredBy: "Event:Consultation"
- automatedAction: "EmailClientReport"

**2. Email Vet Report**
- Created if: Vet report generated
- Description: `Email vet report to {VetClinicName} for {ClientName}`
- Due date: Event.date + 1 day
- Priority: 2
- Status: Pending
- triggeredBy: "Event:Consultation"
- automatedAction: "EmailVetReport"

**3. Post Prescription**
- Created if: Prescription generated
- Description: `Post prescription to {ClientName} (mail delivery)`
- Due date: Event.date + 2 days
- Priority: 2
- Status: Pending
- triggeredBy: "Event:Consultation"
- automatedAction: "PostPrescription"

**4. Complete Consultation (Incomplete Event Reminder)**
- Created if: Event saved as draft (status='in_progress')
- Description: `Complete Consultation processing for {ClientName}`
- Due date: Now + 24 hours
- Priority: 2
- Status: Pending
- triggeredBy: "Manual"
- automatedAction: "CompleteEvent"
- **Marked as Done when user completes the event**

---

## 7. Pause/Resume and State Persistence

### 7.1 Auto-Save Behavior

**When user makes changes:**
- Local state updates immediately (React state)
- processingState NOT saved to database until explicit save

**When user clicks "Save as Draft":**
- Serialize current state to JSON
- Save to Event.processingState
- Save Event.transcriptFilePath (if file selected or pasted)
- Save Event.questionnaireFilePath (if selected)
- Create "Complete Consultation" reminder task
- Close dialog

**When user clicks "Complete":**
- Save all generated outputs
- Convert and save files (MD → DOCX → PDF)
- Create output-related tasks
- Set processingState.status = 'completed'
- Mark "Complete Consultation" task as Done
- Close dialog

### 7.2 Resume Behavior

**When user reopens in-progress event:**
1. Load Event from database
2. Parse Event.processingState JSON
3. Restore UI state:
   - Transcript source (file path or pasted text)
   - Questionnaire selection
   - Output selections
   - Generated outputs (show previews)
   - Current step
4. Enable "Continue" or "Complete" buttons based on state
5. Allow user to:
   - Edit existing outputs
   - Regenerate specific outputs
   - Generate remaining outputs (if some selected but not generated)
   - Complete the event

### 7.3 State Validation

**On load:**
- Check if referenced files still exist
- Validate processingState JSON structure
- Handle missing/corrupted state gracefully
- Show error if client folder missing

---

## 8. UI Layout and Design

### 8.1 EventFormModal Layout

```
┌───────────────────────────────────────────────────────────────────┐
│ Consultation Details - Sarah Johnson (Max)                   [X] │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Standard Event      │  │ Consultation Processing        │   │
│  │ Fields              │  │                                 │   │
│  │                     │  │ ┌────────────────────────────┐  │   │
│  │ Event Type:         │  │ │ INPUT FILES                │  │   │
│  │ [Consultation ▼]    │  │ │                            │  │   │
│  │                     │  │ │ ○ Transcript               │  │   │
│  │ Date & Time:        │  │ │   [Browse...] or paste:    │  │   │
│  │ [2025-11-26 14:00]  │  │ │   [Text area........]      │  │   │
│  │                     │  │ │                            │  │   │
│  │ Notes: (hidden for  │  │ │ ○ Questionnaire (optional) │  │   │
│  │  Consultation -     │  │ │   [Select file... ▼]       │  │   │
│  │  generated instead) │  │ └────────────────────────────┘  │   │
│  │                     │  │                                 │   │
│  │                     │  │ ┌────────────────────────────┐  │   │
│  │                     │  │ │ OUTPUTS TO GENERATE        │  │   │
│  │                     │  │ │                            │  │   │
│  │                     │  │ │ ☑ Clinical Notes           │  │   │
│  │                     │  │ │ ☑ Client Report (PDF)      │  │   │
│  │                     │  │ │ ☐ Vet Report               │  │   │
│  │                     │  │ │ ☐ Prescription             │  │   │
│  │                     │  │ │                            │  │   │
│  │                     │  │ │ Cost: ~$0.25  [Generate]   │  │   │
│  │                     │  │ └────────────────────────────┘  │   │
│  │                     │  │                                 │   │
│  │                     │  │ ┌────────────────────────────┐  │   │
│  │                     │  │ │ GENERATED OUTPUTS          │  │   │
│  │                     │  │ │                            │  │   │
│  │                     │  │ │ ✓ Clinical Notes (v1)      │  │   │
│  │                     │  │ │   [Preview][Edit][Regen]   │  │   │
│  │                     │  │ │                            │  │   │
│  │                     │  │ │ ⏳ Client Report...        │  │   │
│  │                     │  │ │                            │  │   │
│  │                     │  │ │ ⏹ Vet Report (skipped)     │  │   │
│  │                     │  │ └────────────────────────────┘  │   │
│  │                     │  │                                 │   │
│  │                     │  │ ┌────────────────────────────┐  │   │
│  │                     │  │ │ TASKS TO CREATE            │  │   │
│  │                     │  │ │ (when you click Complete)  │  │   │
│  │                     │  │ │                            │  │   │
│  │                     │  │ │ ☑ Email client report      │  │   │
│  │                     │  │ │ ☐ Email vet report         │  │   │
│  │                     │  │ │ ☐ Post prescription        │  │   │
│  │                     │  │ └────────────────────────────┘  │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
│                                                                   │
│                    [Cancel] [Save as Draft] [Complete]           │
└───────────────────────────────────────────────────────────────────┘
```

### 8.2 EventsTable Row Indicators

**In-Progress Events:**
- Background: `bg-amber-50` (light yellow/amber)
- Badge: `<Badge variant="warning">In Progress</Badge>`
- Sort to top of table

**Completed Events:**
- No special styling
- No badge

**Visual Example:**
```
┌────────────┬──────────────┬────────────┬─────────────┬─────────┐
│ Type       │ Date         │ Client     │ Status      │ Actions │
├────────────┼──────────────┼────────────┼─────────────┼─────────┤
│ Consulta-  │ 26/11/2025   │ Sarah J.   │ [In Prog.]  │ [Edit]  │ ← Amber row
│ tion       │ 14:00        │            │             │         │
├────────────┼──────────────┼────────────┼─────────────┼─────────┤
│ Booking    │ 30/11/2025   │ John D.    │             │ [Edit]  │
└────────────┴──────────────┴────────────┴─────────────┴─────────┘
```

---

## 9. Future Event Types (Architecture Support)

### 9.1 Booking Event

**Purpose:** Manage website booking confirmations and questionnaire follow-up

**Inputs:**
- Booking details (already captured from Supabase sync)
- Confirmation sent? (checkbox)

**Outputs:**
- Confirmation email (draft)
- Questionnaire reminder email (scheduled)

**Tasks:**
- Send confirmation email
- Send questionnaire link (48 hours before consultation)
- Follow-up if no questionnaire received

### 9.2 Training Session Event

**Purpose:** Document training session and assign homework

**Inputs:**
- Session notes (rich text)
- Homework assigned (list)

**Outputs:**
- Session summary for client
- Homework document (PDF)

**Tasks:**
- Email session summary and homework
- Schedule next session reminder

### 9.3 Follow-Up Event

**Purpose:** Track follow-up calls and next steps

**Inputs:**
- Follow-up notes (rich text)
- Progress assessment

**Outputs:**
- Follow-up summary email
- Next appointment recommendation

**Tasks:**
- Send follow-up summary
- Schedule next appointment

---

## 10. Migration from Current System

### 10.1 What Gets Removed

**Components:**
- Remove blue FileText icon from EventsTable
- Remove green CheckSquare icon from EventsTable
- Keep ReportGeneratorDialog (logic reused in ConsultationEventPanel)
- Keep BulkTaskImporter (logic reused in ConsultationEventPanel)

**Workflow:**
- Old: Edit event → Close → Click blue icon → Generate reports
- New: Edit event → Generate reports in panel → Complete

### 10.2 What Gets Preserved

**Services (reuse):**
- multiReportGenerationService.ts
- transcriptFileService.ts
- docxConversionService.ts
- pdfConversionService.ts
- All existing AI prompts and templates

**Data (no migration needed):**
- Existing Events continue to work
- processingState is nullable (new field)
- Old events won't have processingState → treated as completed

### 10.3 Backward Compatibility

**Existing Events:**
- Events without processingState are treated as completed
- Can still be edited (standard fields only)
- No event-specific panel shown for old events (unless user wants to reprocess)

**Optional:** Add "Reprocess" button to old Consultation events to populate event panel and allow regeneration

---

## 11. Implementation Phases

### Phase 1: Database and Core Architecture (Week 1)

**Tasks:**
1. Create migration: Add `processingState` TEXT field to Event model
2. Create TypeScript interfaces: `EventProcessingState`, `OutputState`
3. Create `EventFormModal.tsx` (shell with two-panel layout)
4. Modify `EventForm.tsx` (add `hideNotes` prop, expose form data)
5. Create `EventSpecificPanelProps.ts` interface
6. Update EventsTable to use EventFormModal instead of Dialog
7. Add amber background and "In Progress" badge to EventsTable rows

**Testing:**
- Verify EventForm still works in new modal layout
- Verify standard (non-Consultation) events work normally
- Verify visual indicators for in-progress events

### Phase 2: Consultation Event Panel - Basic (Week 2)

**Tasks:**
1. Create `ConsultationEventPanel.tsx` (basic structure)
2. Create `TranscriptInput.tsx` (file picker + paste area)
3. Create `QuestionnaireSelector.tsx` (dropdown from client folder)
4. Create `OutputSelector.tsx` (checkboxes for 4 output types)
5. Wire up file selection logic
6. Implement state serialization/deserialization (processingState JSON)
7. Implement "Save as Draft" functionality
8. Create "Complete Consultation" reminder task when draft saved

**Testing:**
- Open Consultation event, select files, save as draft
- Reopen event, verify state restored
- Verify reminder task created

### Phase 3: Report Generation Integration (Week 3)

**Tasks:**
1. Create `prescription` prompt template in promptTemplates.ts
2. Integrate multiReportGenerationService into ConsultationEventPanel
3. Create `OutputPreview.tsx` (preview/edit generated content)
4. Implement "Generate Reports" button and workflow
5. Show progress indicators during generation
6. Display generated outputs in preview sections
7. Implement individual "Regenerate" buttons with version increment

**Testing:**
- Generate all 4 output types
- Verify parallel generation works
- Verify outputs appear in preview
- Regenerate individual outputs, verify version increment

### Phase 4: File Conversion and Task Creation (Week 4)

**Tasks:**
1. Integrate docxConversionService for MD → DOCX conversion
2. Integrate pdfConversionService for DOCX → PDF conversion
3. Implement "Complete" button workflow:
   - Save all outputs to files
   - Convert MD → DOCX → PDF where needed
   - Update Event.notes with clinical notes HTML
   - Update Event.transcriptFilePath, Event.questionnaireFilePath
   - Create output-related tasks (Email client report, Email vet report, Post prescription)
   - Mark "Complete Consultation" task as Done
   - Set processingState.status = 'completed'
4. Create `TaskCreationOptions.tsx` (checkboxes for tasks to create)

**Testing:**
- Complete full workflow end-to-end
- Verify files created in client folder with correct naming
- Verify tasks created correctly
- Verify reminder task marked Done

### Phase 5: Polish and Edge Cases (Week 5)

**Tasks:**
1. Error handling for missing files, failed generation, etc.
2. Loading states and progress indicators
3. Cost estimation display
4. Version detection and management
5. Edit functionality for generated outputs
6. Keyboard shortcuts (Ctrl+S for save, etc.)
7. Accessibility improvements
8. Mobile/responsive layout (if needed)
9. User testing and feedback

**Testing:**
- Test error scenarios (missing folder, API failure, etc.)
- Test with real consultation data
- User acceptance testing

### Phase 6: Documentation and Cleanup (Week 6)

**Tasks:**
1. Update CLAUDE.md with new workflow documentation
2. Remove old blue/green icon code from EventsTable
3. Archive ReportGeneratorDialog and BulkTaskImporter (keep for reference)
4. Create user guide for new workflow
5. Create video walkthrough
6. Performance optimization if needed

---

## 12. Open Questions for User Decision

### Critical Decisions Needed:

**1. Transcript Input Method**
- **Preferred:** Both file picker AND paste area?
- Or just one method?

**2. Prescription Template**
- Do you have an existing prescription template document to reference?
- What structure/content should it include?

**3. Version Management**
- **Preferred:** Keep all versions (v1, v2, v3)?
- Or overwrite old versions?

**4. Task Auto-Creation Timing**
- **Preferred:** Only when "Complete" clicked?
- Or as soon as reports generated?

**5. Incomplete Event Reminder**
- **Preferred:** Auto-create task with 24-hour due date?
- Or just visual indicator + toast notification?

**6. Other Event Types**
- Implement Consultation only first, then add others?
- **Preferred:** Or build framework now to support all types?

**7. Dialog Size**
- Two-panel layout will be wider. Max width?
- Suggested: `max-w-6xl` (1152px)

**8. Vet Report Auto-Send**
- Should vet report task include vet email address?
- Or leave blank for user to fill in?

**9. Prescription Workflow**
- Is prescription always PDF, or sometimes DOCX?
- Does it need special formatting (letterhead, signature)?

**10. File Conversion Failure Handling**
- If Pandoc or MS Word fails, what should happen?
- Fallback to just MD file?
- Show error and let user retry?

---

## 13. Technical Considerations

### 13.1 Performance

**Concerns:**
- Parallel AI generation (3-4 API calls simultaneously)
- Large transcript files (memory usage)
- File conversion (Pandoc, MS Word COM automation)

**Mitigations:**
- Show progress indicators clearly
- Use streaming for large file reads
- Implement cancellation for long-running operations
- Cache prompt templates to reduce repeated parsing

### 13.2 Error Handling

**Failure Points:**
- Client folder not created
- Transcript file not found
- Questionnaire file not found/corrupt
- AI API failure (rate limit, network error)
- Pandoc not installed
- MS Word not installed
- File write permission denied

**Strategy:**
- Validate all inputs before starting generation
- Show clear error messages
- Allow retry for transient failures
- Graceful degradation (e.g., skip DOCX if Pandoc missing)

### 13.3 State Consistency

**Challenges:**
- User closes dialog mid-generation
- Browser crash during processing
- Concurrent edits (unlikely but possible)

**Solutions:**
- Auto-save draft at key checkpoints
- Warn before closing during generation
- Use optimistic UI updates with rollback

### 13.4 Testing Strategy

**Unit Tests:**
- State serialization/deserialization
- File path generation
- Version number detection
- Task creation logic

**Integration Tests:**
- Full workflow end-to-end (mock AI API)
- File conversion pipeline
- State persistence and restoration

**Manual Tests:**
- Real consultation data
- Error scenarios
- Resume after crash/close

---

## 14. Success Criteria

### Must Have (MVP)
- ✅ User can create Consultation event and generate all 4 outputs in one workflow
- ✅ User can save draft and resume later without losing progress
- ✅ Tasks auto-created based on generated outputs
- ✅ Files saved to client folder with correct naming/versioning
- ✅ Clinical notes saved to Event.notes
- ✅ In-progress events visually distinct in EventsTable
- ✅ Reminder task created for incomplete events

### Nice to Have (Post-MVP)
- Individual output regeneration with version tracking
- Cost estimation before generation
- Edit functionality for generated content
- Support for other event types (Booking, Training, FollowUp)
- Batch processing (multiple consultations)
- Export workflow history

### Success Metrics
- Time to process consultation reduced by 50%
- Zero data loss during pause/resume
- User satisfaction: "Much clearer workflow" feedback
- Task creation accuracy: 100% (correct tasks for correct outputs)

---

## 15. Next Steps

**Immediate:**
1. User review and feedback on this plan
2. Answer open questions (Section 12)
3. Finalize prescription template structure
4. Approve Phase 1 implementation

**After Approval:**
1. Create database migration
2. Build EventFormModal shell
3. Implement Phase 1 tasks
4. User testing of Phase 1
5. Iterate based on feedback
6. Move to Phase 2

---

**End of Plan Document**
**Created:** 2025-11-26
**Status:** Draft - Awaiting User Review