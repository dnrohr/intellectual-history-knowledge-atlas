import { RelationshipEntity } from "./types";

export type RelationshipCandidateCategory =
  | "likely influence"
  | "direct mentorship"
  | "collaboration"
  | "parallel development"
  | "source-context neighbor"
  | "needs review";

export interface PersonRelationshipEvidence {
  personId: string;
  advisors?: string[];
  students?: string[];
}

export interface RelationshipCandidate {
  id: string;
  relationship: RelationshipEntity;
  category: RelationshipCandidateCategory;
  status: "suggested" | "accepted" | "rejected" | "needs_source";
  confidence: number;
  evidence: string[];
}

const personEntityId = (id: string) => id.startsWith("person:") ? id : `person:${id}`;

const mentorshipCandidate = (mentorId: string, studentId: string, evidence: string): RelationshipCandidate => {
  const sourceId = personEntityId(mentorId);
  const targetId = personEntityId(studentId);
  const id = `relationship-candidate:${sourceId}:person mentored person:${targetId}`;
  return {
    id,
    relationship: {
      id: id.replace("relationship-candidate:", "relationship:"),
      type: "Relationship",
      label: `${sourceId} mentored ${targetId}`,
      source: { entityId: sourceId, entityType: "Person" },
      target: { entityId: targetId, entityType: "Person" },
      relationshipType: "person mentored person",
      confidence: 0.85,
      status: "suggested",
    },
    category: "direct mentorship",
    status: "suggested",
    confidence: 0.85,
    evidence: [evidence],
  };
};

export const generateMentorshipCandidates = (
  people: PersonRelationshipEvidence[]
): RelationshipCandidate[] => {
  const candidates = new Map<string, RelationshipCandidate>();

  people.forEach((person) => {
    (person.advisors || []).forEach((advisorId) => {
      const candidate = mentorshipCandidate(advisorId, person.personId, "advisor/student evidence");
      candidates.set(candidate.id, candidate);
    });
    (person.students || []).forEach((studentId) => {
      const candidate = mentorshipCandidate(person.personId, studentId, "student/advisor evidence");
      candidates.set(candidate.id, candidate);
    });
  });

  return Array.from(candidates.values());
};
