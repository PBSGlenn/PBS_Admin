# PBS Admin - Pet Behaviour Services Administration System

A Windows 11 desktop application for managing clients, pets, events, tasks, and automations for a pet behaviour services business.

**Status**: ✅ **MVP Complete (v1.3.0)** - Full CRUD operations, automation engine, and website booking integration ready for production use.

**Last Updated**: 2025-11-10

---

## Features

### Core Functionality
- ✅ Local SQLite database with full privacy
- ✅ Client management with contact information and change tracking
- ✅ Pet tracking with age calculator and inline editing
- ✅ Event management with rich text notes (Tiptap editor)
- ✅ Task management with priority/status tracking and automation
- ✅ Rules engine with 4 active automation workflows
- ✅ Dashboard with clients list, upcoming bookings, and tasks overview
- ✅ Client view with two-pane layout and integrated CRUD tables
- ✅ Client folder management with Windows File Explorer integration

### Advanced Features
- ✅ Website booking integration (Supabase sync)
- ✅ Automatic client/pet creation from website bookings
- ✅ Client matching by email or mobile (deduplication)
- ✅ Australian phone number formatting (xxxx xxx xxx)
- ✅ Australia/Melbourne timezone handling throughout
- ✅ Pet age calculator (parses "2 years", "18 months", etc.)
- ✅ Rich text editor for event notes with formatting toolbar
- ✅ Compact dashboard UI optimized for screen real estate

### Planned Enhancements
- 🚧 Task detail window with relationship view
- 🚧 Event detail window with full editing
- 🚧 Backup and restore functionality
- 🚧 Auto-sync website bookings on startup
- 🚧 Legacy data import tool

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Desktop Framework** | Tauri 2.x |
| **Frontend** | React 19 + TypeScript |
| **Build Tool** | Vite 7.x |
| **Database** | SQLite + Tauri SQL Plugin |
| **ORM** | Prisma 6.x |
| **UI Components** | shadcn/ui + Radix UI |
| **Styling** | Tailwind CSS 3.x |
| **State Management** | TanStack Query v5 |
| **Date Handling** | date-fns + date-fns-tz |
| **Rich Text** | Tiptap (event notes) |
| **External DB** | Supabase (booking sync) |

---

## Setup

### Prerequisites

- **Node.js** 18.x or higher
- **Rust** (latest stable)
- **npm** or **yarn**

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:

   Create a `.env` file in the project root:
   ```bash
   # Supabase (for website booking sync)
   VITE_SUPABASE_URL=https://qltdzszkjoiyulscyupe.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

3. **Set up the database**:
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run migrations
   npx prisma migrate dev

   # Seed sample data (optional)
   npm run db:seed
   ```

4. **Start development server**:
   ```bash
   npm run tauri dev
   ```

---

## Database

### Schema

The application uses four main entities:

- **Client** - Contact and billing information
- **Pet** - Animals linked to clients
- **Event** - Bookings, consultations, training sessions
- **Task** - Action items with automation support

### Commands

```bash
# View database in Prisma Studio
npx prisma studio

# Create a new migration
npx prisma migrate dev --name description_of_change

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Seed sample data
npm run db:seed
```

### Sample Data

The seed script (`npm run db:seed`) creates test data for development:
- **3 Clients** with contact information and folders
- **4 Pets** with various species and breeds
- **Multiple Events** including bookings, consultations, and notes
- **Tasks** with different priorities and statuses (including overdue examples)

**Note**: Sample data is optional and can be safely skipped for production use.

---

## Quick Start

For first-time setup:

```bash
# 1. Clone and install
npm install

# 2. Set up environment (copy .env.example or create .env)
# Add Supabase credentials if using website booking integration

# 3. Initialize database
npx prisma generate
npx prisma migrate dev
npm run db:seed  # Optional: add sample data

# 4. Run the app
npm run tauri dev
```

The application will open as a native Windows desktop app with the Dashboard visible.

---

## Architecture

See **[CLAUDE.md](CLAUDE.md)** for detailed architecture documentation.

### Key Services

Located in `src/lib/services/`:

- **clientService** - Client CRUD with folder management
- **petService** - Pet management with age calculations
- **eventService** - Event management with automation hooks
- **taskService** - Task management with overdue checking
- **bookingSyncService** - Website booking import from Supabase
- **Automation Engine** (`src/lib/automation/`) - Rules-based workflow automation

### Key Utilities

Located in `src/lib/utils/`:

- **dateUtils** - Australia/Melbourne timezone handling
- **phoneUtils** - Australian mobile formatting (xxxx xxx xxx)
- **ageUtils** - Parse age strings ("2 years") → DOB
- **formatUtils** - General formatting helpers

### Date/Time Handling

**Important**: All dates are stored in ISO 8601 format and displayed in **Australia/Melbourne** timezone.

```typescript
import { dateToISO, formatDate, formatDateTime } from "./lib/utils/dateUtils";

// Store in database
const isoString = dateToISO(new Date());

// Display to user
const displayString = formatDateTime(isoString);
```

