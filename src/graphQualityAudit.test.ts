import { describe, expect, it } from "vitest";
import { createSourceClaimEntity } from "./knowledgeModel";
import { auditGraphQuality, getDryRunRepairJobTriggers, planIsolatedNodeConnections } from "./graphQuality";
import { Thinker } from "./types";

const person = (overrides: Partial<Thinker>): Thinker => ({
  id: "person",
  name: "Person",
  birth: 1900,
  death: null,
  fields: ["Philosophy"],
  ...overrides,
});

describe("graph quality audits", () => {
  it("detects common graph quality problems", () => {
    const findings = auditGraphQuality([
      person({ id: "a", name: "Duplicate", bridge_score: 5 }),
      person({ id: "b", name: "Duplicate", death: 1800 }),
      person({ id: "c", name: "Connected", works: ["Work"], region: "France", subfields: ["Logic"] }),
    ], [
      { source: "c", target: "missing", type: "Influence", strength: 3 },
    ], [
      createSourceClaimEntity({
        id: "claim:stale",
        sourceName: "Old",
        sourceUrl: "https://example.com",
        observedAt: "2000-01-01T00:00:00.000Z",
        subjectEntityId: "person:a",
        subjectEntityType: "Person",
        field: "birth",
        value: "1900",
      }),
    ], new Date("2026-06-05T00:00:00.000Z"));

    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "dangling-reference",
      "unsupported-edge",
      "isolated-node",
      "sparse-high-bridge-node",
      "impossible-dates",
      "missing-works",
      "missing-institutions",
      "over-broad-tag",
      "duplicate-entity-risk",
      "stale-source-claim",
    ]));
  });

  it("triggers dry-run repair jobs when critical thresholds are reached", () => {
    expect(getDryRunRepairJobTriggers([
      { code: "dangling-reference", severity: "critical", targetId: "edge", message: "bad" },
      { code: "unsupported-edge", severity: "warning", targetId: "edge", message: "weak" },
      { code: "isolated-node", severity: "warning", targetId: "a", message: "isolated" },
    ], { criticalFindings: 1, warningFindings: 2 })).toEqual([
      {
        id: "repair:critical-findings",
        dryRun: true,
        reason: "1 critical graph quality findings",
        findingCodes: ["dangling-reference"],
      },
      {
        id: "repair:warning-findings",
        dryRun: true,
        reason: "2 warning graph quality findings",
        findingCodes: ["unsupported-edge", "isolated-node"],
      },
    ]);
  });

  it("plans isolated-node connections from high-confidence relationship candidates", () => {
    expect(planIsolatedNodeConnections([
      person({ id: "a" }),
      person({ id: "b" }),
      person({ id: "c" }),
    ], [
      { source: "b", target: "c", type: "Influence", strength: 3 },
    ], [{
      id: "candidate",
      category: "direct mentorship",
      status: "suggested",
      confidence: 0.9,
      evidence: ["advisor/student evidence"],
      relationship: {
        id: "relationship:person:b:person mentored person:person:a",
        type: "Relationship",
        label: "b mentored a",
        source: { entityId: "person:b", entityType: "Person" },
        target: { entityId: "person:a", entityType: "Person" },
        relationshipType: "person mentored person",
      },
    }])).toEqual([{
      action: "add-edge",
      reason: "Connect isolated node through validated high-confidence relationship candidate.",
      edge: {
        source: "b",
        target: "a",
        type: "person mentored person",
        strength: 5,
        confidence: 0.9,
        status: "suggested",
        claimIds: [],
      },
    }]);
  });
});
