import { describe, it, expect } from "vitest";
import {
  calculateDueDate,
  isValidOffset,
  formatOffset,
} from "../dateOffsetUtils";

describe("calculateDueDate", () => {
  const baseDate = "2025-11-15T10:00:00.000Z";

  it("adds 3 days", () => {
    const result = calculateDueDate(baseDate, "3 days");
    const resultDate = new Date(result);
    const base = new Date(baseDate);
    const diffMs = resultDate.getTime() - base.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(3);
  });

  it("adds 1 week (7 days)", () => {
    const result = calculateDueDate(baseDate, "1 week");
    const resultDate = new Date(result);
    const base = new Date(baseDate);
    const diffMs = resultDate.getTime() - base.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it("adds 48 hours (2 days)", () => {
    const result = calculateDueDate(baseDate, "48 hours");
    const resultDate = new Date(result);
    const base = new Date(baseDate);
    const diffMs = resultDate.getTime() - base.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    expect(diffHours).toBe(48);
  });

  it("adds 2 months", () => {
    const result = calculateDueDate(baseDate, "2 months");
    const resultDate = new Date(result);
    // November + 2 months = January
    expect(resultDate.getMonth()).toBe(0); // January (0-indexed)
  });

  it("adds 1 day", () => {
    const result = calculateDueDate(baseDate, "1 day");
    const resultDate = new Date(result);
    const base = new Date(baseDate);
    const diffMs = resultDate.getTime() - base.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(1);
  });

  it("defaults to 1 week for unrecognized input", () => {
    const result = calculateDueDate(baseDate, "invalid");
    const resultDate = new Date(result);
    const base = new Date(baseDate);
    const diffMs = resultDate.getTime() - base.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it("returns valid ISO string", () => {
    const result = calculateDueDate(baseDate, "3 days");
    // Should be parseable as a date
    expect(new Date(result).toString()).not.toBe("Invalid Date");
  });
});

describe("isValidOffset", () => {
  it("returns true for '3 days'", () => {
    expect(isValidOffset("3 days")).toBe(true);
  });

  it("returns true for '1 week'", () => {
    expect(isValidOffset("1 week")).toBe(true);
  });

  it("returns true for '48 hours'", () => {
    expect(isValidOffset("48 hours")).toBe(true);
  });

  it("returns true for '2 months'", () => {
    expect(isValidOffset("2 months")).toBe(true);
  });

  it("returns true for '1 day' (singular)", () => {
    expect(isValidOffset("1 day")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidOffset("")).toBe(false);
  });

  it("returns false for 'hello'", () => {
    expect(isValidOffset("hello")).toBe(false);
  });

  it("returns false for 'days' (no number)", () => {
    expect(isValidOffset("days")).toBe(false);
  });

  it("returns false for '42' (no unit)", () => {
    expect(isValidOffset("42")).toBe(false);
  });
});

describe("formatOffset", () => {
  it("normalizes '1 days' to '1 day' (singularize)", () => {
    expect(formatOffset("1 days")).toBe("1 day");
  });

  it("keeps '3 days' as is", () => {
    expect(formatOffset("3 days")).toBe("3 days");
  });

  it("normalizes '1 weeks' to '1 week'", () => {
    expect(formatOffset("1 weeks")).toBe("1 week");
  });

  it("normalizes uppercase '2 DAYS' to '2 days'", () => {
    expect(formatOffset("2 DAYS")).toBe("2 days");
  });

  it("trims whitespace", () => {
    expect(formatOffset("  3 days  ")).toBe("3 days");
  });

  it("returns original for unparseable input", () => {
    expect(formatOffset("hello")).toBe("hello");
  });
});
