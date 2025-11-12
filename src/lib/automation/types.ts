// PBS Admin - Automation Rules Engine Types

import type { Event, Task, Client, Pet } from "../types";

/**
 * Automation trigger types
 */
export type TriggerType =
  | "event.created"
  | "event.updated"
  | "task.created"
  | "task.updated"
  | "client.created";

/**
 * Automation action types
 */
export type ActionType =
  | "create.task"
  | "create.event"
  | "update.task.status"
  | "notify";

/**
 * Context passed to automation rules
 */
export interface AutomationContext {
  event?: Event;
  task?: Task;
  client?: Client;
  pet?: Pet;
}

/**
 * Action payload for creating a task
 */
export interface CreateTaskPayload {
  clientId?: number;
  eventId?: number;
  description: string;
  dueDate: string;
  status: string;
  priority: number;
  automatedAction: string;
  triggeredBy: string;
}

/**
 * Action payload for creating an event
 */
export interface CreateEventPayload {
  clientId: number;
  eventType: string;
  date: string;
  notes?: string;
  parentEventId?: number;
}

/**
 * Generic action definition
 */
export interface Action {
  type: ActionType;
  payload: CreateTaskPayload | CreateEventPayload | any;
}

/**
 * Automation rule definition
 */
export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  condition: (context: AutomationContext) => boolean;
  actions: Action[];
  enabled: boolean;
}

/**
 * Result of executing an automation
 */
export interface AutomationResult {
  ruleId: string;
  success: boolean;
  actionsExecuted: number;
  errors?: string[];
}
