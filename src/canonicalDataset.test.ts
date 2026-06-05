import { describe, expect, it } from "vitest";
import { createCanonicalDatasetBuildInputs } from "./canonicalDataset";

describe("canonical dataset build inputs", () => {
  it("defines the required canonical dataset input lanes", () => {
    const inputs = createCanonicalDatasetBuildInputs({
      seedData: {
        people: [{ id: "a", name: "A", birth: 1900, death: null, fields: ["Logic"] }],
        edges: [{ source: "a", target: "b", type: "Influence", strength: 3 }],
      },
      sourceAdapterOutputs: [{
        adapterId: "manual-source",
        observations: [],
        claims: [],
        records: [],
      }],
      claimRecords: [],
      acceptancePolicies: {
        relationship: { accept: 0.85, provisional: 0.65 },
      },
      manualOverrides: [{
        id: "override:1",
        targetId: "a",
        targetType: "Person",
        action: "annotate",
        reason: "Curator note",
      }],
      repairDecisions: [{
        id: "repair:1",
        accepted: false,
        decidedAt: "2026-06-05T00:00:00.000Z",
        diffs: [],
        reason: "Dry run only",
      }],
    });

    expect(Object.keys(inputs)).toEqual([
      "seedData",
      "sourceAdapterOutputs",
      "claimRecords",
      "acceptancePolicies",
      "manualOverrides",
      "repairDecisions",
    ]);
    expect(inputs.seedData.people[0].id).toBe("a");
    expect(inputs.acceptancePolicies.relationship.accept).toBe(0.85);
  });
});
