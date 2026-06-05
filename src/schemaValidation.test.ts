import { describe, expect, it } from "vitest";
import { validateImportedOrGeneratedAtlasData } from "./schemaValidation";

describe("schema validation", () => {
  it("validates imported or generated atlas payloads and reports malformed records", () => {
    const result = validateImportedOrGeneratedAtlasData({
      people: [
        { id: "source", name: "Source", birth: 1900, death: null, fields: ["Philosophy"] },
        { id: "bad-person", name: "Bad", birth: "1900", death: null, fields: ["Philosophy"] },
      ],
      edges: [
        { source: "source", target: "source", type: "person influenced person", strength: 3 },
        { source: "source", target: "missing", type: "person influenced person", strength: 3 },
      ],
      entities: [
        { id: "concept:logic", type: "Concept", label: "Logic" },
        { id: "bad-entity", type: "SourceClaim", label: "Missing source fields" },
      ],
    });

    expect(result.people).toHaveLength(1);
    expect(result.edges).toHaveLength(1);
    expect(result.entities).toHaveLength(1);
    expect(result.issues).toEqual([
      { path: "people[1]", message: "Record does not match the atlas schema." },
      { path: "edges[1]", message: "Record does not match the atlas schema." },
      { path: "entities[1]", message: "Record does not match the atlas schema." },
    ]);
  });

  it("reports a non-object payload as invalid", () => {
    expect(validateImportedOrGeneratedAtlasData(null).issues).toEqual([
      { path: "$", message: "Expected an object with people, edges, or entities arrays." },
    ]);
  });
});
