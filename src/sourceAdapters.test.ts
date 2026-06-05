import { describe, expect, it } from "vitest";
import { createEmptyAdapterResult, SourceAdapter, summarizeSourceAdapterRuns } from "./sourceAdapters";

describe("source adapter interface", () => {
  it("creates empty normalized adapter results", () => {
    expect(createEmptyAdapterResult("wikidata")).toEqual({
      adapterId: "wikidata",
      observations: [],
      claims: [],
      records: [],
    });
  });

  it("supports the shared adapter workflow surface", async () => {
    const adapter: SourceAdapter = {
      id: "test",
      name: "Test Adapter",
      searchEntities: async () => createEmptyAdapterResult("test"),
      fetchEntityDetail: async () => createEmptyAdapterResult("test"),
      fetchRelationships: async () => createEmptyAdapterResult("test"),
      fetchWorks: async () => createEmptyAdapterResult("test"),
      fetchAffiliations: async () => createEmptyAdapterResult("test"),
      fetchCitationsOrReferences: async () => createEmptyAdapterResult("test"),
      normalizeSourceClaims: () => [],
    };

    await expect(adapter.searchEntities({ query: "Arendt", entityType: "Person" })).resolves.toMatchObject({
      adapterId: "test",
      records: [],
    });
  });

  it("summarizes adapter run history and latest errors", () => {
    expect(summarizeSourceAdapterRuns([
      {
        id: "run:1",
        adapterId: "wikidata",
        adapterName: "Wikidata",
        runAt: "2026-06-04T00:00:00.000Z",
        status: "completed",
        queryCount: 4,
        observationCount: 3,
        claimCount: 12,
      },
      {
        id: "run:2",
        adapterId: "semantic-scholar",
        adapterName: "Semantic Scholar",
        runAt: "2026-06-05T00:00:00.000Z",
        status: "failed",
        queryCount: 1,
        observationCount: 0,
        claimCount: 0,
        errorMessage: "Missing API key",
      },
      {
        id: "run:3",
        adapterId: "openalex",
        adapterName: "OpenAlex",
        runAt: null,
        status: "held",
        queryCount: 0,
        observationCount: 0,
        claimCount: 0,
      },
    ])).toEqual({
      totalRuns: 3,
      completedRuns: 1,
      failedRuns: 1,
      heldRuns: 1,
      latestRunAt: "2026-06-05T00:00:00.000Z",
      latestErrors: [{
        adapterId: "semantic-scholar",
        adapterName: "Semantic Scholar",
        errorMessage: "Missing API key",
      }],
    });
  });
});
