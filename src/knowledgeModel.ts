import {
  ConceptEntity,
  InfluenceEdge,
  Institution,
  InstitutionEntity,
  KnownRelationshipType,
  KnowledgeEntity,
  KnowledgeEntityType,
  Movement,
  MovementEntity,
  PersonEntity,
  RelationshipEntity,
  RelationshipEndpointType,
  RelationshipTypeDefinition,
  SourceClaimDraft,
  SourceClaimStatus,
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

const normalizeRequiredConfidence = (value: unknown) =>
  normalizeConfidence(value) ?? 0.5;

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
  const source = normalizeRelationshipEndpoint(value.source);
  const target = normalizeRelationshipEndpoint(value.target);
  if (
    !source ||
    !target ||
    typeof value.relationshipType !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    type: "Relationship",
    label: value.label,
    claimIds: normalizeClaimIds(value.claimIds),
    source,
    target,
    relationshipType: value.relationshipType,
    strength: isFiniteNumber(value.strength) ? value.strength : undefined,
    confidence: normalizeConfidence(value.confidence),
    status: relationshipStatuses.includes(String(value.status)) ? value.status as RelationshipEntity["status"] : undefined,
  };
};

const RELATIONSHIP_ENDPOINT_TYPES: RelationshipEndpointType[] = [
  "Person",
  "Work",
  "Concept",
  "Movement",
  "Institution",
];

const normalizeRelationshipEndpoint = (value: unknown) => {
  if (!isRecord(value) || typeof value.entityId !== "string") return null;
  if (!RELATIONSHIP_ENDPOINT_TYPES.includes(value.entityType as RelationshipEndpointType)) return null;
  return {
    entityId: value.entityId,
    entityType: value.entityType as RelationshipEndpointType,
  };
};

export const getRelationshipRecordId = (
  sourceId: string,
  targetId: string,
  relationshipType: string
) => `relationship:${sourceId}:${relationshipType}:${targetId}`;

const getPersonEntityId = (personId: string) =>
  personId.startsWith("person:") ? personId : `person:${personId}`;

const normalizeIdPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

export const getWorkEntityId = (personId: string, title: string) =>
  `work:${normalizeIdPart(personId)}:${normalizeIdPart(title)}`;

export const getConceptEntityId = (label: string) =>
  `concept:${normalizeIdPart(label)}`;

export const getMovementEntityId = (label: string) =>
  `movement:${normalizeIdPart(label)}`;

export const getInstitutionEntityId = (label: string) =>
  `institution:${normalizeIdPart(label)}`;

export const getSourceClaimEntityId = (
  subjectEntityId: string,
  field: string,
  sourceName: string,
  value: string
) => `claim:${normalizeIdPart(subjectEntityId)}:${normalizeIdPart(field)}:${normalizeIdPart(sourceName)}:${normalizeIdPart(value)}`;

export const RELATIONSHIP_TYPE_DEFINITIONS: RelationshipTypeDefinition[] = [
  { type: "person authored work", sourceType: "Person", targetType: "Work" },
  { type: "work introduced concept", sourceType: "Work", targetType: "Concept" },
  { type: "person influenced person", sourceType: "Person", targetType: "Person" },
  { type: "person mentored person", sourceType: "Person", targetType: "Person" },
  { type: "person collaborated with person", sourceType: "Person", targetType: "Person" },
  { type: "person participated in movement", sourceType: "Person", targetType: "Movement" },
  { type: "person affiliated with institution", sourceType: "Person", targetType: "Institution" },
  { type: "concept shaped movement", sourceType: "Concept", targetType: "Movement" },
  { type: "work influenced work", sourceType: "Work", targetType: "Work" },
];

export const getRelationshipTypeDefinition = (relationshipType: string) =>
  RELATIONSHIP_TYPE_DEFINITIONS.find((definition) => definition.type === relationshipType);

export const isKnownRelationshipType = (relationshipType: string): relationshipType is KnownRelationshipType =>
  Boolean(getRelationshipTypeDefinition(relationshipType));

