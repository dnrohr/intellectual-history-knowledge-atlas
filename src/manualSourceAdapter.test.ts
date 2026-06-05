import { describe, expect, it } from "vitest";
import { createManualSourceAdapter } from "./manualSourceAdapter";

describe("manual source adapter", () => {
  it("normalizes curated encyclopedia/manual sources into adapter claims", async () => {
    const adapter = createManualSourceAdapter([{
      id: "sep-arendt",
      title: "Hannah Arendt",
      sourceName: "Stanford Encyclopedia of Philosophy",
      sourceUrl: "https://plato.stanford.edu/entries/arendt/",
      sourceType: "encyclopedia",
      subjects: [{ entityId: "person:arendt", entityType: "Person", label: "Hannah Arendt" }],
      claims: [{
        subjectEntityId: "person:arendt",
        subjectEntityType: "Person",
        field: "field",
        value: "Political Thought",
        confidence: 0.8,
        status: "candidate",
      }],
    }]);

    const result = await adapter.searchEntities({ query: "Arendt" });

    expect(result.records[0]).toMatchObject({
      sourceId: "sep-arendt",
      label: "Hannah Arendt",
      confidence: 0.75,
    });
    expect(result.claims[0]).toMatchObject({
      sourceName: "Stanford Encyclopedia of Philosophy",
      sourceType: "encyclopedia",
      sourceReliability: 0.8,
      extractionMethod: "manual_seed",
    });
  });
});
