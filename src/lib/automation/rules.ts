// PBS Admin - Automation Rules Definitions

import type { AutomationRule } from "./types";
import { QUESTIONNAIRE_CHECK_HOURS_BEFORE } from "../constants";

/**
 * Rule: When a Booking event is created, auto-create a questionnaire check task
 * This task is due 48 hours before the consultation
 */
export const bookingQuestionnaireRule: AutomationRule = {
  id: "booking-questionnaire-check",
  name: "Booking → Questionnaire Check Task",
  description: "Automatically create a task to check questionnaire return 48 hours before booking",
  trigger: "event.created",
  condition: (context) => {
    return context.event?.eventType === "Booking";
  },
  actions: [
    {
      type: "create.task",
      payload: {
        description: `Check questionnaire returned ≥ ${QUESTIONNAIRE_CHECK_HOURS_BEFORE} hours before consultation`,
        status: "Pending",
        priority: 1,
        automatedAction: "CheckQuestionnaireReturned",
        triggeredBy: "Event:Booking",
        // clientId and eventId will be populated dynamically
        // dueDate will be calculated as event.date - 48 hours
      },
    },
  ],
  enabled: true,
};

/**
 * Rule: When a Consultation event is completed, suggest follow-up tasks
 */
export const consultationFollowUpRule: AutomationRule = {
  id: "consultation-follow-up",
  name: "Consultation → Follow-Up Tasks",
  description: "Suggest follow-up tasks after a consultation is marked complete",
  trigger: "event.updated",
  condition: (context) => {
    return (
      context.event?.eventType === "Consultation" &&
      context.event?.calendlyStatus === "Completed"
    );
  },
  actions: [
    {
      type: "create.task",
      payload: {
        description: "Send protocol document to client",
        status: "Pending",
        priority: 2,
        automatedAction: "SendProtocol",
        triggeredBy: "Event:Consultation",
      },
    },
  ],
  enabled: true,
};

/**
 * Rule: When a Training Session is created, create preparation task
 */
export const trainingSessionPrepRule: AutomationRule = {
  id: "training-session-prep",
  name: "Training Session → Preparation Task",
  description: "Create a task to prepare materials 2 days before training session",
  trigger: "event.created",
  condition: (context) => {
    return context.event?.eventType === "TrainingSession";
  },
  actions: [
    {
      type: "create.task",
      payload: {
        description: "Prepare training session materials",
        status: "Pending",
        priority: 2,
        automatedAction: "PrepareTrainingMaterials",
        triggeredBy: "Event:TrainingSession",
      },
    },
  ],
  enabled: true,
};

/**
 * Rule: When a client is created, auto-create a note event
 */
export const clientCreationNoteRule: AutomationRule = {
  id: "client-creation-note",
  name: "Client Created → Note Event",
  description: "Automatically create a note event when a new client is created",
  trigger: "client.created",
  condition: (context) => {
    return context.client !== undefined;
  },
  actions: [
    {
      type: "create.event",
      payload: {
        eventType: "Note",
        notes: "Client created",
        // clientId and date will be populated dynamically
      },
    },
  ],
  enabled: true,
};

/**
 * Rule: When a questionnaire is received, create a review task
 */
export const questionnaireReceivedReviewRule: AutomationRule = {
  id: "questionnaire-received-review",
  name: "Questionnaire Received → Review Task",
  description: "Create a task to review questionnaire data and reconcile with client/pet records",
  trigger: "event.created",
  condition: (context) => {
    return context.event?.eventType === "QuestionnaireReceived";
  },
  actions: [
    {
      type: "create.task",
      payload: {
        description: "Review questionnaire and reconcile client/pet information",
        status: "Pending",
        priority: 2,
        automatedAction: "ReviewQuestionnaire",
        triggeredBy: "Event:QuestionnaireReceived",
      },
    },
  ],
  enabled: true,
};

/**
 * All automation rules registry
 */
export const automationRules: AutomationRule[] = [
  bookingQuestionnaireRule,
  consultationFollowUpRule,
  trainingSessionPrepRule,
  clientCreationNoteRule,
  questionnaireReceivedReviewRule,
];

/**
 * Get enabled rules for a specific trigger
 */
export function getRulesForTrigger(trigger: string): AutomationRule[] {
  return automationRules.filter((rule) => rule.enabled && rule.trigger === trigger);
}

/**
 * Get rule by ID
 */
export function getRuleById(id: string): AutomationRule | undefined {
  return automationRules.find((rule) => rule.id === id);
}
