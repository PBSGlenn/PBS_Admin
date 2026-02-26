#!/usr/bin/env node

/**
 * PBS Admin MCP Server
 *
 * Exposes PBS Admin's SQLite database to Claude Desktop / Cowork via MCP.
 * Read-only access to clients, pets, events, tasks, and settings.
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
    db = new Database(DB_PATH, { readonly: true });
    // Note: WAL pragma removed — it requires write access which conflicts with readonly mode
  }
  return db;
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new McpServer({
  name: "pbs-admin",
  version: "1.0.0",
});

// ============================================================================
// Tools
// ============================================================================

server.tool(
  "search_clients",
  "Search for clients by name, email, phone, or pet name. Uses FTS5 full-text search with prefix matching.",
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
      // Use LIKE query with Pet JOIN for reliable search across all fields
      // Note: FTS5 contentless table clientId is not retrievable via better-sqlite3,
      // so we skip FTS5 in the MCP server and use LIKE which works reliably.
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
            text: "Only SELECT, PRAGMA, and EXPLAIN queries are allowed (read-only access).",
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
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PBS Admin MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
