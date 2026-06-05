import { describe, expect, it } from "vitest";
import { createOpenAlexAdapter } from "./openAlexAdapter";

const response = (body: unknown): Response => ({
  ok: true,
  status: 200,
  json: async () => body,
} as Response);

describe("OpenAlex adapter", () => {
  it("searches authors, works, institutions, and topics through the shared adapter interface", async () => {
    const urls: string[] = [];
    const adapter = createOpenAlexAdapter({
      fetchImpl: async (url) => {
        urls.push(String(url));
        return response({ results: [{ id: "https://openalex.org/A1", display_name: "Hannah Arendt", relevance_score: 900 }] });
      },
    });

    const result = await adapter.searchEntities({ query: "Arendt", entityType: "Person", limit: 2 });

    expect(urls[0]).toContain("/authors?search=Arendt&per-page=2");
    expect(result.records[0]).toMatchObject({
      sourceId: "https://openalex.org/A1",
      label: "Hannah Arendt",
      entityType: "Person",
    });
  });

  it("fetches works as work entities", async () => {
    const adapter = createOpenAlexAdapter({
      fetchImpl: async () => response({
        results: [{ id: "https://openalex.org/W1", display_name: "The Human Condition", publication_year: 1958, doi: "https://doi.org/10.1/example" }],
      }),
    });

    const result = await adapter.fetchWorks({ query: "Human Condition" });

    expect(result.records[0]).toMatchObject({
      type: "Work",
      title: "The Human Condition",
      date: 1958,
      identifiers: {
        openalex: "https://openalex.org/W1",
        doi: "https://doi.org/10.1/example",
      },
    });
  });

  it("maps referenced works into work-to-work relationship candidates", async () => {
    const adapter = createOpenAlexAdapter({
      fetchImpl: async () => response({
        id: "https://openalex.org/W2",
        display_name: "Later Work",
        referenced_works: ["https://openalex.org/W1"],
      }),
    });

    const result = await adapter.fetchCitationsOrReferences({ sourceId: "https://openalex.org/W2" });

    expect(result.records[0]).toMatchObject({
      type: "Relationship",
      relationshipType: "work influenced work",
      source: { entityType: "Work" },
      target: { entityType: "Work" },
      status: "suggested",
    });
  });

  it("maps coauthorship into collaboration relationship candidates", async () => {
    const adapter = createOpenAlexAdapter({
      fetchImpl: async () => response({
        results: [{
          id: "https://openalex.org/W3",
          display_name: "Shared Paper",
          authorships: [
            { author: { id: "https://openalex.org/A1", display_name: "Author One" } },
            { author: { id: "https://openalex.org/A2", display_name: "Author Two" } },
          ],
        }],
      }),
    });

    const result = await adapter.fetchRelationships({ sourceId: "https://openalex.org/A1", entityType: "Person" });

    expect(result.records[0]).toMatchObject({
      relationshipType: "person collaborated with person",
      source: { entityId: "person:openalex-a1", entityType: "Person" },
      target: { entityId: "person:openalex-a2", entityType: "Person" },
      status: "suggested",
    });
  });
});