export const relationshipEndpointsMatchType = (
  relationshipType: string,
  sourceType: RelationshipEndpointType,
  targetType: RelationshipEndpointType
) => {
  const definition = getRelationshipTypeDefinition(relationshipType);
  if (!definition) return true;
  return definition.sourceType === sourceType && definition.targetType === targetType;
};

export interface SourceClaimAggregation {
  subjectEntityId: string;
  subjectEntityType: SourceClaimEntity["subjectEntityType"];
  claimIds: string[];
  statusCounts: Record<SourceClaimStatus, number>;
  averageConfidence: number;
}

const emptyStatusCounts = (): Record<SourceClaimStatus, number> => ({
  observed: 0,
  candidate: 0,
  accepted: 0,
  rejected: 0,
  stale: 0,
  conflicting: 0,
});

export const aggregateSourceClaimsBySubject = (
  claims: SourceClaimEntity[]
): SourceClaimAggregation[] => {
  const aggregations = new Map<string, SourceClaimAggregation & { confidenceTotal: number }>();

  claims.forEach((claim) => {
    const key = `${claim.subjectEntityType}:${claim.subjectEntityId}`;
    const existing = aggregations.get(key) || {
      subjectEntityId: claim.subjectEntityId,
      subjectEntityType: claim.subjectEntityType,
      claimIds: [],
      statusCounts: emptyStatusCounts(),
      averageConfidence: 0,
      confidenceTotal: 0,
    };

    existing.claimIds.push(claim.id);
    existing.statusCounts[claim.status] += 1;
    existing.confidenceTotal += claim.confidence;
    existing.averageConfidence = existing.confidenceTotal / existing.claimIds.length;
    aggregations.set(key, existing);
  });

  return Array.from(aggregations.values())
    .map(({ confidenceTotal: _confidenceTotal, ...aggregation }) => aggregation)
    .sort((a, b) => `${a.subjectEntityType}:${a.subjectEntityId}`.localeCompare(`${b.subjectEntityType}:${b.subjectEntityId}`));
};

export const getAggregatedClaimIdsForSubject = (
  aggregations: SourceClaimAggregation[],
  subjectEntityId: string,
  subjectEntityType: SourceClaimEntity["subjectEntityType"]
) =>
  aggregations.find((aggregation) =>
    aggregation.subjectEntityId === subjectEntityId &&
    aggregation.subjectEntityType === subjectEntityType
  )?.claimIds || [];

export const createSourceClaimEntity = (draft: SourceClaimDraft): SourceClaimEntity => {
  const id = draft.id || getSourceClaimEntityId(draft.subjectEntityId, draft.field, draft.sourceName, draft.value);
  return {
    id,
    type: "SourceClaim",
    label: draft.label || `${draft.sourceName}: ${draft.field}`,
    sourceName: draft.sourceName,
    sourceUrl: draft.sourceUrl,
    subjectEntityId: draft.subjectEntityId,
    subjectEntityType: draft.subjectEntityType,
    field: draft.field,
    value: draft.value,
    confidence: normalizeRequiredConfidence(draft.confidence),
    status: draft.status || "observed",
  };
};

export const buildRelationshipEntityFromInfluenceEdge = (edge: InfluenceEdge): RelationshipEntity => {
  const sourceEntityType = edge.sourceEntityType || "Person";
  const targetEntityType = edge.targetEntityType || "Person";
  const relationshipType = isKnownRelationshipType(edge.type) && !relationshipEndpointsMatchType(edge.type, sourceEntityType, targetEntityType)
    ? "person influenced person"
    : edge.type;
  const sourceEntityId = sourceEntityType === "Person" ? getPersonEntityId(edge.source) : edge.source;
  const targetEntityId = targetEntityType === "Person" ? getPersonEntityId(edge.target) : edge.target;

  return {
    id: edge.id || getRelationshipRecordId(sourceEntityId, targetEntityId, relationshipType),
    type: "Relationship",
    label: `${sourceEntityId} ${relationshipType} ${targetEntityId}`,
    source: {
      entityId: sourceEntityId,
      entityType: sourceEntityType,
    },
    target: {
      entityId: targetEntityId,
      entityType: targetEntityType,
    },
    relationshipType,
    strength: edge.strength,
    confidence: edge.confidence,
    status: edge.status,
    claimIds: edge.sourceClaims || [],
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
    claimIds: person.claimIds || [],
    thinkerId: person.id,
    birth: person.birth,
    death: person.death,
    fields: person.fields,
  }));

