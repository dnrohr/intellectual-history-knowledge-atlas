import { describe, expect, it } from "vitest";
import { createCrossrefAdapter } from "./crossrefAdapter";

const response = (body: unknown): Response => ({
  ok: true,
  status: 200,
  json: async () => body,
} as Response);

describe("Crossref adapter", () => {
  it("searches Crossref works with bibliographic query metadata", async () => {
    const urls: string[] = [];
    const adapter = createCrossrefAdapter({
      fetchImpl: async (url) => {
        urls.push(String(url));
        return response({ message: { items: [{ DOI: "10.1/example", title: ["Example Work"], type: "book" }] } });
      },
    });

    const result = await adapter.searchEntities({ query: "Example Work", limit: 3 });

    expect(urls[0]).toContain("/works?query.bibliographic=Example+Work&rows=3");
    expect(result.records[0]).toMatchObject({
      sourceId: "10.1/example",
      label: "Example Work",
      entityType: "Work",
    });
  });

  it("fetches DOI-level work metadata", async () => {
    const adapter = createCrossrefAdapter({
      fetchImpl: async () => response({
        message: {
          DOI: "10.1/example",
          URL: "https://doi.org/10.1/example",
          title: ["Example Work"],
          issued: { "date-parts": [[1958]] },
        },
      }),
    });

    const result = await adapter.fetchWorks({ sourceId: "10.1/example" });

    expect(result.records[0]).toMatchObject({
      type: "Work",
      title: "Example Work",
      date: 1958,
      identifiers: { doi: "10.1/example" },
    });
    expect(result.claims.map((claim) => claim.field)).toEqual(["title", "date"]);
  });

  it("maps Crossref references into work-to-work relationship candidates", async () => {
    const adapter = createCrossrefAdapter({
      fetchImpl: async () => response({
        message: {
          DOI: "10.2/later",
          URL: "https://doi.org/10.2/later",
          title: ["Later Work"],
          reference: [{ DOI: "10.1/source", "article-title": "Earlier Work" }],
        },
      }),
    });

    const result = await adapter.fetchCitationsOrReferences({ sourceId: "10.2/later" });

    expect(result.records[0]).toMatchObject({
      type: "Relationship",
      relationshipType: "work influenced work",
      source: { entityType: "Work" },
      target: { entityType: "Work" },
      status: "suggested",
    });
  });
});
