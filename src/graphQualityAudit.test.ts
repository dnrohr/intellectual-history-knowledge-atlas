import { describe, expect, it } from "vitest";
import { createSourceClaimEntity } from "./knowledgeModel";
import { auditGraphQuality } from "./graphQuality";
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
});
