import { describe, expect, it } from "vitest";
import { createSourceClaimEntity } from "./knowledgeModel";
import { buildGraphHealthReport, computeGraphQualityMetrics } from "./graphQuality";
import { InfluenceEdge, Thinker } from "./types";

const person = (id: string, name = id): Thinker => ({
  id,
  name,
  birth: 1900,
  death: null,
  fields: ["Philosophy"],
});

describe("graph quality", () => {
  it("computes graph-level quality metrics", () => {
    const edges: InfluenceEdge[] = [
      { source: "a", target: "b", type: "Influence", strength: 4, confidence: 0.8, status: "accepted", sourceClaims: ["claim:1"] },
      { source: "b", target: "c", type: "Influence", strength: 3, confidence: 0.4, status: "suggested" },
    ];

    expect(computeGraphQualityMetrics([
      person("a", "Same"),
      person("b"),
      person("c"),
      person("d"),
      person("e", "Same"),
    ], edges, [
      createSourceClaimEntity({
        id: "claim:1",
        sourceName: "SEP",
        sourceUrl: "https://example.com",
        observedAt: "2026-06-01T00:00:00.000Z",
        subjectEntityId: "relationship:1",
        subjectEntityType: "Relationship",
        field: "type",
        value: "Influence",
      }),
    ], [{
      id: "thread",
      title: "Thread",
      field: "Philosophy",
      purpose: "test",
      people: ["a", "b"],
      concepts: [],
      edgeTypes: [],
      confidence: "high",
    }], new Date("2026-06-05T00:00:00.000Z"))).toEqual({
      sourcedEdgePercentage: 0.5,
      acceptedEdgePercentage: 0.5,
      averageEdgeConfidence: 0.6,
      isolatedNodeCount: 2,
      duplicateRiskCount: 2,
      averageSourceFreshnessDays: 4,
      canonicalThreadCoverage: 0.4,
    });
  });

  it("builds graph health reports for UI and QA output", () => {
    const report = buildGraphHealthReport([person("a")], [], [], []);

    expect(report.metrics.isolatedNodeCount).toBe(1);
    expect(report.summary.warning).toBeGreaterThan(0);
    expect(report.findings[0]).toMatchObject({ code: "isolated-node" });
  });
});
