import { describe, expect, it } from "vitest";
import {
  BulkEdgeValidationResult,
  createBulkEdgeValidationResult,
  createExistingEdgeValidationSubject,
  validateBulkEdgeStructure,
} from "./edgeValidation";
import { InfluenceEdge, Thinker } from "./types";

const people: Thinker[] = [
  { id: "a", name: "A", birth: 1800, death: 1860, fields: ["Philosophy"] },
  { id: "b", name: "B", birth: 1850, death: 1910, fields: ["Philosophy"] },
  { id: "c", name: "C", birth: 1900, death: 1970, fields: ["Philosophy"] },
];

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

  it("validates structural edge failures deterministically", () => {
    const edges: InfluenceEdge[] = [
      { source: "a", target: "b", type: "Influence", strength: 3 },
      { source: "a", target: "b", type: "Influence", strength: 3 },
      { source: "b", target: "a", type: "Influence", strength: 3 },
      { source: "missing", target: "b", type: "Influence", strength: 3 },
      { source: "a", target: "missing", type: "Influence", strength: 3 },
      { source: "a", target: "a", type: "Influence", strength: 3 },
      { source: "c", target: "a", type: "Influence", strength: 3 },
      { source: "a", target: "b", type: "Mystery", strength: 3 },
    ];

    const results = validateBulkEdgeStructure(people, edges);

    expect(results.map((result) => result.blockingReasons)).toEqual([
      ["duplicate-same-direction", "duplicate-opposite-direction"],
      ["duplicate-same-direction", "duplicate-opposite-direction"],
      ["impossible-chronology", "duplicate-opposite-direction"],
      ["missing-source"],
      ["missing-target"],
      ["self-link"],
      ["impossible-chronology"],
      ["invalid-relationship-type"],
    ]);
    expect(results.every((result) => result.finalDisposition === "removed-existing-edge")).toBe(true);
  });

  it("keeps structurally valid edges open for automated evidence investigation", () => {
    const [result] = validateBulkEdgeStructure(people, [
      { source: "a", target: "b", type: "Influence", strength: 3, confidence: 0.7 },
    ]);

    expect(result).toMatchObject({
      structuralStatus: "valid",
      chronologyStatus: "valid",
      recommendedAction: "auto-investigate",
      finalDisposition: undefined,
      blockingReasons: [],
    });
  });
});
