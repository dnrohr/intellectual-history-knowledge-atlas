import { describe, expect, it } from "vitest";
import {
  buildCanonicalDataset,
  createCanonicalDatasetBuildInputs,
  generateCanonicalClaimChangelog,
} from "./canonicalDataset";
import { SourceClaimEntity } from "./types";

const makeClaim = (
  id: string,
  overrides: Partial<SourceClaimEntity> = {}
): SourceClaimEntity => ({
  id,
  type: "SourceClaim",
  label: id,
  sourceName: "Manual",
  sourceType: "reference",
  sourceReliability: 0.7,
  extractionMethod: "manual_seed",
  subjectEntityId: "person:a",
  subjectEntityType: "Person",
  field: "name",
  value: "A",
  confidence: 0.8,
  status: "accepted",
  ...overrides,
});

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

  it("generates deterministic canonical dataset output", () => {
    const output = buildCanonicalDataset({
      seedData: {
        people: [
          { id: "b", name: "B", birth: 1900, death: null, fields: ["Logic"] },
          { id: "a", name: "A", birth: 1800, death: null, fields: ["Logic"] },
        ],
        edges: [
          { source: "b", target: "a", type: "Influence", strength: 2 },
        ],
      },
      sourceAdapterOutputs: [],
      claimRecords: [{
        id: "claim:b",
        type: "SourceClaim",
        label: "B",
        sourceName: "Manual",
        sourceType: "reference",
        sourceReliability: 0.7,
        extractionMethod: "manual_seed",
        subjectEntityId: "person:b",
        subjectEntityType: "Person",
        field: "name",
        value: "B",
        confidence: 0.8,
        status: "accepted",
      }, {
        id: "claim:a",
        type: "SourceClaim",
        label: "A",
        sourceName: "Manual",
        sourceType: "reference",
        sourceReliability: 0.7,
        extractionMethod: "manual_seed",
        subjectEntityId: "person:a",
        subjectEntityType: "Person",
        field: "name",
        value: "A",
        confidence: 0.8,
        status: "accepted",
      }],
      acceptancePolicies: {},
      manualOverrides: [],
      repairDecisions: [{
        id: "repair:add-a-c",
        accepted: true,
        decidedAt: "2026-06-05T00:00:00.000Z",
        reason: "Accepted repair",
        diffs: [{
          action: "add-edge",
          reason: "Add missing edge",
          edge: { source: "a", target: "c", type: "Influence", strength: 3 },
        }],
      }],
    });

    expect(output.people.map((person) => person.id)).toEqual(["a", "b"]);
    expect(output.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(["a->c", "b->a"]);
    expect(output.claims.map((claim) => claim.id)).toEqual(["claim:a", "claim:b"]);
    expect(output.metadata).toMatchObject({
      datasetVersion: "canonical-v1",
      generator: "buildCanonicalDataset",
      inputCounts: {
        people: 2,
        edges: 1,
        claims: 2,
        sourceAdapterOutputs: 0,
        manualOverrides: 0,
        repairDecisions: 1,
      },
    });
    expect(output.metadata.contentFingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("generates deterministic claim changelog categories", () => {
    const previous = [
      makeClaim("claim:changed", { value: "Original" }),
      makeClaim("claim:demoted"),
      makeClaim("claim:rejected"),
      makeClaim("claim:conflicting"),
      makeClaim("claim:stable"),
    ];
    const current = [
      makeClaim("claim:stable"),
      makeClaim("claim:conflicting", { status: "conflicting" }),
      makeClaim("claim:rejected", { status: "rejected" }),
      makeClaim("claim:demoted", { status: "candidate" }),
      makeClaim("claim:changed", { value: "Corrected" }),
      makeClaim("claim:added"),
    ];

    const changelog = generateCanonicalClaimChangelog(previous, current);

    expect(changelog.added.map((entry) => entry.claimId)).toEqual(["claim:added"]);
    expect(changelog.changed.map((entry) => entry.claimId)).toEqual(["claim:changed"]);
    expect(changelog.demoted.map((entry) => entry.claimId)).toEqual(["claim:demoted"]);
    expect(changelog.rejected.map((entry) => entry.claimId)).toEqual(["claim:rejected"]);
    expect(changelog.conflicting.map((entry) => entry.claimId)).toEqual(["claim:conflicting"]);
    expect(changelog.demoted[0]).toMatchObject({
      previousStatus: "accepted",
      currentStatus: "candidate",
      subjectEntityId: "person:a",
      field: "name",
    });
  });
});
