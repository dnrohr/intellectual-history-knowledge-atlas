import { describe, expect, it } from "vitest";
import { buildThreadFromCanonical, THREADS } from "./threads";
import { CanonicalThread } from "./types";

describe("threads", () => {
  it("normalizes canonical threads into reusable thread concepts", () => {
    const canonical: CanonicalThread = {
      id: "logic",
      title: "Logic Thread",
      field: "Logic",
      purpose: "Follow formal reasoning into computation.",
      shortPurpose: "Formal reasoning into computation.",
      people: ["aristotle", "turing"],
      concepts: ["syllogism", "universal computation"],
      keyWorks: ["Prior Analytics", "On Computable Numbers"],
      edgeTypes: ["Influence"],
      confidence: "medium",
      sourceStatus: "partial",
    };

    expect(buildThreadFromCanonical(canonical)).toEqual({
      id: "logic",
      title: "Logic Thread",
      shortPurpose: "Formal reasoning into computation.",
      orderedEntities: [
        { entityId: "aristotle", entityType: "Person" },
        { entityId: "turing", entityType: "Person" },
      ],
      keyWorks: ["Prior Analytics", "On Computable Numbers"],
      keyConcepts: ["syllogism", "universal computation"],
      edgeTypes: ["Influence"],
      confidence: "medium",
      sourceStatus: "partial",
    });
  });

  it("exports normalized threads for the bundled curated paths", () => {
    expect(THREADS.length).toBeGreaterThan(0);
    expect(THREADS[0]).toMatchObject({
      title: expect.any(String),
      orderedEntities: expect.arrayContaining([{ entityType: "Person", entityId: expect.any(String) }]),
      keyConcepts: expect.any(Array),
      edgeTypes: expect.any(Array),
      sourceStatus: expect.any(String),
    });
  });
});
