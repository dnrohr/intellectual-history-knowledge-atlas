import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_THRESHOLDS_BY_CLAIM_TYPE,
  applyStrictAcceptanceModifiers,
  composeEvidenceConfidence,
  getAcceptanceThreshold,
  normalizeEvidenceConfidence,
} from "./evidencePolicy";

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

  it("defines testable acceptance thresholds by claim type", () => {
    expect(ACCEPTANCE_THRESHOLDS_BY_CLAIM_TYPE.direct_influence.accept).toBeGreaterThan(
      ACCEPTANCE_THRESHOLDS_BY_CLAIM_TYPE.basic_metadata.accept
    );
    expect(getAcceptanceThreshold("external_id")).toEqual({ accept: 0.7, provisional: 0.5 });
  });

  it("uses stricter thresholds for high-risk acceptance contexts", () => {
    expect(applyStrictAcceptanceModifiers({ accept: 0.85, provisional: 0.65 }, {
      directInfluence: true,
      canonicalThreadEdge: true,
      crossCenturyJump: true,
      highBridgeScoreNode: true,
      disputedOrSparseTopic: true,
    })).toEqual({
      accept: 0.99,
      provisional: 0.75,
    });
  });
});
