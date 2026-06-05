import {
  ConceptEntity,
  InstitutionEntity,
  KnowledgeEntity,
  KnowledgeEntityType,
  MovementEntity,
  PersonEntity,
  RelationshipEntity,
  SourceClaimEntity,
  Thinker,
  WorkEntity,
} from "./types";

export const KNOWLEDGE_ENTITY_TYPES: KnowledgeEntityType[] = [
  "Person",
  "Work",
  "Concept",
  "Movement",
  "Institution",
  "SourceClaim",
  "Relationship",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const normalizeClaimIds = (value: unknown) => isStringArray(value) ? value : [];

const hasEntityBase = <T extends KnowledgeEntityType>(
  value: Record<string, unknown>,
  type: T
): value is Record<string, unknown> & { id: string; type: T; label: string } =>
  value.type === type && typeof value.id === "string" && typeof value.label === "string";

const normalizeConfidence = (value: unknown) =>
  isFiniteNumber(value) ? Math.max(0, Math.min(1, value)) : undefined;

const normalizeNullableYear = (value: unknown): number | null =>
  isFiniteNumber(value) ? value : null;

const normalizePersonEntity = (value: Record<string, unknown>): PersonEntity | null => {
  if (!hasEntityBase(value, "Person")) return null;
  const { birth, death, fields, thinkerId } = value;
  if (
    typeof thinkerId !== "string" ||
    !isFiniteNumber(birth) ||
    !(death === null || isFiniteNumber(death)) ||
    !isStringArray(fields) ||
    fields.length === 0
  ) {
    return null;
  }

  return {
    id: value.id,
    type: "Person",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    thinkerId,
    birth,
    death: normalizeNullableYear(death),
    fields,
  };
};

const normalizeWorkEntity = (value: Record<string, unknown>): WorkEntity | null => {
  if (!hasEntityBase(value, "Work") || typeof value.title !== "string") return null;
  return {
    id: value.id,
    type: "Work",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    title: value.title,
    authorIds: isStringArray(value.authorIds) ? value.authorIds : [],
    date: normalizeNullableYear(value.date),
    identifiers: isRecord(value.identifiers)
      ? Object.fromEntries(Object.entries(value.identifiers).filter(([, item]) => typeof item === "string")) as Record<string, string>
      : {},
  };
};

const normalizeConceptEntity = (value: Record<string, unknown>): ConceptEntity | null => {
  if (!hasEntityBase(value, "Concept")) return null;
  return {
    id: value.id,
    type: "Concept",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    description: typeof value.description === "string" ? value.description : null,
    fields: isStringArray(value.fields) ? value.fields : [],
  };
};

const normalizeMovementEntity = (value: Record<string, unknown>): MovementEntity | null => {
  if (!hasEntityBase(value, "Movement")) return null;
  return {
    id: value.id,
    type: "Movement",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    start: normalizeNullableYear(value.start),
    end: normalizeNullableYear(value.end),
    fields: isStringArray(value.fields) ? value.fields : [],
  };
};

const normalizeInstitutionEntity = (value: Record<string, unknown>): InstitutionEntity | null => {
  if (!hasEntityBase(value, "Institution")) return null;
  return {
    id: value.id,
    type: "Institution",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    city: typeof value.city === "string" ? value.city : null,
    figureIds: isStringArray(value.figureIds) ? value.figureIds : [],
  };
};

const normalizeSourceClaimEntity = (value: Record<string, unknown>): SourceClaimEntity | null => {
  if (!hasEntityBase(value, "SourceClaim")) return null;
  const claimStatuses = ["observed", "candidate", "accepted", "rejected", "stale", "conflicting"];
  if (
    typeof value.sourceName !== "string" ||
    typeof value.subjectEntityId !== "string" ||
    !KNOWLEDGE_ENTITY_TYPES.includes(value.subjectEntityType as KnowledgeEntityType) ||
    value.subjectEntityType === "SourceClaim" ||
    typeof value.field !== "string" ||
    typeof value.value !== "string" ||
    !isFiniteNumber(value.confidence) ||
    !claimStatuses.includes(String(value.status))
  ) {
    return null;
  }

  return {
    id: value.id,
    type: "SourceClaim",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    sourceName: value.sourceName,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : undefined,
    subjectEntityId: value.subjectEntityId,
    subjectEntityType: value.subjectEntityType as SourceClaimEntity["subjectEntityType"],
    field: value.field,
    value: value.value,
    confidence: Math.max(0, Math.min(1, value.confidence)),
    status: value.status as SourceClaimEntity["status"],
  };
};

const normalizeRelationshipEntity = (value: Record<string, unknown>): RelationshipEntity | null => {
  if (!hasEntityBase(value, "Relationship")) return null;
  const relationshipStatuses = ["suggested", "accepted", "rejected", "needs_source"];
  if (
    typeof value.sourceId !== "string" ||
    typeof value.targetId !== "string" ||
    typeof value.relationshipType !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    type: "Relationship",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    sourceId: value.sourceId,
    targetId: value.targetId,
    relationshipType: value.relationshipType,
    strength: isFiniteNumber(value.strength) ? value.strength : undefined,
    confidence: normalizeConfidence(value.confidence),
    status: relationshipStatuses.includes(String(value.status)) ? value.status as RelationshipEntity["status"] : undefined,
  };
};

export const normalizeKnowledgeEntities = (value: unknown): KnowledgeEntity[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): KnowledgeEntity | null => {
      if (!isRecord(item)) return null;
      switch (item.type) {
        case "Person":
          return normalizePersonEntity(item);
        case "Work":
          return normalizeWorkEntity(item);
        case "Concept":
          return normalizeConceptEntity(item);
        case "Movement":
          return normalizeMovementEntity(item);
        case "Institution":
          return normalizeInstitutionEntity(item);
        case "SourceClaim":
          return normalizeSourceClaimEntity(item);
        case "Relationship":
          return normalizeRelationshipEntity(item);
        default:
          return null;
      }
    })
    .filter((item): item is KnowledgeEntity => Boolean(item));
};

export const buildPersonEntitiesFromThinkers = (people: Thinker[]): PersonEntity[] =>
  people.map((person) => ({
    id: `person:${person.id}`,
    type: "Person",
    label: person.name,
    thinkerId: person.id,
    birth: person.birth,
    death: person.death,
    fields: person.fields,
  }));
