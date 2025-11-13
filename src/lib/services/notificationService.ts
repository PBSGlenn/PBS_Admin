// PBS Admin - Notification Service
// Checks for due and overdue tasks and triggers notifications

import { query } from '../db';
import type { Task } from '../types';
import { isPast, isToday, isTomorrow, parseISO } from 'date-fns';

export interface TaskNotification {
  taskId: number;
  description: string;
  dueDate: string;
  priority: number;
  clientId?: number;
  clientName?: string;
  status: 'overdue' | 'due-today' | 'due-tomorrow';
}

/**
 * Get all pending/in-progress tasks that are due or overdue
 */
export async function getDueTasksForNotification(): Promise<TaskNotification[]> {
  const tasks = await query<Task & { clientName?: string }>(`
    SELECT
      t.*,
      c.firstName || ' ' || c.lastName as clientName
    FROM Task t
    LEFT JOIN Client c ON t.clientId = c.clientId
    WHERE t.status IN ('Pending', 'InProgress')
    AND t.dueDate IS NOT NULL
    ORDER BY t.dueDate ASC, t.priority ASC
  `);

  const now = new Date();
  const notifications: TaskNotification[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const dueDate = parseISO(task.dueDate);

    // Overdue tasks
    if (isPast(dueDate) && !isToday(dueDate)) {
      notifications.push({
        taskId: task.taskId,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        clientId: task.clientId || undefined,
        clientName: task.clientName || undefined,
        status: 'overdue',
      });
    }
    // Due today
    else if (isToday(dueDate)) {
      notifications.push({
        taskId: task.taskId,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        clientId: task.clientId || undefined,
        clientName: task.clientName || undefined,
        status: 'due-today',
      });
    }
    // Due tomorrow (optional - for early warning)
    else if (isTomorrow(dueDate)) {
      notifications.push({
        taskId: task.taskId,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        clientId: task.clientId || undefined,
        clientName: task.clientName || undefined,
        status: 'due-tomorrow',
      });
    }
  }

  return notifications;
}

/**
 * Get count of overdue tasks
 */
export async function getOverdueTaskCount(): Promise<number> {
  const tasks = await query<Task>(`
    SELECT * FROM Task
    WHERE status IN ('Pending', 'InProgress')
    AND dueDate IS NOT NULL
    AND dueDate < datetime('now')
  `);

  return tasks.length;
}

/**
 * Get count of tasks due today
 */
export async function getTodayTaskCount(): Promise<number> {
  const tasks = await query<Task>(`
    SELECT * FROM Task
    WHERE status IN ('Pending', 'InProgress')
    AND dueDate IS NOT NULL
    AND date(dueDate) = date('now')
  `);

  return tasks.length;
}
