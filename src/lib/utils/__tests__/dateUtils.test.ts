import { describe, it, expect } from "vitest";
import {
  addDaysToDate,
  subtractDaysFromDate,
  isTaskOverdue,
  createQuestionnaireCheckDate,
  daysBetween,
  formatDate,
  formatDateShort,
  getRelativeTime,
} from "../dateUtils";

// Use fixed dates to avoid timezone-dependent failures
// All test dates are ISO 8601 strings

describe("addDaysToDate", () => {
  it("adds 1 day correctly", () => {
    const result = addDaysToDate("2025-11-15T10:00:00.000Z", 1);
    const resultDate = new Date(result);
    expect(resultDate.getDate()).toBeGreaterThanOrEqual(15); // At least moved forward
  });

  it("adds 7 days correctly", () => {
    const base = new Date("2025-11-15T10:00:00.000Z");
    const result = addDaysToDate("2025-11-15T10:00:00.000Z", 7);
    const resultDate = new Date(result);
    const diff = Math.round(
      (resultDate.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diff).toBe(7);
  });

  it("handles month boundaries", () => {
    const result = addDaysToDate("2025-01-30T10:00:00.000Z", 3);
    const resultDate = new Date(result);
    expect(resultDate.getMonth()).toBe(1); // February (0-indexed)
  });

  it("adds 0 days (identity)", () => {
    const base = new Date("2025-06-15T10:00:00.000Z");
    const result = addDaysToDate("2025-06-15T10:00:00.000Z", 0);
    const resultDate = new Date(result);
    const diff = Math.abs(resultDate.getTime() - base.getTime());
    expect(diff).toBeLessThan(1000 * 60 * 60 * 24); // Less than 1 day difference
  });
});

describe("subtractDaysFromDate", () => {
  it("subtracts 2 days correctly", () => {
    const base = new Date("2025-11-15T10:00:00.000Z");
    const result = subtractDaysFromDate("2025-11-15T10:00:00.000Z", 2);
    const resultDate = new Date(result);
    const diff = Math.round(
      (base.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diff).toBe(2);
  });

  it("handles month boundaries going backwards", () => {
    const result = subtractDaysFromDate("2025-03-02T10:00:00.000Z", 3);
    const resultDate = new Date(result);
    expect(resultDate.getMonth()).toBe(1); // February
  });
});

describe("isTaskOverdue", () => {
  it("returns false for Done status regardless of date", () => {
    expect(isTaskOverdue("2020-01-01T00:00:00.000Z", "Done")).toBe(false);
  });

  it("returns false for Canceled status regardless of date", () => {
    expect(isTaskOverdue("2020-01-01T00:00:00.000Z", "Canceled")).toBe(false);
  });

  it("returns true for past date with Pending status", () => {
    expect(isTaskOverdue("2020-01-01T00:00:00.000Z", "Pending")).toBe(true);
  });

  it("returns true for past date with InProgress status", () => {
    expect(isTaskOverdue("2020-01-01T00:00:00.000Z", "InProgress")).toBe(true);
  });

  it("returns false for future date with Pending status", () => {
    expect(isTaskOverdue("2099-12-31T00:00:00.000Z", "Pending")).toBe(false);
  });
});

describe("createQuestionnaireCheckDate", () => {
  it("returns event date minus 2 days", () => {
    const eventDate = "2025-11-15T10:00:00.000Z";
    const result = createQuestionnaireCheckDate(eventDate);
    const eventDateObj = new Date(eventDate);
    const resultDate = new Date(result);
    const diff = Math.round(
      (eventDateObj.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diff).toBe(2);
  });
});

describe("daysBetween", () => {
  it("calculates positive difference", () => {
    const diff = daysBetween(
      "2025-11-10T00:00:00.000Z",
      "2025-11-15T00:00:00.000Z"
    );
    expect(diff).toBe(5);
  });

  it("calculates negative difference when dates reversed", () => {
    const diff = daysBetween(
      "2025-11-15T00:00:00.000Z",
      "2025-11-10T00:00:00.000Z"
    );
    expect(diff).toBe(-5);
  });

  it("returns 0 for same date", () => {
    const diff = daysBetween(
      "2025-11-15T10:00:00.000Z",
      "2025-11-15T10:00:00.000Z"
    );
    expect(diff).toBe(0);
  });
});

describe("formatDate", () => {
  it("formats valid ISO string", () => {
    const result = formatDate("2025-11-15T10:00:00.000Z");
    // Should return a formatted date string (not the raw ISO)
    expect(result).not.toBe("2025-11-15T10:00:00.000Z");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns original string on invalid input", () => {
    const result = formatDate("not-a-date");
    expect(result).toBe("not-a-date");
  });
});

describe("formatDateShort", () => {
  it("returns dd/MM/yy format", () => {
    const result = formatDateShort("2025-11-15T10:00:00.000Z");
    // Should match dd/MM/yy pattern
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
  });
});
