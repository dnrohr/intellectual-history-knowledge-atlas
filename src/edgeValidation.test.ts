import { describe, expect, it } from "vitest";
import {
  BulkEdgeValidationResult,
  addConfirmedMissingEdgesToCanonicalGraph,
  createBulkEdgeValidationResult,
  createExistingEdgeValidationSubject,
  deduplicateMissingEdgeCandidates,
  generateMissingEdgeCandidates,
  validateDiscoveredEdgeCandidates,
  validateBulkEdgeEvidence,
  validateBulkEdgeRelationshipRules,
  validateBulkEdgeStructure,
} from "./edgeValidation";
import { InfluenceEdge, SourceClaimEntity, Thinker } from "./types";

const people: Thinker[] = [
  { id: "a", name: "A", birth: 1800, death: 1860, fields: ["Philosophy"], movement: "Idealism", region: "Europe" },
  { id: "b", name: "B", birth: 1850, death: 1910, fields: ["Philosophy"], movement: "Idealism", region: "Europe" },
  { id: "c", name: "C", birth: 1900, death: 1970, fields: ["Philosophy"], movement: "Pragmatism", region: "US" },
];

const relationshipClaim = (
  id: string,
  overrides: Partial<SourceClaimEntity> = {}
): SourceClaimEntity => ({
  id,
  type: "SourceClaim",
  label: id,
  sourceName: "Manual",
  sourceType: "reference",
  sourceReliability: 0.8,
  extractionMethod: "manual_seed",
  subjectEntityId: "edge:ab",
  subjectEntityType: "Relationship",
  field: "relationshipType",
  value: "Influence",
  confidence: 0.86,
  status: "accepted",
  ...overrides,
});

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

  it("confirms structurally valid edges with usable relationship evidence", () => {
    const [result] = validateBulkEdgeEvidence(
      people,
      [{
        id: "edge:ab",
        source: "a",
        target: "b",
        type: "Influence",
        strength: 3,
        confidence: 0.9,
        claimIds: ["claim:ab"],
      }],
      [relationshipClaim("claim:ab")]
    );

    expect(result).toMatchObject({
      evidenceStatus: "supported",
      sourceClaimCoverage: 1,
      recommendedAction: "confirm",
      finalDisposition: "confirmed-existing-edge",
      blockingReasons: [],
    });
  });

  it("routes missing or weak evidence to automated investigation", () => {
    const results = validateBulkEdgeEvidence(
      people,
      [
        { id: "edge:missing", source: "a", target: "b", type: "Influence", strength: 3 },
        {
          id: "edge:endpoint-only",
          source: "b",
          target: "c",
          type: "Influence",
          strength: 3,
          claimIds: ["claim:endpoint"],
        },
        {
          id: "edge:weak",
          source: "a",
          target: "c",
          type: "Influence",
          strength: 5,
          confidence: 0.4,
          claimIds: ["claim:weak"],
        },
      ],
      [
        relationshipClaim("claim:endpoint", {
          subjectEntityId: "person:a",
          subjectEntityType: "Person",
          field: "existence",
        }),
        relationshipClaim("claim:weak", { subjectEntityId: "edge:weak" }),
      ]
    );

    expect(results.map((result) => result.blockingReasons)).toEqual([
      ["missing-source-evidence"],
      ["endpoint-only-source-claims"],
      ["weak-confidence-high-impact-edge"],
    ]);
    expect(results.map((result) => result.recommendedAction)).toEqual([
      "auto-investigate",
      "auto-investigate",
      "auto-investigate",
    ]);
  });

  it("detects stale and rejected or conflicting source claims on accepted edges", () => {
    const results = validateBulkEdgeEvidence(
      people,
      [
        {
          id: "edge:stale",
          source: "a",
          target: "b",
          type: "Influence",
          strength: 3,
          claimIds: ["claim:stale"],
        },
        {
          id: "edge:conflict",
          source: "b",
          target: "c",
          type: "Influence",
          strength: 3,
          confidence: 0.9,
          status: "accepted",
          claimIds: ["claim:conflict"],
        },
      ],
      [
        relationshipClaim("claim:stale", {
          subjectEntityId: "edge:stale",
          status: "stale",
          observedAt: "2000-01-01T00:00:00.000Z",
        }),
        relationshipClaim("claim:conflict", {
          subjectEntityId: "edge:conflict",
          status: "conflicting",
        }),
      ],
      new Date("2026-06-05T00:00:00.000Z")
    );

    expect(results[0]).toMatchObject({
      evidenceStatus: "unsupported",
      blockingReasons: ["stale-source-claim"],
    });
    expect(results[1]).toMatchObject({
      evidenceStatus: "conflicting",
      blockingReasons: ["rejected-or-conflicting-claim-on-accepted-edge"],
    });
  });

  it("applies relationship-type-specific evidence rules", () => {
    const results = validateBulkEdgeRelationshipRules(
      people,
      [
        {
          id: "edge:direct-ok",
          source: "a",
          target: "b",
          type: "Influence",
          strength: 3,
          confidence: 0.9,
          note: "Explicit influence documented through citation reception.",
          claimIds: ["claim:direct-ok"],
        },
        {
          id: "edge:direct-weak",
          source: "b",
          target: "c",
          type: "Influence",
          strength: 3,
          confidence: 0.9,
          note: "Shared movement only.",
          claimIds: ["claim:direct-weak"],
        },
        {
          id: "edge:mentor-weak",
          source: "a",
          target: "c",
          type: "Mentorship",
          strength: 3,
          confidence: 0.9,
          note: "Same university.",
          claimIds: ["claim:mentor-weak"],
        },
      ],
      [
        relationshipClaim("claim:direct-ok", { subjectEntityId: "edge:direct-ok", value: "citation reception influence" }),
        relationshipClaim("claim:direct-weak", { subjectEntityId: "edge:direct-weak", value: "shared movement" }),
        relationshipClaim("claim:mentor-weak", { subjectEntityId: "edge:mentor-weak", value: "same university" }),
      ]
    );

    expect(results[0]).toMatchObject({
      recommendedAction: "confirm",
      finalDisposition: "confirmed-existing-edge",
      blockingReasons: [],
    });
    expect(results[1].blockingReasons).toContain("direct-influence-needs-transmission-evidence");
    expect(results[2].blockingReasons).toContain("mentorship-needs-advisor-student-evidence");
  });

  it("requires type-specific evidence for collaboration, source-context, parallel, and canonical-thread edges", () => {
    const results = validateBulkEdgeRelationshipRules(
      people,
      [
        {
          id: "edge:collab",
          source: "a",
          target: "b",
          type: "Collaboration",
          strength: 3,
          confidence: 0.9,
          note: "Same field.",
          claimIds: ["claim:collab"],
        },
        {
          id: "edge:context",
          source: "b",
          target: "c",
          type: "Source-context neighbor",
          strength: 3,
          confidence: 0.9,
          note: "Related topic.",
          claimIds: ["claim:context"],
        },
        {
          id: "edge:parallel",
          source: "a",
          target: "c",
          type: "Parallel",
          strength: 3,
          confidence: 0.9,
          note: "Vague similarity.",
          claimIds: ["claim:parallel"],
        },
        {
          id: "edge:thread",
          source: "a",
          target: "b",
          type: "Indirect influence",
          strength: 3,
          confidence: 0.7,
          note: "Indirect reception.",
          threadIds: ["thread:logic"],
          claimIds: ["claim:thread"],
        },
      ],
      [
        relationshipClaim("claim:collab", { subjectEntityId: "edge:collab", value: "same field" }),
        relationshipClaim("claim:context", { subjectEntityId: "edge:context", value: "related topic" }),
        relationshipClaim("claim:parallel", { subjectEntityId: "edge:parallel", value: "vague similarity" }),
        relationshipClaim("claim:thread", { subjectEntityId: "edge:thread", value: "indirect reception" }),
      ]
    );

    expect(results.map((result) => result.blockingReasons.at(-1))).toEqual([
      "collaboration-needs-shared-work-evidence",
      "source-context-neighbor-needs-proximity-evidence",
      "parallel-development-needs-non-transmission-evidence",
      "canonical-thread-edge-needs-high-confidence-source-support",
    ]);
  });

  it("generates missing edge candidates from automated evidence signals", () => {
    const candidates = generateMissingEdgeCandidates(
      [
        { ...people[0], influenced: ["b"] },
        people[1],
        people[2],
      ],
      [
        { source: "a", target: "b", type: "Influence", strength: 3 },
      ],
      [
        relationshipClaim("claim:relationship", {
          subjectEntityId: "relationship:person:b:Influence:person:c",
          value: "B influenced C through citation reception",
          confidence: 0.88,
        }),
        relationshipClaim("claim:advisor", {
          subjectEntityId: "person:c",
          subjectEntityType: "Person",
          field: "advisor",
          value: "b",
          confidence: 0.9,
        }),
        relationshipClaim("claim:coauthor", {
          subjectEntityId: "person:a",
          subjectEntityType: "Person",
          field: "coauthor",
          value: "c",
          confidence: 0.86,
        }),
      ],
      [{
        id: "thread:test",
        title: "Test Thread",
        field: "Philosophy",
        purpose: "Check gap generation",
        people: ["a", "c"],
        concepts: [],
        edgeTypes: ["Source-context neighbor"],
        confidence: "high",
      }]
    );

    expect(candidates.map((candidate) => `${candidate.source}->${candidate.target}:${candidate.type}`)).toEqual([
      "a->b:Source-context neighbor",
      "a->c:Collaboration",
      "a->c:Source-context neighbor",
      "b->c:Influence",
      "b->c:Mentorship",
    ]);
    expect(candidates.find((candidate) => candidate.id === "candidate:metadata:a:influence:b")).toBeUndefined();
    expect(candidates.find((candidate) => candidate.id === "candidate:thread:thread:test:a:c")?.threadIds).toEqual(["thread:test"]);
  });

  it("deduplicates discovered candidates against existing edges and each other", () => {
    const candidates = deduplicateMissingEdgeCandidates(
      [
        {
          id: "candidate:one",
          source: "a",
          target: "b",
          type: "Collaboration",
          strength: 3,
          confidence: 0.7,
          claimIds: ["claim:one"],
          note: "coauthorship evidence",
        },
        {
          id: "candidate:two",
          source: "b",
          target: "a",
          type: "Collaboration",
          strength: 3,
          confidence: 0.8,
          claimIds: ["claim:two"],
          note: "correspondence evidence",
        },
        {
          id: "candidate:existing",
          source: "a",
          target: "c",
          type: "Influence",
          strength: 3,
          confidence: 0.9,
        },
      ],
      [
        { source: "a", target: "c", type: "Influence", strength: 3 },
      ]
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: "a",
      target: "b",
      type: "Collaboration",
      confidence: 0.83,
      claimIds: ["claim:one", "claim:two"],
    });
    expect(candidates[0].note).toBe("coauthorship evidence; correspondence evidence");
  });

  it("adds only confirmed discovered candidates to the canonical graph", () => {
    const candidateResults = validateDiscoveredEdgeCandidates(
      people,
      [
        {
          id: "candidate:confirmed",
          source: "a",
          target: "b",
          type: "Influence",
          strength: 4,
          confidence: 0.92,
          note: "Explicit influence documented through citation reception.",
          claimIds: ["claim:confirmed"],
        },
        {
          id: "candidate:unresolved",
          source: "b",
          target: "c",
          type: "Influence",
          strength: 3,
          confidence: 0.7,
        },
      ],
      [
        relationshipClaim("claim:confirmed", {
          subjectEntityId: "candidate:confirmed",
          value: "explicit influence documented through citation reception",
          confidence: 0.92,
        }),
      ]
    );

    expect(candidateResults.map((result) => result.finalDisposition)).toEqual([
      "added-confirmed-edge",
      undefined,
    ]);

    const nextEdges = addConfirmedMissingEdgesToCanonicalGraph([], candidateResults);

    expect(nextEdges).toEqual([{
      id: "edge:confirmed",
      source: "a",
      target: "b",
      type: "Influence",
      strength: 4,
      confidence: 0.92,
      note: "Explicit influence documented through citation reception. Added by bulk edge validation.",
      claimIds: ["claim:confirmed"],
      status: "accepted",
    }]);
  });
});
