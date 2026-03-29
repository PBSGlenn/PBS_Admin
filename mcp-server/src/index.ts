#!/usr/bin/env node

/**
 * PBS Admin MCP Server
 *
 * Exposes PBS Admin's SQLite database to Claude Desktop / Cowork via MCP.
 * Read and write access to clients, pets, events, tasks, and settings.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";

// Database path: resolve Windows Documents folder (handles OneDrive redirect)
// Windows may redirect Documents to OneDrive\Documents, so we can't just use ~/Documents.
// Rust's dirs::document_dir() uses the Windows Known Folder API which follows the redirect,
// but Node's os.homedir() + "Documents" does not.
function resolveDbPath(): string {
  const dbRelative = path.join("PBS_Admin", "data", "pbs_admin.db");

  // Strategy 1: PowerShell to query the real Documents known folder
  try {
    const docsPath = execSync(
      `powershell -NoProfile -Command "[Environment]::GetFolderPath('MyDocuments')"`,
      { encoding: "utf8", timeout: 5000 }
    ).trim();
    if (docsPath) {
      const candidate = path.join(docsPath, dbRelative);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // PowerShell unavailable or timed out — continue to fallbacks
  }

  // Strategy 2: Check OneDrive Documents (common redirect target)
  const oneDriveCandidate = path.join(os.homedir(), "OneDrive", "Documents", dbRelative);
  if (fs.existsSync(oneDriveCandidate)) return oneDriveCandidate;

  // Strategy 3: Plain ~/Documents
  return path.join(os.homedir(), "Documents", dbRelative);
}

const DB_PATH = resolveDbPath();

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

/** Current ISO timestamp for createdAt/updatedAt fields */
function nowISO(): string {
  return new Date().toISOString();
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new McpServer({
  name: "pbs-admin",
  version: "2.0.0",
});

// ============================================================================
// Read Tools (existing)
// ============================================================================

server.tool(
  "search_clients",
  "Search for clients by name, email, phone, or pet name. Uses LIKE matching with prefix support.",
  { query: z.string().describe("Search query (name, email, phone, or pet name)") },
  async ({ query }) => {
    const d = getDb();
    const trimmed = query.trim();

    let rows;
    if (!trimmed) {
      rows = d
        .prepare(
          `SELECT c.*, COUNT(DISTINCT p.petId) as petCount
           FROM Client c
           LEFT JOIN Pet p ON c.clientId = p.clientId
           GROUP BY c.clientId
           ORDER BY c.lastName, c.firstName
           LIMIT 20`
        )
        .all();
    } else {
      const like = `%${trimmed}%`;
      rows = d
        .prepare(
          `SELECT c.*, COUNT(DISTINCT p.petId) as petCount
           FROM Client c
           LEFT JOIN Pet p ON c.clientId = p.clientId
           WHERE c.firstName LIKE ? OR c.lastName LIKE ? OR c.email LIKE ? OR c.mobile LIKE ? OR p.name LIKE ?
           GROUP BY c.clientId
           ORDER BY c.lastName, c.firstName
           LIMIT 20`
        )
        .all(like, like, like, like, like);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_client",
  "Get full details for a specific client including their pets, recent events, and pending tasks.",
  { clientId: z.number().describe("Client ID") },
  async ({ clientId }) => {
    const d = getDb();

    const client = d
      .prepare("SELECT * FROM Client WHERE clientId = ?")
      .get(clientId);
    if (!client) {
      return {
        content: [{ type: "text" as const, text: `Client ${clientId} not found` }],
      };
    }

    const pets = d
      .prepare("SELECT * FROM Pet WHERE clientId = ?")
      .all(clientId);

    const events = d
      .prepare(
        "SELECT * FROM Event WHERE clientId = ? ORDER BY date DESC LIMIT 10"
      )
      .all(clientId);

    const tasks = d
      .prepare(
        `SELECT * FROM Task WHERE clientId = ?
         ORDER BY CASE status WHEN 'Pending' THEN 0 WHEN 'InProgress' THEN 1 ELSE 2 END, dueDate
         LIMIT 20`
      )
      .all(clientId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ client, pets, events, tasks }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "list_upcoming_events",
  "List upcoming events (bookings, consultations, etc.) in the next N days.",
  {
    days: z.number().default(14).describe("Number of days to look ahead (default 14)"),
  },
  async ({ days }) => {
    const d = getDb();
    const now = new Date().toISOString();
    const future = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000
    ).toISOString();

    const rows = d
      .prepare(
        `SELECT e.*, c.firstName, c.lastName, c.email
         FROM Event e
         LEFT JOIN Client c ON e.clientId = c.clientId
         WHERE e.date >= ? AND e.date <= ?
         ORDER BY e.date ASC
         LIMIT 50`
      )
      .all(now, future);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "list_pending_tasks",
  "List pending and in-progress tasks, with overdue tasks highlighted.",
  {
    includeCompleted: z.boolean().default(false).describe("Include completed tasks"),
  },
  async ({ includeCompleted }) => {
    const d = getDb();

    const statusFilter = includeCompleted
      ? ""
      : "WHERE t.status IN ('Pending', 'InProgress', 'Blocked')";

    const rows = d
      .prepare(
        `SELECT t.*, c.firstName, c.lastName
         FROM Task t
         LEFT JOIN Client c ON t.clientId = c.clientId
         ${statusFilter}
         ORDER BY t.priority ASC, t.dueDate ASC
         LIMIT 50`
      )
      .all();

    const now = new Date().toISOString();
    const enriched = (rows as any[]).map((t) => ({
      ...t,
      isOverdue:
        t.status !== "Done" &&
        t.status !== "Canceled" &&
        t.dueDate < now,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(enriched, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_dashboard_summary",
  "Get a summary of the PBS Admin dashboard: client count, pending tasks, upcoming events, overdue items.",
  {},
  async () => {
    const d = getDb();
    const now = new Date().toISOString();
    const weekFromNow = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const clientCount = (
      d.prepare("SELECT COUNT(*) as count FROM Client").get() as any
    ).count;

    const petCount = (
      d.prepare("SELECT COUNT(*) as count FROM Pet").get() as any
    ).count;

    const pendingTasks = (
      d
        .prepare(
          "SELECT COUNT(*) as count FROM Task WHERE status IN ('Pending', 'InProgress')"
        )
        .get() as any
    ).count;

    const overdueTasks = (
      d
        .prepare(
          "SELECT COUNT(*) as count FROM Task WHERE status IN ('Pending', 'InProgress') AND dueDate < ?"
        )
        .get(now) as any
    ).count;

    const upcomingEvents = (
      d
        .prepare(
          "SELECT COUNT(*) as count FROM Event WHERE date >= ? AND date <= ?"
        )
        .get(now, weekFromNow) as any
    ).count;

    const totalEvents = (
      d.prepare("SELECT COUNT(*) as count FROM Event").get() as any
    ).count;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              clients: clientCount,
              pets: petCount,
              totalEvents,
              upcomingEventsNext7Days: upcomingEvents,
              pendingTasks,
              overdueTasks,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_client_pets",
  "List all pets for a specific client.",
  { clientId: z.number().describe("Client ID") },
  async ({ clientId }) => {
    const d = getDb();
    const rows = d
      .prepare("SELECT * FROM Pet WHERE clientId = ? ORDER BY name")
      .all(clientId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(rows, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "get_setting",
  "Read a setting from the PBS Admin Settings table (e.g., backup settings, API key status).",
  { key: z.string().describe("Setting key (e.g., 'pbs_admin_backup_settings')") },
  async ({ key }) => {
    const d = getDb();
    const row = d
      .prepare("SELECT value FROM Settings WHERE key = ?")
      .get(key) as { value: string } | undefined;

    if (!row) {
      return {
        content: [{ type: "text" as const, text: `Setting "${key}" not found` }],
      };
    }

    // Try to parse as JSON for readability
    try {
      const parsed = JSON.parse(row.value);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(parsed, null, 2),
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text" as const, text: row.value }],
      };
    }
  }
);

server.tool(
  "run_query",
  "Run a read-only SQL query against the PBS Admin database. Use for custom queries not covered by other tools.",
  {
    sql: z.string().describe("SQL SELECT query to execute"),
    params: z.array(z.union([z.string(), z.number()])).default([]).describe("Query parameters for ? placeholders"),
  },
  async ({ sql, params }) => {
    // Safety: only allow SELECT statements
    const trimmed = sql.trim().toUpperCase();
    if (
      !trimmed.startsWith("SELECT") &&
      !trimmed.startsWith("PRAGMA") &&
      !trimmed.startsWith("EXPLAIN")
    ) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Only SELECT, PRAGMA, and EXPLAIN queries are allowed. Use run_write_query for INSERT/UPDATE/DELETE.",
          },
        ],
      };
    }

    const d = getDb();
    try {
      const rows = d.prepare(sql).all(...params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Query error: ${err.message}`,
          },
        ],
      };
    }
  }
);

// ============================================================================
// Write Tools — Event Management
// ============================================================================

const EVENT_TYPES = [
  "Note", "Consultation", "TrainingSession", "Booking",
  "FollowUp", "PhoneCall", "Email", "Payment", "ReportSent", "Other",
] as const;

server.tool(
  "create_event",
  "Create a new event for a client (e.g., Note, Consultation, Booking, FollowUp, PhoneCall, Email).",
  {
    clientId: z.number().describe("Client ID"),
    eventType: z.enum(EVENT_TYPES).describe("Event type"),
    date: z.string().describe("ISO 8601 datetime string"),
    notes: z.string().describe("Event notes (HTML string)"),
    parentEventId: z.number().optional().describe("Parent event ID for linked events"),
  },
  async ({ clientId, eventType, date, notes, parentEventId }) => {
    const d = getDb();

    // Verify client exists
    const client = d.prepare("SELECT clientId FROM Client WHERE clientId = ?").get(clientId);
    if (!client) {
      return {
        content: [{ type: "text" as const, text: `Error: Client ${clientId} not found` }],
        isError: true,
      };
    }

    // Verify parent event exists if specified
    if (parentEventId !== undefined) {
      const parent = d.prepare("SELECT eventId FROM Event WHERE eventId = ?").get(parentEventId);
      if (!parent) {
        return {
          content: [{ type: "text" as const, text: `Error: Parent event ${parentEventId} not found` }],
          isError: true,
        };
      }
    }

    const now = nowISO();
    const stmt = d.prepare(
      `INSERT INTO Event (clientId, eventType, date, notes, calendlyEventUri, calendlyStatus, parentEventId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, '', '', ?, ?, ?)`
    );
    const result = stmt.run(clientId, eventType, date, notes, parentEventId ?? null, now, now);

    const created = d.prepare("SELECT * FROM Event WHERE eventId = ?").get(result.lastInsertRowid);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(created, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "update_event",
  "Update an existing event's fields (notes, date, eventType, parentEventId).",
  {
    eventId: z.number().describe("Event ID to update"),
    notes: z.string().optional().describe("Updated notes (HTML string)"),
    date: z.string().optional().describe("Updated ISO 8601 datetime string"),
    eventType: z.enum(EVENT_TYPES).optional().describe("Updated event type"),
    parentEventId: z.number().nullable().optional().describe("Updated parent event ID (null to unlink)"),
  },
  async ({ eventId, notes, date, eventType, parentEventId }) => {
    const d = getDb();

    const existing = d.prepare("SELECT * FROM Event WHERE eventId = ?").get(eventId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Event ${eventId} not found` }],
        isError: true,
      };
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }
    if (date !== undefined) { fields.push("date = ?"); values.push(date); }
    if (eventType !== undefined) { fields.push("eventType = ?"); values.push(eventType); }
    if (parentEventId !== undefined) { fields.push("parentEventId = ?"); values.push(parentEventId); }

    if (fields.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No fields to update. Provide at least one field." }],
        isError: true,
      };
    }

    fields.push("updatedAt = ?");
    values.push(nowISO());
    values.push(eventId);

    d.prepare(`UPDATE Event SET ${fields.join(", ")} WHERE eventId = ?`).run(...values);

    const updated = d.prepare("SELECT * FROM Event WHERE eventId = ?").get(eventId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(updated, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "delete_event",
  "Delete an event. Tasks linked to this event will have their eventId set to NULL (not deleted).",
  {
    eventId: z.number().describe("Event ID to delete"),
    confirm: z.boolean().describe("Must be true to confirm deletion"),
  },
  async ({ eventId, confirm }) => {
    if (!confirm) {
      return {
        content: [{ type: "text" as const, text: "Deletion not confirmed. Set confirm to true to proceed." }],
        isError: true,
      };
    }

    const d = getDb();

    const existing = d.prepare("SELECT * FROM Event WHERE eventId = ?").get(eventId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Event ${eventId} not found` }],
        isError: true,
      };
    }

    // Unlink tasks before deleting (SET NULL behavior)
    d.prepare("UPDATE Task SET eventId = NULL, updatedAt = ? WHERE eventId = ?").run(nowISO(), eventId);
    // Unlink child events
    d.prepare("UPDATE Event SET parentEventId = NULL, updatedAt = ? WHERE parentEventId = ?").run(nowISO(), eventId);

    d.prepare("DELETE FROM Event WHERE eventId = ?").run(eventId);

    return {
      content: [
        {
          type: "text" as const,
          text: `Event ${eventId} (${existing.eventType} on ${existing.date}) deleted successfully. Linked tasks and child events have been unlinked.`,
        },
      ],
    };
  }
);

// ============================================================================
// Write Tools — Task Management
// ============================================================================

const TASK_STATUSES = ["Pending", "InProgress", "Blocked", "Done", "Canceled"] as const;

server.tool(
  "create_task",
  "Create a new task for a client, optionally linked to an event.",
  {
    clientId: z.number().describe("Client ID"),
    description: z.string().describe("Task description"),
    dueDate: z.string().describe("ISO 8601 datetime string"),
    priority: z.number().min(1).max(5).default(2).describe("Priority 1 (highest) to 5 (lowest), default 2"),
    status: z.enum(TASK_STATUSES).default("Pending").describe("Task status, default Pending"),
    eventId: z.number().optional().describe("Link task to a specific event"),
    automatedAction: z.string().default("Manual").describe("Automation action label, default Manual"),
    triggeredBy: z.string().default("MCP").describe("Source of task creation, default MCP"),
    parentTaskId: z.number().optional().describe("Parent task ID for subtasks"),
  },
  async ({ clientId, description, dueDate, priority, status, eventId, automatedAction, triggeredBy, parentTaskId }) => {
    const d = getDb();

    // Verify client exists
    const client = d.prepare("SELECT clientId FROM Client WHERE clientId = ?").get(clientId);
    if (!client) {
      return {
        content: [{ type: "text" as const, text: `Error: Client ${clientId} not found` }],
        isError: true,
      };
    }

    // Verify event exists if specified
    if (eventId !== undefined) {
      const event = d.prepare("SELECT eventId FROM Event WHERE eventId = ?").get(eventId);
      if (!event) {
        return {
          content: [{ type: "text" as const, text: `Error: Event ${eventId} not found` }],
          isError: true,
        };
      }
    }

    // Verify parent task exists if specified
    if (parentTaskId !== undefined) {
      const parent = d.prepare("SELECT taskId FROM Task WHERE taskId = ?").get(parentTaskId);
      if (!parent) {
        return {
          content: [{ type: "text" as const, text: `Error: Parent task ${parentTaskId} not found` }],
          isError: true,
        };
      }
    }

    const now = nowISO();
    const completedOn = status === "Done" ? now : null;

    const stmt = d.prepare(
      `INSERT INTO Task (clientId, eventId, description, dueDate, status, priority, automatedAction, triggeredBy, completedOn, parentTaskId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      clientId, eventId ?? null, description, dueDate, status, priority,
      automatedAction, triggeredBy, completedOn, parentTaskId ?? null, now, now
    );

    const created = d.prepare("SELECT * FROM Task WHERE taskId = ?").get(result.lastInsertRowid);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(created, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "update_task",
  "Update a task's fields (description, dueDate, priority, status, completedOn).",
  {
    taskId: z.number().describe("Task ID to update"),
    description: z.string().optional().describe("Updated description"),
    dueDate: z.string().optional().describe("Updated ISO 8601 datetime string"),
    priority: z.number().min(1).max(5).optional().describe("Updated priority 1-5"),
    status: z.enum(TASK_STATUSES).optional().describe("Updated status"),
    completedOn: z.string().nullable().optional().describe("Completed timestamp (ISO 8601), or null to clear"),
  },
  async ({ taskId, description, dueDate, priority, status, completedOn }) => {
    const d = getDb();

    const existing = d.prepare("SELECT * FROM Task WHERE taskId = ?").get(taskId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Task ${taskId} not found` }],
        isError: true,
      };
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (dueDate !== undefined) { fields.push("dueDate = ?"); values.push(dueDate); }
    if (priority !== undefined) { fields.push("priority = ?"); values.push(priority); }
    if (status !== undefined) {
      fields.push("status = ?");
      values.push(status);
      // Auto-set completedOn when marking Done (if not explicitly provided)
      if (status === "Done" && completedOn === undefined && !existing.completedOn) {
        fields.push("completedOn = ?");
        values.push(nowISO());
      }
    }
    if (completedOn !== undefined) { fields.push("completedOn = ?"); values.push(completedOn); }

    if (fields.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No fields to update. Provide at least one field." }],
        isError: true,
      };
    }

    fields.push("updatedAt = ?");
    values.push(nowISO());
    values.push(taskId);

    d.prepare(`UPDATE Task SET ${fields.join(", ")} WHERE taskId = ?`).run(...values);

    const updated = d.prepare("SELECT * FROM Task WHERE taskId = ?").get(taskId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(updated, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "complete_task",
  "Mark a task as Done with current timestamp. Shorthand for update_task with status=Done.",
  {
    taskId: z.number().describe("Task ID to complete"),
  },
  async ({ taskId }) => {
    const d = getDb();

    const existing = d.prepare("SELECT * FROM Task WHERE taskId = ?").get(taskId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Task ${taskId} not found` }],
        isError: true,
      };
    }

    if (existing.status === "Done") {
      return {
        content: [{ type: "text" as const, text: `Task ${taskId} is already Done (completed on ${existing.completedOn}).` }],
      };
    }

    const now = nowISO();
    d.prepare(
      "UPDATE Task SET status = 'Done', completedOn = ?, updatedAt = ? WHERE taskId = ?"
    ).run(now, now, taskId);

    const updated = d.prepare("SELECT * FROM Task WHERE taskId = ?").get(taskId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(updated, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "delete_task",
  "Delete a task. Child tasks will have their parentTaskId set to NULL (not deleted).",
  {
    taskId: z.number().describe("Task ID to delete"),
    confirm: z.boolean().describe("Must be true to confirm deletion"),
  },
  async ({ taskId, confirm }) => {
    if (!confirm) {
      return {
        content: [{ type: "text" as const, text: "Deletion not confirmed. Set confirm to true to proceed." }],
        isError: true,
      };
    }

    const d = getDb();

    const existing = d.prepare("SELECT * FROM Task WHERE taskId = ?").get(taskId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Task ${taskId} not found` }],
        isError: true,
      };
    }

    // Unlink child tasks before deleting
    d.prepare("UPDATE Task SET parentTaskId = NULL, updatedAt = ? WHERE parentTaskId = ?").run(nowISO(), taskId);

    d.prepare("DELETE FROM Task WHERE taskId = ?").run(taskId);

    return {
      content: [
        {
          type: "text" as const,
          text: `Task ${taskId} ("${existing.description}") deleted successfully. Child tasks have been unlinked.`,
        },
      ],
    };
  }
);

// ============================================================================
// Write Tools — Client Management
// ============================================================================

server.tool(
  "update_client",
  "Update client fields. Use appendNotes=true to add to existing notes without replacing them.",
  {
    clientId: z.number().describe("Client ID to update"),
    firstName: z.string().optional().describe("Updated first name"),
    lastName: z.string().optional().describe("Updated last name"),
    email: z.string().optional().describe("Updated email"),
    mobile: z.string().optional().describe("Updated mobile number"),
    streetAddress: z.string().optional().describe("Updated street address"),
    city: z.string().optional().describe("Updated city"),
    state: z.string().optional().describe("Updated state"),
    postcode: z.string().optional().describe("Updated postcode"),
    notes: z.string().optional().describe("Notes content (replaces or appends based on appendNotes)"),
    appendNotes: z.boolean().default(false).describe("When true, appends notes to existing instead of replacing"),
    primaryCareVet: z.string().optional().describe("Updated primary care vet"),
  },
  async ({ clientId, firstName, lastName, email, mobile, streetAddress, city, state, postcode, notes, appendNotes, primaryCareVet }) => {
    const d = getDb();

    const existing = d.prepare("SELECT * FROM Client WHERE clientId = ?").get(clientId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Client ${clientId} not found` }],
        isError: true,
      };
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (firstName !== undefined) { fields.push("firstName = ?"); values.push(firstName); }
    if (lastName !== undefined) { fields.push("lastName = ?"); values.push(lastName); }
    if (email !== undefined) { fields.push("email = ?"); values.push(email); }
    if (mobile !== undefined) { fields.push("mobile = ?"); values.push(mobile); }
    if (streetAddress !== undefined) { fields.push("streetAddress = ?"); values.push(streetAddress); }
    if (city !== undefined) { fields.push("city = ?"); values.push(city); }
    if (state !== undefined) { fields.push("state = ?"); values.push(state); }
    if (postcode !== undefined) { fields.push("postcode = ?"); values.push(postcode); }
    if (primaryCareVet !== undefined) { fields.push("primaryCareVet = ?"); values.push(primaryCareVet); }

    if (notes !== undefined) {
      if (appendNotes && existing.notes) {
        fields.push("notes = ?");
        values.push(existing.notes + "\n" + notes);
      } else {
        fields.push("notes = ?");
        values.push(notes);
      }
    }

    if (fields.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No fields to update. Provide at least one field." }],
        isError: true,
      };
    }

    fields.push("updatedAt = ?");
    values.push(nowISO());
    values.push(clientId);

    d.prepare(`UPDATE Client SET ${fields.join(", ")} WHERE clientId = ?`).run(...values);

    // Return updated client with pets
    const updated = d.prepare("SELECT * FROM Client WHERE clientId = ?").get(clientId);
    const pets = d.prepare("SELECT * FROM Pet WHERE clientId = ?").all(clientId);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ...updated as any, pets }, null, 2),
        },
      ],
    };
  }
);

// ============================================================================
// Write Tools — Pet Management
// ============================================================================

server.tool(
  "update_pet",
  "Update a pet's fields (name, species, breed, sex, dateOfBirth, notes).",
  {
    petId: z.number().describe("Pet ID to update"),
    name: z.string().optional().describe("Updated pet name"),
    species: z.string().optional().describe("Updated species"),
    breed: z.string().optional().describe("Updated breed"),
    sex: z.string().optional().describe("Updated sex"),
    dateOfBirth: z.string().optional().describe("Updated date of birth (ISO date string)"),
    notes: z.string().optional().describe("Updated notes"),
  },
  async ({ petId, name, species, breed, sex, dateOfBirth, notes }) => {
    const d = getDb();

    const existing = d.prepare("SELECT * FROM Pet WHERE petId = ?").get(petId) as any;
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Error: Pet ${petId} not found` }],
        isError: true,
      };
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { fields.push("name = ?"); values.push(name); }
    if (species !== undefined) { fields.push("species = ?"); values.push(species); }
    if (breed !== undefined) { fields.push("breed = ?"); values.push(breed); }
    if (sex !== undefined) { fields.push("sex = ?"); values.push(sex); }
    if (dateOfBirth !== undefined) { fields.push("dateOfBirth = ?"); values.push(dateOfBirth); }
    if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }

    if (fields.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No fields to update. Provide at least one field." }],
        isError: true,
      };
    }

    fields.push("updatedAt = ?");
    values.push(nowISO());
    values.push(petId);

    d.prepare(`UPDATE Pet SET ${fields.join(", ")} WHERE petId = ?`).run(...values);

    const updated = d.prepare("SELECT * FROM Pet WHERE petId = ?").get(petId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(updated, null, 2),
        },
      ],
    };
  }
);

// ============================================================================
// Write Tools — General Write Access
// ============================================================================

server.tool(
  "run_write_query",
  "Execute INSERT, UPDATE, or DELETE SQL for edge cases not covered by specific tools. Requires confirm=true as a safety gate.",
  {
    sql: z.string().describe("SQL statement (INSERT, UPDATE, or DELETE)"),
    params: z.array(z.union([z.string(), z.number()])).default([]).describe("Query parameters for ? placeholders"),
    confirm: z.boolean().describe("Must be true to execute. Safety gate to prevent accidental writes."),
  },
  async ({ sql, params, confirm }) => {
    if (!confirm) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Write not confirmed. Set confirm to true to execute this query.",
          },
        ],
        isError: true,
      };
    }

    const trimmed = sql.trim().toUpperCase();

    // Block dangerous operations
    if (trimmed.startsWith("DROP") || trimmed.startsWith("ALTER") || trimmed.startsWith("CREATE")) {
      return {
        content: [
          {
            type: "text" as const,
            text: "DDL statements (DROP, ALTER, CREATE) are not allowed. Only INSERT, UPDATE, and DELETE are permitted.",
          },
        ],
        isError: true,
      };
    }

    if (
      !trimmed.startsWith("INSERT") &&
      !trimmed.startsWith("UPDATE") &&
      !trimmed.startsWith("DELETE")
    ) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Only INSERT, UPDATE, and DELETE queries are allowed. Use run_query for SELECT statements.",
          },
        ],
        isError: true,
      };
    }

    const d = getDb();
    try {
      const result = d.prepare(sql).run(...params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                rowsAffected: result.changes,
                lastInsertRowid: result.lastInsertRowid
                  ? Number(result.lastInsertRowid)
                  : undefined,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Write query error: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PBS Admin MCP server v2.0.0 running on stdio (read-write)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
