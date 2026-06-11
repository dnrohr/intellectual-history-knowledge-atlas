import { describe, expect, it } from "vitest";
import { normalizeStoredEdges, normalizeStoredPeople } from "./storageSchemas";

describe("localStorage schema normalization", () => {
  it("keeps valid people and drops malformed people", () => {
    const people = normalizeStoredPeople([
      { id: "valid", name: "Valid Person", birth: 1900, death: null, fields: ["Philosophy"], subfields: ["Ethics"], claimIds: ["claim:valid"] },
      { id: "missing-name", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "bad-birth", name: "Bad Birth", birth: "1900", death: null, fields: ["Philosophy"] },
      null,
    ]);

    expect(people).toHaveLength(1);
    expect(people[0].id).toBe("valid");
    expect(people[0].subfields).toEqual(["Ethics"]);
    expect(people[0].claimIds).toEqual(["claim:valid"]);
  });

  it("normalizes optional people fields", () => {
    const people = normalizeStoredPeople([
      { id: "valid", name: "Valid Person", birth: 1900, death: 1950, fields: ["Philosophy"], works: "Book", influenced: ["next"] },
    ]);

    expect(people[0].works).toEqual([]);
    expect(people[0].influenced).toEqual(["next"]);
    expect(people[0].notes).toBeNull();
  });

  it("keeps valid edges and drops edges with missing endpoints", () => {
    const people = normalizeStoredPeople([
      { id: "source", name: "Source", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "target", name: "Target", birth: 1910, death: null, fields: ["Philosophy"] },
    ]);

    const edges = normalizeStoredEdges([
      { source: "source", target: "target", type: "Influence", strength: 4, confidence: 1.4, status: "suggested", sourceClaims: ["https://example.com"] },
      { source: "source", target: "missing", type: "Influence", strength: 4 },
      { source: "source", target: "target", type: "Influence", strength: "4" },
    ], people);

    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe("source:Influence:target");
    expect(edges[0].sourceEntityType).toBe("Person");
    expect(edges[0].targetEntityType).toBe("Person");
    expect(edges[0].confidence).toBe(1);
    expect(edges[0].sourceClaims).toEqual(["https://example.com"]);
    expect(edges[0].status).toBe("suggested");
  });

  it("marks high-confidence sourced edges accepted by default", () => {
    const people = normalizeStoredPeople([
      { id: "source", name: "Source", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "target", name: "Target", birth: 1910, death: null, fields: ["Philosophy"] },
    ]);

    const edges = normalizeStoredEdges([
      { source: "source", target: "target", type: "Influence", strength: 4, confidence: 0.85, sourceClaims: ["https://example.com"] },
    ], people);

    expect(edges[0].status).toBe("accepted");
  });

  it("preserves claim and thread provenance while normalizing source status", () => {
    const people = normalizeStoredPeople([
      { id: "source", name: "Source", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "target", name: "Target", birth: 1910, death: null, fields: ["Philosophy"] },
    ]);

    const edges = normalizeStoredEdges([
      { source: "source", target: "target", type: "Influence", strength: 4, confidence: 0.9, claimIds: ["claim:edge"], threadIds: ["thread:logic"] },
    ], people);

    expect(edges[0].claimIds).toEqual(["claim:edge"]);
    expect(edges[0].threadIds).toEqual(["thread:logic"]);
    expect(edges[0].status).toBe("accepted");
  });

  it("marks unsupported edges as needing source by default", () => {
    const people = normalizeStoredPeople([
      { id: "source", name: "Source", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "target", name: "Target", birth: 1910, death: null, fields: ["Philosophy"] },
    ]);

    const edges = normalizeStoredEdges([
      { source: "source", target: "target", type: "Influence", strength: 4 },
    ], people);

    expect(edges[0].status).toBe("needs_source");
  });

  it("preserves typed relationship endpoints for expanded graph records", () => {
    const people = normalizeStoredPeople([
      { id: "source", name: "Source", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "target", name: "Target", birth: 1910, death: null, fields: ["Philosophy"] },
    ]);

    const edges = normalizeStoredEdges([
      { id: "relationship:work-person", source: "work:book", target: "target", sourceEntityType: "Work", targetEntityType: "Person", type: "work influenced person", strength: 4 },
    ], people);

    expect(edges[0]).toMatchObject({
      id: "relationship:work-person",
      sourceEntityType: "Work",
      targetEntityType: "Person",
    });
  });
});
