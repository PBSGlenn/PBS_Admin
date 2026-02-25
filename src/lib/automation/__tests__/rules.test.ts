import { describe, it, expect } from "vitest";
import {
  getRulesForTrigger,
  getRuleById,
  bookingQuestionnaireRule,
  consultationFollowUpRule,
  trainingSessionPrepRule,
  clientCreationNoteRule,
  questionnaireReceivedReviewRule,
  automationRules,
} from "../rules";
import type { AutomationContext } from "../types";

describe("automationRules registry", () => {
  it("contains all 5 rules", () => {
    expect(automationRules).toHaveLength(5);
  });

  it("all rules are enabled", () => {
    for (const rule of automationRules) {
      expect(rule.enabled).toBe(true);
    }
  });

  it("all rules have unique IDs", () => {
    const ids = automationRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getRulesForTrigger", () => {
  it("returns booking + training + questionnaire rules for event.created", () => {
    const rules = getRulesForTrigger("event.created");
    expect(rules).toHaveLength(3);
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("booking-questionnaire-check");
    expect(ids).toContain("training-session-prep");
    expect(ids).toContain("questionnaire-received-review");
  });

  it("returns consultation follow-up rule for event.updated", () => {
    const rules = getRulesForTrigger("event.updated");
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("consultation-follow-up");
  });

  it("returns client creation note rule for client.created", () => {
    const rules = getRulesForTrigger("client.created");
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("client-creation-note");
  });

  it("returns empty array for task.created", () => {
    const rules = getRulesForTrigger("task.created");
    expect(rules).toHaveLength(0);
  });

  it("returns empty array for task.updated", () => {
    const rules = getRulesForTrigger("task.updated");
    expect(rules).toHaveLength(0);
  });

  it("returns empty array for nonexistent trigger", () => {
    const rules = getRulesForTrigger("nonexistent");
    expect(rules).toHaveLength(0);
  });
});

describe("getRuleById", () => {
  it("returns booking questionnaire rule by ID", () => {
    const rule = getRuleById("booking-questionnaire-check");
    expect(rule).toBeDefined();
    expect(rule!.name).toBe("Booking → Questionnaire Check Task");
  });

  it("returns consultation follow-up rule by ID", () => {
    const rule = getRuleById("consultation-follow-up");
    expect(rule).toBeDefined();
    expect(rule!.trigger).toBe("event.updated");
  });

  it("returns undefined for nonexistent ID", () => {
    const rule = getRuleById("nonexistent");
    expect(rule).toBeUndefined();
  });
});

describe("rule conditions", () => {
  describe("bookingQuestionnaireRule", () => {
    it("returns true when eventType is Booking", () => {
      const context: AutomationContext = {
        event: { eventType: "Booking" } as any,
      };
      expect(bookingQuestionnaireRule.condition(context)).toBe(true);
    });

    it("returns false when eventType is Consultation", () => {
      const context: AutomationContext = {
        event: { eventType: "Consultation" } as any,
      };
      expect(bookingQuestionnaireRule.condition(context)).toBe(false);
    });

    it("returns false when event is undefined", () => {
      const context: AutomationContext = {};
      expect(bookingQuestionnaireRule.condition(context)).toBe(false);
    });
  });

  describe("consultationFollowUpRule", () => {
    it("returns true when Consultation and Completed", () => {
      const context: AutomationContext = {
        event: {
          eventType: "Consultation",
          calendlyStatus: "Completed",
        } as any,
      };
      expect(consultationFollowUpRule.condition(context)).toBe(true);
    });

    it("returns false when Consultation but not Completed", () => {
      const context: AutomationContext = {
        event: {
          eventType: "Consultation",
          calendlyStatus: "Scheduled",
        } as any,
      };
      expect(consultationFollowUpRule.condition(context)).toBe(false);
    });

    it("returns false when Completed but not Consultation", () => {
      const context: AutomationContext = {
        event: {
          eventType: "Booking",
          calendlyStatus: "Completed",
        } as any,
      };
      expect(consultationFollowUpRule.condition(context)).toBe(false);
    });

    it("returns false when event is undefined", () => {
      const context: AutomationContext = {};
      expect(consultationFollowUpRule.condition(context)).toBe(false);
    });
  });

  describe("trainingSessionPrepRule", () => {
    it("returns true when eventType is TrainingSession", () => {
      const context: AutomationContext = {
        event: { eventType: "TrainingSession" } as any,
      };
      expect(trainingSessionPrepRule.condition(context)).toBe(true);
    });

    it("returns false for other event types", () => {
      const context: AutomationContext = {
        event: { eventType: "Booking" } as any,
      };
      expect(trainingSessionPrepRule.condition(context)).toBe(false);
    });
  });

  describe("clientCreationNoteRule", () => {
    it("returns true when client is defined", () => {
      const context: AutomationContext = {
        client: { clientId: 1, firstName: "Test" } as any,
      };
      expect(clientCreationNoteRule.condition(context)).toBe(true);
    });

    it("returns false when client is undefined", () => {
      const context: AutomationContext = {};
      expect(clientCreationNoteRule.condition(context)).toBe(false);
    });
  });

  describe("questionnaireReceivedReviewRule", () => {
    it("returns true when eventType is QuestionnaireReceived", () => {
      const context: AutomationContext = {
        event: { eventType: "QuestionnaireReceived" } as any,
      };
      expect(questionnaireReceivedReviewRule.condition(context)).toBe(true);
    });

    it("returns false for other event types", () => {
      const context: AutomationContext = {
        event: { eventType: "Note" } as any,
      };
      expect(questionnaireReceivedReviewRule.condition(context)).toBe(false);
    });
  });
});

describe("rule actions", () => {
  it("booking rule has create.task action", () => {
    expect(bookingQuestionnaireRule.actions).toHaveLength(1);
    expect(bookingQuestionnaireRule.actions[0].type).toBe("create.task");
  });

  it("booking rule task has correct automatedAction", () => {
    const payload = bookingQuestionnaireRule.actions[0].payload;
    expect(payload.automatedAction).toBe("CheckQuestionnaireReturned");
    expect(payload.triggeredBy).toBe("Event:Booking");
    expect(payload.priority).toBe(1);
    expect(payload.status).toBe("Pending");
  });

  it("consultation rule creates SendProtocol task", () => {
    const payload = consultationFollowUpRule.actions[0].payload;
    expect(payload.automatedAction).toBe("SendProtocol");
    expect(payload.triggeredBy).toBe("Event:Consultation");
  });

  it("training rule creates PrepareTrainingMaterials task", () => {
    const payload = trainingSessionPrepRule.actions[0].payload;
    expect(payload.automatedAction).toBe("PrepareTrainingMaterials");
  });

  it("client creation rule creates Note event", () => {
    expect(clientCreationNoteRule.actions[0].type).toBe("create.event");
    expect(clientCreationNoteRule.actions[0].payload.eventType).toBe("Note");
  });

  it("questionnaire rule creates ReviewQuestionnaire task", () => {
    const payload = questionnaireReceivedReviewRule.actions[0].payload;
    expect(payload.automatedAction).toBe("ReviewQuestionnaire");
  });
});
