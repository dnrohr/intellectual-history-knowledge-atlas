import { describe, expect, it } from "vitest";
import { auditThreadGaps, buildThreadFromCanonical, getConvergingThreadGroups, getThreadJunctionMarkers, tagRelationshipsWithThreads, THREADS } from "./threads";
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

  it("adds thread labels to relationships and preserves multi-thread membership", () => {
    const tagged = tagRelationshipsWithThreads([
      { source: "a", target: "b", type: "Influence", strength: 3, threadIds: ["existing"] },
      { source: "b", target: "c", type: "Influence", strength: 3 },
      { source: "x", target: "y", type: "Influence", strength: 3 },
    ], [
      {
        id: "thread-one",
        title: "Thread One",
        field: "Logic",
        purpose: "One path",
        people: ["a", "b", "c"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
      {
        id: "thread-two",
        title: "Thread Two",
        field: "Logic",
        purpose: "Second path",
        people: ["b", "a"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
    ]);

    expect(tagged[0].threadIds).toEqual(["existing", "thread-one", "thread-two"]);
    expect(tagged[1].threadIds).toEqual(["thread-one"]);
    expect(tagged[2].threadIds).toBeUndefined();
  });

  it("audits thread gaps for missing figures, sources, weak claims, and chronology jumps", () => {
    const findings = auditThreadGaps([
      {
        id: "thread",
        title: "Thread",
        field: "Logic",
        purpose: "Thread",
        people: ["a", "b", "missing", "c"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "needs-review",
      },
    ], [
      { id: "a", birth: 1000 },
      { id: "b", birth: 1300 },
      { id: "c", birth: 1900 },
    ], [
      { source: "a", target: "b", type: "Influence", strength: 2, confidence: 0.3, status: "needs_source" },
    ], 250);

    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "missing-intermediate-figure",
      "missing-edge",
      "missing-edge-source",
      "weak-claim",
      "overlong-chronology-jump",
    ]));
  });

  it("marks branch and convergence points across curated threads", () => {
    const markers = getThreadJunctionMarkers([
      {
        id: "one",
        title: "One",
        field: "Logic",
        purpose: "One",
        people: ["a", "b", "d"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
      {
        id: "two",
        title: "Two",
        field: "Logic",
        purpose: "Two",
        people: ["a", "c", "d"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
      {
        id: "three",
        title: "Three",
        field: "Logic",
        purpose: "Three",
        people: ["x", "a", "e"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
      {
        id: "four",
        title: "Four",
        field: "Logic",
        purpose: "Four",
        people: ["y", "a", "f"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
    ]);

    expect(markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: "a", kind: "both", incomingCount: 2, outgoingCount: 4 }),
      expect.objectContaining({ entityId: "d", kind: "convergence", incomingCount: 2 }),
    ]));
  });

  it("groups parallel threads that converge on the same entity", () => {
    expect(getConvergingThreadGroups([
      {
        id: "logic",
        title: "Logic",
        field: "Logic",
        purpose: "Logic",
        people: ["boole", "turing"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
      {
        id: "math",
        title: "Math",
        field: "Mathematics",
        purpose: "Math",
        people: ["hilbert", "turing"],
        concepts: [],
        edgeTypes: ["Influence"],
        confidence: "medium",
      },
    ])).toEqual([{
      entityId: "turing",
      threadIds: ["logic", "math"],
      incomingEntityIds: ["boole", "hilbert"],
    }]);
  });
});
