import { InfluenceEdge, RelationshipEndpointType, Thinker } from "./types";

const EDGE_STATUSES: Array<NonNullable<InfluenceEdge["status"]>> = ["suggested", "accepted", "rejected", "needs_source"];
const RELATIONSHIP_ENDPOINT_TYPES: RelationshipEndpointType[] = ["Person", "Work", "Concept", "Movement", "Institution"];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" ? value : null;

const normalizeEndpointType = (value: unknown): RelationshipEndpointType =>
  typeof value === "string" && RELATIONSHIP_ENDPOINT_TYPES.includes(value as RelationshipEndpointType)
    ? value as RelationshipEndpointType
    : "Person";

const hasValidEndpoint = (
  id: unknown,
  type: RelationshipEndpointType,
  peopleIds: Set<string>
) => typeof id === "string" && (type !== "Person" || peopleIds.has(id));

export const normalizeStoredPeople = (value: unknown): Thinker[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Partial<Thinker> => Boolean(item) && typeof item === "object")
    .map((item): Thinker | null => {
      if (
        typeof item.id !== "string" ||
        typeof item.name !== "string" ||
        !isFiniteNumber(item.birth) ||
        !(item.death === null || isFiniteNumber(item.death)) ||
        !isStringArray(item.fields) ||
        item.fields.length === 0
      ) {
        return null;
      }

      return {
        id: item.id,
        name: item.name,
        birth: item.birth,
        death: item.death,
        fields: item.fields,
        subfields: isStringArray(item.subfields) ? item.subfields : [],
        region: normalizeOptionalString(item.region),
        era: normalizeOptionalString(item.era),
        movement: normalizeOptionalString(item.movement),
        bridge_score: isFiniteNumber(item.bridge_score) ? item.bridge_score : undefined,
        works: isStringArray(item.works) ? item.works : [],
        influenced: isStringArray(item.influenced) ? item.influenced : [],
        claimIds: isStringArray(item.claimIds) ? item.claimIds : [],
        notes: normalizeOptionalString(item.notes),
      } satisfies Thinker;
    })
    .filter((item): item is Thinker => Boolean(item));
};

export const normalizeStoredEdges = (value: unknown, people: Thinker[]): InfluenceEdge[] => {
  if (!Array.isArray(value)) return [];

  const peopleIds = new Set(people.map((person) => person.id));
  return value
    .filter((item): item is Partial<InfluenceEdge> => Boolean(item) && typeof item === "object")
    .map((item): InfluenceEdge | null => {
      const sourceEntityType = normalizeEndpointType(item.sourceEntityType);
      const targetEntityType = normalizeEndpointType(item.targetEntityType);
      if (
        typeof item.source !== "string" ||
        typeof item.target !== "string" ||
        typeof item.type !== "string" ||
        !isFiniteNumber(item.strength) ||
        !hasValidEndpoint(item.source, sourceEntityType, peopleIds) ||
        !hasValidEndpoint(item.target, targetEntityType, peopleIds)
      ) {
        return null;
      }

      const status = typeof item.status === "string" && EDGE_STATUSES.includes(item.status as NonNullable<InfluenceEdge["status"]>)
        ? item.status as InfluenceEdge["status"]
        : undefined;

      return {
        id: typeof item.id === "string" ? item.id : `${item.source}:${item.type}:${item.target}`,
        source: item.source,
        target: item.target,
        sourceEntityType,
        targetEntityType,
        type: item.type,
        strength: item.strength,
        note: normalizeOptionalString(item.note),
        confidence: isFiniteNumber(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : undefined,
        sourceClaims: isStringArray(item.sourceClaims) ? item.sourceClaims : [],
        status,
      } satisfies InfluenceEdge;
    })
    .filter((item): item is InfluenceEdge => Boolean(item));
};
