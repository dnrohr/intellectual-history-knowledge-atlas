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
  birth?: number | null;
  advisors?: string[];
  students?: string[];
  coauthors?: string[];
  correspondents?: string[];
  institutions?: string[];
  movements?: string[];
  concepts?: string[];
  works?: Array<{ title: string; authorIds?: string[] }>;
  explicitInfluences?: string[];
  citationTargets?: string[];
  namedMentions?: string[];
  receivedWorks?: string[];
  sourceContexts?: Array<{ sourceId: string; section?: string }>;
}

export interface RelationshipCandidate {
  id: string;
  relationship: RelationshipEntity;
  category: RelationshipCandidateCategory;
  status: "suggested" | "accepted" | "rejected" | "needs_source";
  confidence: number;
  evidence: string[];
}

export interface RelationshipDirectionValidationInput {
  sourceId: string;
  targetId: string;
  relationshipType: string;
  sourceBirth?: number | null;
  targetBirth?: number | null;
  sourceWording?: string;
}

export interface RelationshipDirectionValidation {
  valid: boolean;
  warnings: string[];
  suggestedSourceId?: string;
  suggestedTargetId?: string;
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

const collaborationCandidate = (
  aId: string,
  bId: string,
  evidence: string,
  confidence = 0.75
): RelationshipCandidate => {
  const [sourceId, targetId] = [personEntityId(aId), personEntityId(bId)].sort();
  const id = `relationship-candidate:${sourceId}:person collaborated with person:${targetId}`;
  return {
    id,
    relationship: {
      id: id.replace("relationship-candidate:", "relationship:"),
      type: "Relationship",
      label: `${sourceId} collaborated with ${targetId}`,
      source: { entityId: sourceId, entityType: "Person" },
      target: { entityId: targetId, entityType: "Person" },
      relationshipType: "person collaborated with person",
      confidence,
      status: "suggested",
    },
    category: "collaboration",
    status: "suggested",
    confidence,
    evidence: [evidence],
  };
};

const addCandidateEvidence = (candidates: Map<string, RelationshipCandidate>, candidate: RelationshipCandidate) => {
  const existing = candidates.get(candidate.id);
  if (!existing) {
    candidates.set(candidate.id, candidate);
    return;
  }
  existing.evidence = Array.from(new Set([...existing.evidence, ...candidate.evidence]));
  existing.confidence = Math.min(0.95, Math.max(existing.confidence, candidate.confidence) + 0.05);
  existing.relationship.confidence = existing.confidence;
};

export const generateCollaborationCandidates = (
  people: PersonRelationshipEvidence[]
): RelationshipCandidate[] => {
  const candidates = new Map<string, RelationshipCandidate>();
  const peopleById = new Map(people.map((person) => [person.personId, person]));

  people.forEach((person) => {
    (person.coauthors || []).forEach((coauthorId) =>
      addCandidateEvidence(candidates, collaborationCandidate(person.personId, coauthorId, "coauthorship evidence", 0.8))
    );
    (person.correspondents || []).forEach((correspondentId) =>
      addCandidateEvidence(candidates, collaborationCandidate(person.personId, correspondentId, "correspondence evidence", 0.75))
    );
    (person.institutions || []).forEach((institution) => {
      people.forEach((other) => {
        if (other.personId === person.personId || !(other.institutions || []).includes(institution)) return;
        addCandidateEvidence(candidates, collaborationCandidate(person.personId, other.personId, `shared institution: ${institution}`, 0.55));
      });
    });
    (person.works || []).forEach((work) => {
      (work.authorIds || []).filter((authorId) => authorId !== person.personId && peopleById.has(authorId)).forEach((authorId) =>
        addCandidateEvidence(candidates, collaborationCandidate(person.personId, authorId, `jointly authored work: ${work.title}`, 0.85))
      );
    });
  });

  return Array.from(candidates.values());
};

const influenceCandidate = (
  sourceId: string,
  targetId: string,
  evidence: string,
  confidence = 0.7
): RelationshipCandidate => {
  const sourceEntityId = personEntityId(sourceId);
  const targetEntityId = personEntityId(targetId);
  const id = `relationship-candidate:${sourceEntityId}:person influenced person:${targetEntityId}`;
  return {
    id,
    relationship: {
      id: id.replace("relationship-candidate:", "relationship:"),
      type: "Relationship",
      label: `${sourceEntityId} influenced ${targetEntityId}`,
      source: { entityId: sourceEntityId, entityType: "Person" },
      target: { entityId: targetEntityId, entityType: "Person" },
      relationshipType: "person influenced person",
      confidence,
      status: "suggested",
    },
    category: "likely influence",
    status: "suggested",
    confidence,
    evidence: [evidence],
  };
};

export const generateInfluenceCandidates = (
  people: PersonRelationshipEvidence[]
): RelationshipCandidate[] => {
  const candidates = new Map<string, RelationshipCandidate>();
  const peopleById = new Map(people.map((person) => [person.personId, person]));

  const addInfluence = (sourceId: string, targetId: string, evidence: string, confidence = 0.7) => {
    if (sourceId === targetId) return;
    const source = peopleById.get(sourceId);
    const target = peopleById.get(targetId);
    if (source?.birth !== undefined && source.birth !== null && target?.birth !== undefined && target.birth !== null && source.birth > target.birth + 20) return;
    addCandidateEvidence(candidates, influenceCandidate(sourceId, targetId, evidence, confidence));
  };

  people.forEach((person) => {
    (person.explicitInfluences || []).forEach((sourceId) => addInfluence(sourceId, person.personId, "explicit influence claim", 0.85));
    (person.citationTargets || []).forEach((sourceId) => addInfluence(sourceId, person.personId, "citation path evidence", 0.65));
    (person.namedMentions || []).forEach((sourceId) => addInfluence(sourceId, person.personId, "named mention evidence", 0.55));
    (person.advisors || []).forEach((sourceId) => addInfluence(sourceId, person.personId, "advisor/student lineage", 0.7));
    (person.receivedWorks || []).forEach((sourceId) => addInfluence(sourceId, person.personId, "work reception evidence", 0.7));
    (person.movements || []).forEach((movement) => {
      people
        .filter((other) => other.personId !== person.personId && (other.movements || []).includes(movement))
        .forEach((other) => {
          const source = (other.birth ?? 0) <= (person.birth ?? 0) ? other : person;
          const target = source.personId === other.personId ? person : other;
          addInfluence(source.personId, target.personId, `shared movement with chronology: ${movement}`, 0.5);
        });
    });
  });

  return Array.from(candidates.values());
};

const nonDirectionalPair = (aId: string, bId: string) =>
  [personEntityId(aId), personEntityId(bId)].sort();

const parallelDevelopmentCandidate = (
  aId: string,
  bId: string,
  concept: string
): RelationshipCandidate => {
  const [sourceId, targetId] = nonDirectionalPair(aId, bId);
  const id = `relationship-candidate:${sourceId}:parallel development:${targetId}`;
  return {
    id,
    relationship: {
      id: id.replace("relationship-candidate:", "relationship:"),
      type: "Relationship",
      label: `${sourceId} parallel development with ${targetId}`,
      source: { entityId: sourceId, entityType: "Person" },
      target: { entityId: targetId, entityType: "Person" },
      relationshipType: "Source-context neighbor",
      confidence: 0.45,
      status: "suggested",
    },
    category: "parallel development",
    status: "suggested",
    confidence: 0.45,
    evidence: [`shared concept without transmission evidence: ${concept}`],
  };
};

export const generateParallelDevelopmentCandidates = (
  people: PersonRelationshipEvidence[]
): RelationshipCandidate[] => {
  const candidates = new Map<string, RelationshipCandidate>();

  people.forEach((person, index) => {
    people.slice(index + 1).forEach((other) => {
      const sharedConcepts = (person.concepts || []).filter((concept) => (other.concepts || []).includes(concept));
      const hasDirectTransmission =
        (person.explicitInfluences || []).includes(other.personId) ||
        (other.explicitInfluences || []).includes(person.personId) ||
        (person.advisors || []).includes(other.personId) ||
        (other.advisors || []).includes(person.personId) ||
        (person.students || []).includes(other.personId) ||
        (other.students || []).includes(person.personId);
      if (hasDirectTransmission) return;
      sharedConcepts.forEach((concept) =>
        addCandidateEvidence(candidates, parallelDevelopmentCandidate(person.personId, other.personId, concept))
      );
    });
  });

  return Array.from(candidates.values());
};

const sourceContextNeighborCandidate = (
  aId: string,
  bId: string,
  sourceId: string,
  section?: string
): RelationshipCandidate => {
  const [sourceEntityId, targetEntityId] = nonDirectionalPair(aId, bId);
  const id = `relationship-candidate:${sourceEntityId}:source-context neighbor:${targetEntityId}`;
  const where = section ? `${sourceId}#${section}` : sourceId;
  return {
    id,
    relationship: {
      id: id.replace("relationship-candidate:", "relationship:"),
      type: "Relationship",
      label: `${sourceEntityId} source-context neighbor ${targetEntityId}`,
      source: { entityId: sourceEntityId, entityType: "Person" },
      target: { entityId: targetEntityId, entityType: "Person" },
      relationshipType: "Source-context neighbor",
      confidence: 0.35,
      status: "suggested",
    },
    category: "source-context neighbor",
    status: "suggested",
    confidence: 0.35,
    evidence: [`source proximity without influence claim: ${where}`],
  };
};

export const generateSourceContextNeighborCandidates = (
  people: PersonRelationshipEvidence[]
): RelationshipCandidate[] => {
  const candidates = new Map<string, RelationshipCandidate>();

  people.forEach((person, index) => {
    people.slice(index + 1).forEach((other) => {
      (person.sourceContexts || []).forEach((context) => {
        const matchingContext = (other.sourceContexts || []).find((otherContext) =>
          otherContext.sourceId === context.sourceId &&
          (!context.section || !otherContext.section || otherContext.section === context.section)
        );
        if (!matchingContext) return;
        addCandidateEvidence(candidates, sourceContextNeighborCandidate(
          person.personId,
          other.personId,
          context.sourceId,
          context.section || matchingContext.section
        ));
      });
    });
  });

  return Array.from(candidates.values());
};

const nonDirectionalRelationshipTypes = new Set(["Source-context neighbor", "parallel development"]);

export const validateRelationshipDirection = ({
  sourceId,
  targetId,
  relationshipType,
  sourceBirth,
  targetBirth,
  sourceWording = "",
}: RelationshipDirectionValidationInput): RelationshipDirectionValidation => {
  const warnings: string[] = [];
  const wording = sourceWording.toLowerCase();

  if (sourceId === targetId) warnings.push("self-link");
  if (nonDirectionalRelationshipTypes.has(relationshipType)) {
    return { valid: warnings.length === 0, warnings };
  }

  if (
    sourceBirth !== undefined &&
    sourceBirth !== null &&
    targetBirth !== undefined &&
    targetBirth !== null &&
    sourceBirth > targetBirth + 20
  ) {
    warnings.push("chronology-direction");
  }

  if (wording.includes("influenced by") || wording.includes("student of") || wording.includes("mentored by")) {
    warnings.push("wording-suggests-reverse-direction");
  }

  return {
    valid: warnings.length === 0,
    warnings,
    ...(warnings.includes("chronology-direction") || warnings.includes("wording-suggests-reverse-direction")
      ? { suggestedSourceId: targetId, suggestedTargetId: sourceId }
      : {}),
  };
};
