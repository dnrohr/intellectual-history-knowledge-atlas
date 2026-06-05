import { describe, expect, it } from "vitest";
import {
  generateCollaborationCandidates,
  generateInfluenceCandidates,
  generateMentorshipCandidates,
  generateParallelDevelopmentCandidates,
  generateSourceContextNeighborCandidates,
  classifyRelationshipSuggestion,
  attachRelationshipCandidateProvenance,
  buildRelationshipCandidateStore,
  getRelationshipCandidateProvenance,
  normalizeRelationshipStatus,
  RELATIONSHIP_STATUSES,
  validateRelationshipDirection,
} from "./relationshipEvidence";

describe("relationship evidence", () => {
  it("represents relationship status values at runtime", () => {
    expect(RELATIONSHIP_STATUSES).toEqual(["suggested", "accepted", "rejected", "needs_source"]);
    expect(normalizeRelationshipStatus("accepted")).toBe("accepted");
    expect(normalizeRelationshipStatus("unknown")).toBe("suggested");
  });

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

  it("validates relationship direction using chronology, wording, and relationship type", () => {
    expect(validateRelationshipDirection({
      sourceId: "late",
      targetId: "early",
      relationshipType: "person influenced person",
      sourceBirth: 1950,
      targetBirth: 1900,
      sourceWording: "late was influenced by early",
    })).toEqual({
      valid: false,
      warnings: ["chronology-direction", "wording-suggests-reverse-direction"],
      suggestedSourceId: "early",
      suggestedTargetId: "late",
    });

    expect(validateRelationshipDirection({
      sourceId: "a",
      targetId: "b",
      relationshipType: "Source-context neighbor",
      sourceBirth: 2000,
      targetBirth: 1900,
    })).toEqual({ valid: true, warnings: [] });
  });

  it("classifies relationship suggestions into roadmap categories", () => {
    expect(classifyRelationshipSuggestion("person mentored person")).toBe("direct mentorship");
    expect(classifyRelationshipSuggestion("person collaborated with person")).toBe("collaboration");
    expect(classifyRelationshipSuggestion("Source-context neighbor", ["shared concept without transmission evidence: Logic"])).toBe("parallel development");
    expect(classifyRelationshipSuggestion("Source-context neighbor", ["source proximity without influence claim: sep:logic"])).toBe("source-context neighbor");
    expect(classifyRelationshipSuggestion("person influenced person", ["citation path evidence"])).toBe("likely influence");
    expect(classifyRelationshipSuggestion("unknown relationship")).toBe("needs review");
  });

  it("stores relationship candidates separately from accepted relationships", () => {
    const [candidate] = generateMentorshipCandidates([{ personId: "student", advisors: ["mentor"] }]);
    const store = buildRelationshipCandidateStore([candidate], [candidate.relationship]);

    expect(store.acceptedRelationships).toEqual([candidate.relationship]);
    expect(store.candidates).toEqual([]);
    expect(buildRelationshipCandidateStore([candidate]).candidates).toEqual([candidate]);
  });

  it("attaches relationship source URLs and claim-level provenance", () => {
    const [candidate] = generateMentorshipCandidates([{ personId: "student", advisors: ["mentor"] }]);
    const withProvenance = attachRelationshipCandidateProvenance(candidate, {
      sourceUrls: ["https://example.com/source"],
      claimIds: ["claim:mentor-student"],
    });

    expect(withProvenance.relationship.claimIds).toEqual(["claim:mentor-student"]);
    expect(getRelationshipCandidateProvenance(withProvenance)).toEqual({
      candidateId: candidate.id,
      sourceUrls: ["https://example.com/source"],
      claimIds: ["claim:mentor-student"],
      evidence: ["advisor/student evidence"],
    });
  });
});
