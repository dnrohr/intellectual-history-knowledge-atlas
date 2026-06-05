import { describe, expect, it } from "vitest";
import { composeEvidenceConfidence, normalizeEvidenceConfidence } from "./evidencePolicy";

describe("evidence policy", () => {
  it("splits confidence into normalized components", () => {
    expect(normalizeEvidenceConfidence({
      identity: 1.2,
      factual: -1,
      relationship: 0.8,
    })).toEqual({
      identity: 1,
      factual: 0,
      relationship: 0.8,
      sourceQuality: 0.5,
      extraction: 0.5,
      graphConsistency: 0.5,
    });
  });

  it("composes component confidence into a weighted score", () => {
    expect(composeEvidenceConfidence({
      identity: 1,
      factual: 0.8,
      relationship: 0.7,
      sourceQuality: 0.6,
      extraction: 0.9,
      graphConsistency: 0.5,
    })).toBe(0.755);
  });
});
