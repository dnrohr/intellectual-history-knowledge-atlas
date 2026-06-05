import { describe, expect, it } from "vitest";
import { generateMentorshipCandidates } from "./relationshipEvidence";

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
});
