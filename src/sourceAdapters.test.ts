import { describe, expect, it } from "vitest";
import { createEmptyAdapterResult, SourceAdapter } from "./sourceAdapters";

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
});
