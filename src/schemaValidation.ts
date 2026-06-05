import { normalizeKnowledgeEntities } from "./knowledgeModel";
import { normalizeStoredEdges, normalizeStoredPeople } from "./storageSchemas";
import { InfluenceEdge, KnowledgeEntity, Thinker } from "./types";

export interface SchemaValidationIssue {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  people: Thinker[];
  edges: InfluenceEdge[];
  entities: KnowledgeEntity[];
  issues: SchemaValidationIssue[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const validateArrayItems = <T>(
  value: unknown,
  path: string,
  normalizeOne: (item: unknown) => T[]
) => {
  if (value === undefined) return { normalized: [] as T[], issues: [] as SchemaValidationIssue[] };
  if (!Array.isArray(value)) {
    return {
      normalized: [] as T[],
      issues: [{ path, message: "Expected an array." }],
    };
  }

  const normalized: T[] = [];
  const issues: SchemaValidationIssue[] = [];
  value.forEach((item, index) => {
    const itemResult = normalizeOne(item);
    if (itemResult.length === 0) {
      issues.push({ path: `${path}[${index}]`, message: "Record does not match the atlas schema." });
      return;
    }
    normalized.push(...itemResult);
  });

  return { normalized, issues };
};

export const validateImportedOrGeneratedAtlasData = (value: unknown): SchemaValidationResult => {
  if (!isRecord(value)) {
    return {
      people: [],
      edges: [],
      entities: [],
      issues: [{ path: "$", message: "Expected an object with people, edges, or entities arrays." }],
    };
  }

  const peopleResult = validateArrayItems(value.people, "people", (item) => normalizeStoredPeople([item]));
  const people = peopleResult.normalized;
  const edgeResult = validateArrayItems(value.edges, "edges", (item) => normalizeStoredEdges([item], people));
  const entityResult = validateArrayItems(value.entities, "entities", (item) => normalizeKnowledgeEntities([item]));

  return {
    people,
    edges: edgeResult.normalized,
    entities: entityResult.normalized,
    issues: [
      ...peopleResult.issues,
      ...edgeResult.issues,
      ...entityResult.issues,
    ],
  };
};
