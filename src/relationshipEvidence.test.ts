import { describe, expect, it } from "vitest";
import { generateCollaborationCandidates, generateMentorshipCandidates } from "./relationshipEvidence";

describe("relationship evidence", () => {
  it("generates direct mentorship candidates from advisor and student evidence", () => {
    expect(generateMentorshipCandidates([
      { personId: "student", advisors: ["mentor"] },
      { personId: "mentor", students: ["student"] },
    ])).toEqual([{
      id: "relationship-candidate:person:mentor:person mentored person:person:student",
      relationship: {
        id: "relationship:person:mentor:person mentored person:person:student",
        type: "Relationship",
        label: "person:mentor mentored person:student",
        source: { entityId: "person:mentor", entityType: "Person" },
        target: { entityId: "person:student", entityType: "Person" },
        relationshipType: "person mentored person",
        confidence: 0.85,
        status: "suggested",
      },
      category: "direct mentorship",
      status: "suggested",
      confidence: 0.85,
      evidence: ["student/advisor evidence"],
    }]);
  });

  it("generates collaboration candidates from coauthorship, correspondence, institutional overlap, and joint works", () => {
    const candidates = generateCollaborationCandidates([
      {
        personId: "a",
        coauthors: ["b"],
        correspondents: ["b"],
        institutions: ["Princeton IAS"],
        works: [{ title: "Shared Work", authorIds: ["a", "b"] }],
      },
      { personId: "b", institutions: ["Princeton IAS"] },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "relationship-candidate:person:a:person collaborated with person:person:b",
      category: "collaboration",
      relationship: {
        relationshipType: "person collaborated with person",
        source: { entityId: "person:a", entityType: "Person" },
        target: { entityId: "person:b", entityType: "Person" },
      },
      evidence: [
        "coauthorship evidence",
        "correspondence evidence",
        "shared institution: Princeton IAS",
        "jointly authored work: Shared Work",
      ],
    });
  });
});
