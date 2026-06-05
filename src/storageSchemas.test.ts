import { describe, expect, it } from "vitest";
import { normalizeStoredEdges, normalizeStoredPeople } from "./storageSchemas";

describe("localStorage schema normalization", () => {
  it("keeps valid people and drops malformed people", () => {
    const people = normalizeStoredPeople([
      { id: "valid", name: "Valid Person", birth: 1900, death: null, fields: ["Philosophy"], subfields: ["Ethics"] },
      { id: "missing-name", birth: 1900, death: null, fields: ["Philosophy"] },
      { id: "bad-birth", name: "Bad Birth", birth: "1900", death: null, fields: ["Philosophy"] },
      null,
    ]);

    expect(people).toHaveLength(1);
    expect(people[0].id).toBe("valid");
    expect(people[0].subfields).toEqual(["Ethics"]);
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
    expect(edges[0].confidence).toBe(1);
    expect(edges[0].sourceClaims).toEqual(["https://example.com"]);
  });
});
