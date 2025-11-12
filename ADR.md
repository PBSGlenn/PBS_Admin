# Architecture Decision Record (ADR)

## PBS Admin - Pet Behaviour Services Administration System

**Date**: 2025-10-27
**Status**: Active
**Decision Makers**: Development Team

---

## 1. Desktop Framework: Tauri

**Decision**: Use Tauri for the Windows 11 desktop application.

**Rationale**:
- Native performance with small binary size
- Full access to system APIs (filesystem, process management)
- Strong security model with explicit permission system
- Built on Rust for reliability and safety
- Web technologies (React) for UI development
- Active community and proven track record

**Alternatives Considered**:
- Electron: Larger bundle size, higher memory usage
- .NET WPF/WinUI: Less flexibility in UI design, steeper learning curve
- Native Windows C++: Longer development time, more complexity

---

## 2. UI Framework: React + TypeScript

**Decision**: Use React with TypeScript for the frontend.

**Rationale**:
- Type safety reduces runtime errors
- Component-based architecture promotes reusability
- Large ecosystem of libraries and tools
- Strong tooling support (VS Code, ESLint, Prettier)
- Familiarity from Ledgerhound project reduces ramp-up time

**Alternatives Considered**:
- Vue.js: Smaller ecosystem
- Svelte: Less mature tooling
- Vanilla JavaScript: No type safety, harder to maintain

---

## 3. UI Component Library: shadcn/ui

**Decision**: Use shadcn/ui with Radix UI primitives and Tailwind CSS.

**Rationale**:
- Modern, accessible components out of the box
- Fully customizable (components copied to project)
- Windows 11-style aesthetics achievable
- Built on Radix UI for accessibility
- Tailwind for rapid styling

**Alternatives Considered**:
- Material-UI: Not aligned with Windows 11 design language
- Ant Design: Less customizable
- Custom components: Too time-consuming

---

## 4. Database: SQLite

**Decision**: Use SQLite for local data storage.

**Rationale**:
- Perfect for single-user, local-first applications
- Zero configuration, embedded database
- ACID compliant with full SQL support
- Excellent performance for the expected data volume
- Cross-platform compatibility
- No server required (offline-first requirement)

**Alternatives Considered**:
- PostgreSQL: Requires server, overkill for single-user
- IndexedDB: Limited query capabilities
- File-based JSON: No relational integrity, poor performance

---

## 5. ORM: Prisma

**Decision**: Use Prisma as the database ORM.

**Rationale**:
- Type-safe database access with auto-generated types
- Excellent migration tooling
- Clear schema definition
- Great developer experience with IntelliSense
- Supports SQLite well
- Proven in Ledgerhound project

**Alternatives Considered**:
- TypeORM: Less intuitive API
- Raw SQL: No type safety, more boilerplate
- Knex: Query builder only, no schema management

---

## 6. State Management: TanStack Query (React Query)

**Decision**: Use TanStack Query for server state management.

**Rationale**:
- Automatic caching and synchronization
- Built-in loading and error states
- Optimistic updates support
- Reduces boilerplate significantly
- Perfect for CRUD operations

**Alternatives Considered**:
- Redux: Too much boilerplate for this use case
- Zustand: Better for client state than server state
- Context API: Manual cache invalidation

---

## 7. Date/Time Handling: date-fns with date-fns-tz

**Decision**: Use date-fns and date-fns-tz for all date operations.

**Rationale**:
- Functional, immutable API
- Tree-shakeable (small bundle size)
- Comprehensive timezone support via date-fns-tz
- Australia/Melbourne timezone explicitly supported
- ISO 8601 storage, local display

**Standard**:
- Store all dates as ISO 8601 strings in UTC
- Display all dates in Australia/Melbourne timezone
- Use consistent format throughout UI

**Alternatives Considered**:
- Moment.js: Large bundle, deprecated
- Day.js: Less comprehensive timezone support
- Luxon: Good but larger bundle

---

## 8. Build Tool: Vite

**Decision**: Use Vite for frontend build tooling.

**Rationale**:
- Extremely fast HMR (Hot Module Replacement)
- Native ES modules support
- Optimized production builds
- First-class TypeScript support
- Tauri's recommended bundler

