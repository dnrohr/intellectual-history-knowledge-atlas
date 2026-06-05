import { describe, expect, it } from "vitest";
import {
  BulkEdgeValidationResult,
  createBulkEdgeValidationResult,
  createExistingEdgeValidationSubject,
} from "./edgeValidation";

describe("bulk edge validation model", () => {
  it("models existing edge validation with final confirmed or removed dispositions", () => {
    const subject = createExistingEdgeValidationSubject({
      id: "edge:arendt-benjamin",
      source: "benjamin",
      target: "arendt",
      type: "Influence",
      strength: 4,
      confidence: 0.91,
      claimIds: ["claim:benjamin-arendt"],
      sourceClaims: ["https://example.test/source"],
    });

    const result: BulkEdgeValidationResult = createBulkEdgeValidationResult({
      id: "validation:edge:arendt-benjamin",
      origin: "existing-edge",
      subject,
      structuralStatus: "valid",
      evidenceStatus: "supported",
      chronologyStatus: "valid",
      sourceClaimCoverage: 1,
      confidenceScore: 0.91,
      recommendedAction: "confirm",
      finalDisposition: "confirmed-existing-edge",
      blockingReasons: [],
    });

    expect(result).toMatchObject({
      origin: "existing-edge",
      recommendedAction: "confirm",
      finalDisposition: "confirmed-existing-edge",
      subject: {
        source: { id: "benjamin" },
        target: { id: "arendt" },
        claimIds: ["claim:benjamin-arendt"],
        sourceUrls: ["https://example.test/source"],
      },
    });
  });

  it("models discovered candidates as add or discard outcomes without manual review", () => {
    const result: BulkEdgeValidationResult = createBulkEdgeValidationResult({
      id: "validation:candidate:mentor",
      origin: "discovered-candidate",
      subject: {
        id: "candidate:mentor",
        source: { id: "husserl" },
        target: { id: "heidegger" },
        type: "person mentored person",
        claimIds: ["claim:mentor"],
        sourceUrls: [],
      },
      structuralStatus: "valid",
      evidenceStatus: "supported",
      chronologyStatus: "valid",
      sourceClaimCoverage: 1,
      confidenceScore: 0.93,
      recommendedAction: "add",
      finalDisposition: "added-confirmed-edge",
      blockingReasons: [],
    });

    expect(result.recommendedAction).toBe("add");
    expect(result.finalDisposition).toBe("added-confirmed-edge");
  });
});
