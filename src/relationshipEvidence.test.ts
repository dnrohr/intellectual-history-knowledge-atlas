import { describe, expect, it } from "vitest";
import {
  generateCollaborationCandidates,
  generateInfluenceCandidates,
  generateMentorshipCandidates,
  generateParallelDevelopmentCandidates,
  generateSourceContextNeighborCandidates,
} from "./relationshipEvidence";

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

  it("generates influence candidates from multiple evidence channels with chronology", () => {
    const candidates = generateInfluenceCandidates([
      { personId: "source", birth: 1900, movements: ["Phenomenology"] },
      {
        personId: "target",
        birth: 1930,
        explicitInfluences: ["source"],
        citationTargets: ["source"],
        namedMentions: ["source"],
        advisors: ["source"],
        receivedWorks: ["source"],
        movements: ["Phenomenology"],
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "relationship-candidate:person:source:person influenced person:person:target",
      category: "likely influence",
      relationship: {
        relationshipType: "person influenced person",
        source: { entityId: "person:source" },
        target: { entityId: "person:target" },
      },
      evidence: expect.arrayContaining([
        "explicit influence claim",
        "citation path evidence",
        "named mention evidence",
        "advisor/student lineage",
        "work reception evidence",
        "shared movement with chronology: Phenomenology",
      ]),
    });
  });

  it("generates parallel-development candidates from shared concepts without direct transmission evidence", () => {
    const candidates = generateParallelDevelopmentCandidates([
      { personId: "a", concepts: ["Intentionality", "Phenomenology"] },
      { personId: "b", concepts: ["Intentionality"] },
      { personId: "c", concepts: ["Phenomenology"], advisors: ["a"] },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "relationship-candidate:person:a:parallel development:person:b",
      category: "parallel development",
      relationship: {
        relationshipType: "Source-context neighbor",
        source: { entityId: "person:a" },
        target: { entityId: "person:b" },
        status: "suggested",
      },
      evidence: ["shared concept without transmission evidence: Intentionality"],
    });
  });

  it("generates source-context neighbors from source proximity without overclaiming influence", () => {
    const candidates = generateSourceContextNeighborCandidates([
      { personId: "a", sourceContexts: [{ sourceId: "sep:logic", section: "ancient" }] },
      { personId: "b", sourceContexts: [{ sourceId: "sep:logic", section: "ancient" }] },
      { personId: "c", sourceContexts: [{ sourceId: "sep:logic", section: "modern" }] },
    ]);

    expect(candidates).toEqual([{
      id: "relationship-candidate:person:a:source-context neighbor:person:b",
      relationship: {
        id: "relationship:person:a:source-context neighbor:person:b",
        type: "Relationship",
        label: "person:a source-context neighbor person:b",
        source: { entityId: "person:a", entityType: "Person" },
        target: { entityId: "person:b", entityType: "Person" },
        relationshipType: "Source-context neighbor",
        confidence: 0.35,
        status: "suggested",
      },
      category: "source-context neighbor",
      status: "suggested",
      confidence: 0.35,
      evidence: ["source proximity without influence claim: sep:logic#ancient"],
    }]);
  });
});
