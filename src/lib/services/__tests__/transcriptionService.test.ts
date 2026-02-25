import { describe, it, expect } from "vitest";
import { estimateTranscriptionCost } from "../transcriptionService";

describe("estimateTranscriptionCost", () => {
  it("returns all zeros for 0 seconds", () => {
    const result = estimateTranscriptionCost(0);
    expect(result.transcription).toBe(0);
    expect(result.total).toBe(0);
    expect(result.whisper).toBe(0);
    expect(result.claude).toBe(0);
  });

  it("returns $0.006 for 60 seconds (1 minute)", () => {
    const result = estimateTranscriptionCost(60);
    expect(result.transcription).toBe(0.006);
    expect(result.total).toBe(0.006);
  });

  it("returns $0.18 for 1800 seconds (30 minutes)", () => {
    const result = estimateTranscriptionCost(1800);
    expect(result.transcription).toBe(0.18);
    expect(result.total).toBe(0.18);
  });

  it("returns $0.36 for 3600 seconds (1 hour)", () => {
    const result = estimateTranscriptionCost(3600);
    expect(result.transcription).toBe(0.36);
    expect(result.total).toBe(0.36);
  });

  it("whisper field equals transcription field (legacy compat)", () => {
    const result = estimateTranscriptionCost(600);
    expect(result.whisper).toBe(result.transcription);
  });

  it("claude field is always 0 (legacy compat)", () => {
    expect(estimateTranscriptionCost(0).claude).toBe(0);
    expect(estimateTranscriptionCost(60).claude).toBe(0);
    expect(estimateTranscriptionCost(3600).claude).toBe(0);
    expect(estimateTranscriptionCost(7200).claude).toBe(0);
  });

  it("total equals transcription (single API, no Claude cost)", () => {
    const result = estimateTranscriptionCost(900);
    expect(result.total).toBe(result.transcription);
  });

  it("handles large durations", () => {
    // 2 hours = 7200 seconds = 120 minutes * $0.006 = $0.72
    const result = estimateTranscriptionCost(7200);
    expect(result.transcription).toBe(0.72);
    expect(result.total).toBe(0.72);
  });

  it("rounds to 4 decimal places", () => {
    // 90 seconds = 1.5 minutes * $0.006 = $0.009
    const result = estimateTranscriptionCost(90);
    expect(result.transcription).toBe(0.009);
    // Check string representation has at most 4 decimals
    expect(result.transcription.toString().split(".")[1]?.length).toBeLessThanOrEqual(4);
  });
});