**Alternatives Considered**:
- Webpack: Slower, more configuration
- Rollup: Less developer-friendly
- Parcel: Less ecosystem support

---

## 9. Rules Engine Architecture

**Decision**: Implement a simple event-driven rules engine with declarative triggers.

**Design**:
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

**Rationale**:
- Easy to extend with new rules
- Clear separation of triggers and actions
- Testable in isolation
- Simple to understand and maintain

---

## 10. Foreign Key Cascade Rules

**Decision**:
- Clients → Pets: CASCADE on delete
- Clients → Events: CASCADE on delete
- Clients → Tasks: SET NULL on delete
- Events → Tasks: SET NULL on delete

**Rationale**:
- Deleting a client should remove their pets (privacy/GDPR)
- Deleting a client should remove their events (historical records tied to client)
- Tasks may be administrative, so allow orphaned tasks with warnings
- Maintain data integrity while allowing flexibility

---

## 11. Import Strategy

**Decision**: Build a dedicated import service with mapping and validation.

**Approach**:
1. Parse legacy database (SQLite or CSV)
2. Validate each record against new schema
3. Map IDs and preserve relationships
4. Generate detailed migration report
5. Provide rollback option

**Rationale**:
- Ensures data integrity during migration
- Provides audit trail
- Allows testing before committing

---

## 12. Backup/Restore Strategy

**Decision**: Export/import entire SQLite database file with metadata.

**Format**:
- SQLite database file copy with timestamp
- Optionally: JSON export for human readability

**Rationale**:
- Simple and reliable
- Preserves all relationships
- Fast restore process
- No data loss risk

---

## 13. Performance Targets

**Targets**:
- App start time: < 3 seconds (cold start)
- Client list with 10,000 records: < 1 second to render
- Search/filter: < 500ms response time
- CRUD operations: < 200ms perceived latency

**Strategies**:
- Indexed database columns
- Virtualized lists for large datasets
- Optimistic UI updates
- Debounced search inputs

---

## 14. Folder Structure

```
PBS_Admin/
├── src-tauri/          # Rust backend
│   ├── src/
│   │   ├── main.rs     # Entry point
│   │   ├── db/         # Database commands
│   │   └── automation/ # Rules engine
│   └── Cargo.toml
├── src/                # React frontend
│   ├── components/     # UI components
│   │   ├── Dashboard/
│   │   ├── Client/
│   │   ├── Event/
│   │   └── Task/
│   ├── lib/
│   │   ├── api.ts      # Tauri command wrappers
│   │   ├── types.ts    # TypeScript types
│   │   └── utils/      # Helpers (date, validation)
│   ├── hooks/          # Custom React hooks
│   └── App.tsx
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── migrations/     # Migration files
│   └── seed.ts         # Seed data
├── docs/               # Documentation
│   ├── ADR.md          # This file
│   ├── TEST_PLAN.md
│   └── EXTENSION_GUIDE.md
├── CLAUDE.md           # AI assistant context
└── README.md           # Setup instructions
```

---

## 15. Testing Strategy

**Decision**: Manual testing with documented test plan, plus unit tests for business logic.

**Rationale**:
- Internal tool with single user
- Manual testing sufficient for CRUD operations
- Critical business logic (automation, date calculations) requires unit tests
- Integration tests for database operations

**Scope**:
- Unit tests: Rules engine, date utilities, validation
- Integration tests: Service layer with database
- Manual tests: UI workflows (documented in TEST_PLAN.md)

---

## Trade-offs and Future Considerations

### Current Limitations:
1. Single-user only (no concurrent access)
2. Manual testing emphasis (no comprehensive E2E tests)
3. No cloud sync (by design, but may be requested later)

### Potential Future Enhancements:
1. Optional cloud backup to secure storage
2. Mobile companion app (read-only)
3. Advanced reporting and analytics
4. Email integration for automated communications
5. Calendar sync beyond Calendly

---

## Revision History

| Date | Change | Reason |
|------|--------|--------|
| 2025-10-27 | Initial ADR | Project kickoff |