export const buildWorkEntitiesFromThinkers = (people: Thinker[]): WorkEntity[] => {
  const works = new Map<string, WorkEntity>();

  people.forEach((person) => {
    (person.works || []).forEach((title) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;
      const id = getWorkEntityId(person.id, trimmedTitle);
      works.set(id, {
        id,
        type: "Work",
        label: trimmedTitle,
        title: trimmedTitle,
        authorIds: [getPersonEntityId(person.id)],
      });
    });
  });

  return Array.from(works.values());
};

export const buildWorkAuthorshipRelationships = (people: Thinker[]): RelationshipEntity[] =>
  buildWorkEntitiesFromThinkers(people).flatMap((work) =>
    (work.authorIds || []).map((authorId) => ({
      id: getRelationshipRecordId(authorId, work.id, "person authored work"),
      type: "Relationship" as const,
      label: `${authorId} authored ${work.label}`,
      source: {
        entityId: authorId,
        entityType: "Person" as const,
      },
      target: {
        entityId: work.id,
        entityType: "Work" as const,
      },
      relationshipType: "person authored work",
      status: "accepted" as const,
    }))
  );

export const buildConceptEntitiesFromThinkers = (people: Thinker[]): ConceptEntity[] => {
  const concepts = new Map<string, ConceptEntity>();

  people.forEach((person) => {
    (person.subfields || []).forEach((conceptLabel) => {
      const trimmedLabel = conceptLabel.trim();
      if (!trimmedLabel) return;
      const id = getConceptEntityId(trimmedLabel);
      const existing = concepts.get(id);
      const fields = new Set([...(existing?.fields || []), ...(person.fields || [])]);
      concepts.set(id, {
        id,
        type: "Concept",
        label: trimmedLabel,
        claimIds: existing?.claimIds || [],
        fields: Array.from(fields).sort(),
      });
    });
  });

  return Array.from(concepts.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export const buildMovementEntities = (
  people: Thinker[],
  curatedMovements: Movement[] = []
): MovementEntity[] => {
  const movements = new Map<string, MovementEntity>();

  curatedMovements.forEach((movement) => {
    const id = getMovementEntityId(movement.name);
    movements.set(id, {
      id,
      type: "Movement",
      label: movement.name,
      claimIds: movement.claimIds || [],
      start: movement.start,
      end: movement.end,
      fields: [...movement.fields].sort(),
    });
  });

  people.forEach((person) => {
    if (!person.movement) return;
    const id = getMovementEntityId(person.movement);
    const existing = movements.get(id);
    const fields = new Set([...(existing?.fields || []), ...(person.fields || [])]);
    movements.set(id, {
      id,
      type: "Movement",
      label: existing?.label || person.movement,
      claimIds: existing?.claimIds || [],
      start: existing?.start ?? null,
      end: existing?.end ?? null,
      fields: Array.from(fields).sort(),
    });
  });

  return Array.from(movements.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export const buildInstitutionEntities = (institutions: Institution[]): InstitutionEntity[] =>
  institutions
    .map((institution) => ({
      id: getInstitutionEntityId(institution.name),
      type: "Institution" as const,
      label: institution.name,
      claimIds: institution.claimIds || [],
      city: institution.city,
      figureIds: institution.figures.map(getPersonEntityId),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

export const buildExpandedKnowledgeEntitiesFromAtlas = (
  people: Thinker[],
  edges: InfluenceEdge[]
): KnowledgeEntity[] => [
  ...buildPersonEntitiesFromThinkers(people),
  ...buildWorkEntitiesFromThinkers(people),
  ...buildConceptEntitiesFromThinkers(people),
  ...buildMovementEntities(people),
  ...edges.map(buildRelationshipEntityFromInfluenceEdge),
];
