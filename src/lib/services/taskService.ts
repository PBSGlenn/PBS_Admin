// PBS Admin - Task Service
// Handles all database operations for Tasks

import { query, execute } from "../db";
import type { Task, TaskInput, TaskStatus } from "../types";
import { dateToISO } from "../utils/dateUtils";

/**
 * Get all tasks
 */
export async function getAllTasks(): Promise<Task[]> {
  return query<Task>(`
    SELECT * FROM Task
    ORDER BY dueDate ASC
  `);
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: number): Promise<Task | null> {
  const tasks = await query<Task>(`
    SELECT * FROM Task WHERE taskId = ?
  `, [taskId]);

  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Get tasks by client ID
 */
export async function getTasksByClientId(clientId: number): Promise<Task[]> {
  return query<Task>(`
    SELECT * FROM Task
    WHERE clientId = ?
    ORDER BY dueDate ASC
  `,[clientId]);
}

/**
 * Get tasks by event ID
 */
export async function getTasksByEventId(eventId: number): Promise<Task[]> {
  return query<Task>(`
    SELECT * FROM Task
    WHERE eventId = ?
    ORDER BY dueDate ASC
  `, [eventId]);
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
  return query<Task>(`
    SELECT * FROM Task
    WHERE status = ?
    ORDER BY dueDate ASC, priority ASC
  `, [status]);
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(): Promise<Task[]> {
  const now = dateToISO(new Date());
  return query<Task>(`
    SELECT * FROM Task
    WHERE dueDate < ? AND status NOT IN ('Done', 'Canceled')
    ORDER BY dueDate ASC, priority ASC
  `, [now]);
}

/**
 * Get upcoming tasks (pending or in progress)
 */
export async function getUpcomingTasks(): Promise<Task[]> {
  return query<Task>(`
    SELECT * FROM Task
    WHERE status IN ('Pending', 'InProgress')
    ORDER BY dueDate ASC, priority ASC
  `);
}

/**
 * Get tasks for dashboard with client and event info
 */
export async function getTasksForDashboard() {
  return query<any>(`
    SELECT
      t.*,
      c.firstName || ' ' || c.lastName as clientName,
      e.eventType
    FROM Task t
    LEFT JOIN Client c ON t.clientId = c.clientId
    LEFT JOIN Event e ON t.eventId = e.eventId
    WHERE t.status IN ('Pending', 'InProgress')
    ORDER BY t.dueDate ASC, t.priority ASC
  `);
}

/**
 * Create a new task
 */
export async function createTask(input: TaskInput): Promise<Task> {
  const result = await execute(`
    INSERT INTO Task (
      clientId, eventId, description, dueDate,
      status, priority, automatedAction, triggeredBy, parentTaskId,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    input.clientId || null,
    input.eventId || null,
    input.description,
    input.dueDate,
    input.status,
    input.priority,
    input.automatedAction || "",
    input.triggeredBy,
    input.parentTaskId || null,
  ]);

  if (!result.lastInsertId) {
    throw new Error("Failed to create task");
  }

  const newTask = await getTaskById(result.lastInsertId);
  if (!newTask) {
    throw new Error("Failed to retrieve created task");
  }

  return newTask;
}

/**
 * Update an existing task
 */
export async function updateTask(taskId: number, input: Partial<TaskInput>): Promise<Task> {
  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(taskId);

  await execute(`
    UPDATE Task
    SET ${updates.join(", ")}, updatedAt = CURRENT_TIMESTAMP
    WHERE taskId = ?
  `, values);

  const updatedTask = await getTaskById(taskId);
  if (!updatedTask) {
    throw new Error("Task not found after update");
  }

  return updatedTask;
}

/**
 * Update task status
 */
export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<Task> {
  const completedOn = status === "Done" ? dateToISO(new Date()) : null;

  await execute(`
    UPDATE Task
    SET status = ?, completedOn = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE taskId = ?
  `, [status, completedOn, taskId]);

  const updatedTask = await getTaskById(taskId);
  if (!updatedTask) {
    throw new Error("Task not found after update");
  }

  return updatedTask;
}

/**
 * Mark task as done
 */
export async function markTaskDone(taskId: number): Promise<Task> {
  return updateTaskStatus(taskId, "Done");
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: number): Promise<void> {
  await execute(`DELETE FROM Task WHERE taskId = ?`, [taskId]);
}

/**
 * Get child tasks
 */
export async function getChildTasks(parentTaskId: number): Promise<Task[]> {
  return query<Task>(`
    SELECT * FROM Task
    WHERE parentTaskId = ?
    ORDER BY dueDate ASC
  `, [parentTaskId]);
}
