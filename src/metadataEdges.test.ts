import { describe, expect, it } from "vitest";
import { deriveMetadataInfluenceEdges } from "./data";
import { InfluenceEdge, Thinker } from "./types";

const thinker = (overrides: Partial<Thinker>): Thinker => ({
  id: "person",
  name: "Person",
  birth: 0,
  death: null,
  fields: ["Philosophy"],
  influenced: [],
  ...overrides,
});

describe("deriveMetadataInfluenceEdges", () => {
  it("creates recorded influence edges from thinker metadata", () => {
    const edges = deriveMetadataInfluenceEdges([
      thinker({ id: "source", influenced: ["target"] }),
      thinker({ id: "target" }),
    ], []);

    expect(edges).toEqual([{
      source: "source",
      target: "target",
      type: "Recorded influence",
      strength: 3,
      confidence: 0.6,
      note: "Derived from existing thinker influence metadata",
    }]);
  });

  it("skips self-links and missing targets", () => {
    const edges = deriveMetadataInfluenceEdges([
      thinker({ id: "source", influenced: ["source", "missing"] }),
    ], []);

    expect(edges).toEqual([]);
  });

  it("does not duplicate explicit edges", () => {
    const explicitEdges: InfluenceEdge[] = [{
      source: "source",
      target: "target",
      type: "Influence",
      strength: 5,
    }];

    const edges = deriveMetadataInfluenceEdges([
      thinker({ id: "source", influenced: ["target", "other"] }),
      thinker({ id: "target" }),
      thinker({ id: "other" }),
    ], explicitEdges);

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("source");
    expect(edges[0].target).toBe("other");
  });
});