### Phone Number Formatting

```typescript
import { formatAustralianMobile, getRawPhoneNumber } from "./lib/utils/phoneUtils";

// Format for display
const formatted = formatAustralianMobile("0412345678"); // "0412 345 678"

// Extract raw for storage
const raw = getRawPhoneNumber("0412 345 678"); // "0412345678"
```

---

## Automation

### Rules Engine

The automation engine executes rules in response to events:

**Implemented Rules**:

1. **Booking → Questionnaire Task**
   - Trigger: Event created with type "Booking"
   - Action: Create task to check questionnaire 48 hours before consultation
   - Priority: High (1)

2. **Consultation → Follow-Up Tasks**
   - Trigger: Consultation event marked complete
   - Action: Create task to send protocol document
   - Priority: Medium (2)

3. **Training Session → Preparation Task**
   - Trigger: Training session event created
   - Action: Create task to prepare materials 2 days before
   - Priority: Medium (2)

### Adding New Rules

See [CLAUDE.md](CLAUDE.md) for detailed instructions on extending the automation system.

---

## Website Booking Integration

PBS Admin integrates with the Pet Behaviour Services website (petbehaviourservices.com.au) to automatically import bookings.

### How It Works

1. **Customer books** via website booking wizard
2. **Website creates booking** in Supabase database (PostgreSQL)
3. **PBS Admin polls** Supabase for unsynced bookings
4. **User clicks "Import X Bookings"** in Dashboard
5. **System processes each booking**:
   - Matches existing client by email or mobile (or creates new)
   - Creates pet record
   - Creates "Note" event (for new clients only)
   - Creates "Booking" event with consultation details
6. **Booking marked as synced** (won't appear again)

### Client Matching Logic

- **Primary**: Email address (case-insensitive)
- **Fallback**: Mobile number (digits only)
- **Action**: Update existing client OR create new client

### Configuration

Ensure `.env` contains valid Supabase credentials:
```bash
VITE_SUPABASE_URL=https://qltdzszkjoiyulscyupe.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

### Usage

1. Open PBS Admin Dashboard
2. Check "Website Bookings" card for unsynced bookings
3. Click refresh icon to poll Supabase
4. Review bookings in table
5. Click "Import X Bookings" button
6. View sync results (success/failure per booking)
7. Navigate to newly created client records

**Note**: Sync is manual - you must click the import button to process new bookings.

---

## Development

### Available Scripts

```bash
# Start development server (frontend + Tauri)
npm run tauri dev

# Build for production
npm run tauri build

# Database operations
npx prisma studio           # Browse database
npx prisma generate         # Generate Prisma client
npx prisma migrate dev      # Create/apply migrations
npm run db:seed             # Seed sample data

# Frontend only
npm run dev                 # Start Vite dev server
npm run build               # Build frontend
```

---

## Documentation

- **[ADR.md](ADR.md)** - Architecture Decision Record
- **[CLAUDE.md](CLAUDE.md)** - Complete project context and development guide
- **README.md** - This file

---

## Privacy & Security

- **Local-first**: All data stored locally in SQLite
- **No cloud**: No third-party API calls (except optional integrations)
- **No telemetry**: No analytics or tracking
- **Offline**: Fully functional without internet

---

## Troubleshooting

### Database Issues

```bash
# Reset database and start fresh
npx prisma migrate reset

# Re-seed sample data
npm run db:seed

# View database
npx prisma studio
```

### Build Issues

```bash
# Clean node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild Tauri
npm run tauri build
```

---

## Data Safety & Backups

### Local Database Location

All data is stored in a local SQLite database:
- **Location**: `prisma/dev.db`
- **Format**: SQLite 3 database file
- **Size**: Typically < 10 MB for small to medium datasets

### Manual Backup

**Recommended**: Back up the database file regularly, especially before major changes.

```bash
# Simple file copy backup
cp prisma/dev.db prisma/backups/dev-backup-$(date +%Y%m%d-%H%M%S).db

# Or on Windows:
copy prisma\dev.db "prisma\backups\dev-backup-%date:~-4,4%%date:~-10,2%%date:~-7,2%.db"
```

### Automated Backup (Future)

Backup/restore functionality via the UI is planned for a future release. In the meantime:
- Manually copy `dev.db` to a safe location (e.g., OneDrive, external drive)
- Consider daily/weekly backup schedule
- Keep multiple backup versions

### Restore from Backup

1. Close the PBS Admin application
2. Replace `prisma/dev.db` with your backup file
3. Restart the application

**Warning**: Restoring will overwrite all current data. Test backups regularly to ensure they're valid.

### Cloud Sync (Optional)

While PBS Admin doesn't include built-in cloud sync (privacy by design), you can:
- Store the database file in OneDrive/Dropbox/Google Drive
- Use Windows File History to back up the project folder
- Use git to track database changes (not recommended for sensitive data)

---

## License

Internal tool for Pet Behaviour Services. Not for distribution.
