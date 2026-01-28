// PBS Admin - Automation Engine
// Executes automation rules when triggered

import type {
  AutomationContext,
  AutomationResult,
  TriggerType,
  Action,
  CreateTaskPayload,
  CreateEventPayload,
} from "./types";
import { getRulesForTrigger } from "./rules";
import { createTask } from "../services/taskService";
import { createEvent } from "../services/eventService";
import { createQuestionnaireCheckDate, subtractDaysFromDate, addDaysToDate } from "../utils/dateUtils";
import { logger } from "../utils/logger";

/**
 * Execute automation rules for a given trigger and context
 */
export async function executeAutomation(
  trigger: TriggerType,
  context: AutomationContext
): Promise<AutomationResult[]> {
  const rules = getRulesForTrigger(trigger);
  const results: AutomationResult[] = [];

  for (const rule of rules) {
    try {
      // Check if rule condition is met
      if (!rule.condition(context)) {
        continue;
      }

      logger.debug(`[Automation] Executing rule: ${rule.name}`);

      let actionsExecuted = 0;
      const errors: string[] = [];

      // Execute each action in the rule
      for (const action of rule.actions) {
        try {
          await executeAction(action, context);
          actionsExecuted++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Action ${action.type} failed: ${errorMessage}`);
          logger.error(`[Automation] Action failed:`, error);
        }
      }

      results.push({
        ruleId: rule.id,
        success: errors.length === 0,
        actionsExecuted,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      logger.error(`[Automation] Rule ${rule.id} failed:`, error);
      results.push({
        ruleId: rule.id,
        success: false,
        actionsExecuted: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  return results;
}

/**
 * Execute a single automation action
 */
async function executeAction(action: Action, context: AutomationContext): Promise<void> {
  switch (action.type) {
    case "create.task":
      await executeCreateTask(action.payload as CreateTaskPayload, context);
      break;

    case "create.event":
      await executeCreateEvent(action.payload as CreateEventPayload, context);
      break;

    case "update.task.status":
      // Implementation for updating task status
      logger.debug("[Automation] Update task status action - not yet implemented");
      break;

    case "notify":
      // Implementation for notifications (local notifications)
      logger.debug("[Automation] Notify action - not yet implemented");
      break;

    default:
      logger.warn(`[Automation] Unknown action type: ${action.type}`);
  }
}

/**
 * Execute create.task action
 */
async function executeCreateTask(
  payload: CreateTaskPayload,
  context: AutomationContext
): Promise<void> {
  // Populate dynamic fields from context
  const clientId = payload.clientId || context.event?.clientId || context.client?.clientId;
  const eventId = payload.eventId || context.event?.eventId;

  // Calculate due date based on event date if applicable
  let dueDate = payload.dueDate;
  if (!dueDate && context.event) {
    // For booking questionnaire check: event date - 2 days
    if (payload.automatedAction === "CheckQuestionnaireReturned") {
      dueDate = createQuestionnaireCheckDate(context.event.date);
    }
    // For training prep: event date - 2 days
    else if (payload.automatedAction === "PrepareTrainingMaterials") {
      dueDate = subtractDaysFromDate(context.event.date, 2);
    }
    // For protocol send: event date + 1 day
    else if (payload.automatedAction === "SendProtocol") {
      dueDate = addDaysToDate(context.event.date, 1);
    }
    else {
      // Default: same as event date
      dueDate = context.event.date;
    }
  }

  if (!dueDate) {
    throw new Error("Cannot create task: dueDate could not be determined");
  }

  const taskInput = {
    clientId: clientId || undefined,
    eventId: eventId || undefined,
    description: payload.description,
    dueDate,
    status: payload.status as any,
    priority: payload.priority as any,
    automatedAction: payload.automatedAction,
    triggeredBy: payload.triggeredBy,
  };

  await createTask(taskInput);
  logger.debug(`[Automation] Created task: ${payload.description}`);
}

/**
 * Execute create.event action
 */
async function executeCreateEvent(
  payload: CreateEventPayload,
  context: AutomationContext
): Promise<void> {
  const clientId = payload.clientId || context.client?.clientId;

  if (!clientId) {
    throw new Error("Cannot create event: clientId is required");
  }

  // Use provided date or current date/time
  const date = payload.date || new Date().toISOString();

  const eventInput = {
    clientId,
    eventType: payload.eventType as any,
    date,
    notes: payload.notes,
    parentEventId: payload.parentEventId || context.event?.eventId,
  };

  await createEvent(eventInput);
  logger.debug(`[Automation] Created event: ${payload.eventType}`);
}

/**
 * Trigger automation for event created
 */
export async function onEventCreated(event: any): Promise<AutomationResult[]> {
  return executeAutomation("event.created", { event });
}

/**
 * Trigger automation for event updated
 */
export async function onEventUpdated(event: any): Promise<AutomationResult[]> {
  return executeAutomation("event.updated", { event });
}

/**
 * Trigger automation for task created
 */
export async function onTaskCreated(task: any): Promise<AutomationResult[]> {
  return executeAutomation("task.created", { task });
}

/**
 * Trigger automation for task updated
 */
export async function onTaskUpdated(task: any): Promise<AutomationResult[]> {
  return executeAutomation("task.updated", { task });
}

/**
 * Trigger automation for client created
 */
export async function onClientCreated(client: any): Promise<AutomationResult[]> {
  return executeAutomation("client.created", { client });
}
