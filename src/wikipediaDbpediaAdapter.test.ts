import { describe, expect, it } from "vitest";
import { createWikipediaDbpediaAdapter, materializeWikipediaSummaryClaims } from "./wikipediaDbpediaAdapter";

const response = (body: unknown): Response => ({
  ok: true,
  status: 200,
  json: async () => body,
} as Response);

describe("Wikipedia/DBpedia fallback adapter", () => {
  it("searches DBpedia lookup as low-confidence entity candidates", async () => {
    const adapter = createWikipediaDbpediaAdapter({
      fetchImpl: async () => response({
        docs: [{ resource: ["http://dbpedia.org/resource/Hannah_Arendt"], label: ["Hannah Arendt"], comment: ["political theorist"] }],
      }),
    });

    const result = await adapter.searchEntities({ query: "Hannah Arendt", entityType: "Person", limit: 1 });

    expect(result.records[0]).toMatchObject({
      sourceId: "http://dbpedia.org/resource/Hannah_Arendt",
      label: "Hannah Arendt",
      entityType: "Person",
      confidence: 0.4,
    });
  });

  it("fetches Wikipedia summaries as low-confidence descriptive evidence", async () => {
    const adapter = createWikipediaDbpediaAdapter({
      fetchImpl: async () => response({
        title: "Hannah Arendt",
        extract: "Hannah Arendt was a political theorist.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Hannah_Arendt" } },
      }),
    });

    const result = await adapter.fetchEntityDetail({ query: "Hannah Arendt", entityType: "Person" });
    const claims = materializeWikipediaSummaryClaims(result.claims);

    expect(result.records[0]).toMatchObject({
      type: "Person",
      label: "Hannah Arendt",
    });
    expect(claims[0]).toMatchObject({
      sourceName: "Wikipedia",
      sourceType: "encyclopedia",
      sourceReliability: 0.45,
      extractionMethod: "text_extraction",
      field: "summary",
      status: "candidate",
    });
  });
});
