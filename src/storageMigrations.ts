import { buildExpandedKnowledgeEntitiesFromAtlas, normalizeKnowledgeEntities } from "./knowledgeModel";
import { InfluenceEdge, KnowledgeEntity, Thinker } from "./types";
import { hasEdgeSourceEvidence, normalizeEdgeStatus, normalizeStoredEdges, normalizeStoredPeople } from "./storageSchemas";

export const ATLAS_STATE_SCHEMA_VERSION = 8;
export const ATLAS_STATE_STORAGE_KEY = "atlas_state_v8";
export const PREVIOUS_ATLAS_STATE_STORAGE_KEY = "atlas_state_v7";
export const LEGACY_PEOPLE_STORAGE_KEY = "atlas_people_v6";
export const LEGACY_EDGES_STORAGE_KEY = "atlas_edges_v6";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredAtlasState = {
  version: number;
  updatedAt: string;
  people: Thinker[];
  edges: InfluenceEdge[];
  entities: KnowledgeEntity[];
};

export const normalizeStoredAtlasState = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const stored = value as Partial<StoredAtlasState>;
  const people = normalizeStoredPeople(stored.people);
  if (people.length === 0) return null;
  const edges = normalizeStoredEdges(stored.edges, people);
  const entities = normalizeKnowledgeEntities(stored.entities);
  return {
    people,
    edges,
    entities: entities.length > 0 ? entities : buildExpandedKnowledgeEntitiesFromAtlas(people, edges),
  };
};

const getEdgeMergeKey = (edge: InfluenceEdge) =>
  `${edge.sourceEntityType || "Person"}:${edge.source}->${edge.targetEntityType || "Person"}:${edge.target}:${edge.type}`;

const mergeUniqueStrings = (...values: Array<string[] | undefined>) =>
  Array.from(new Set(values.flatMap((items) => items || [])));

const stripSourceAnnotationsFromNotes = (notes: string | null | undefined) => {
  if (!notes) return notes ?? null;
  const cleaned = notes
    .replace(/\s*Merged duplicate import from Wikidata:\s*https?:\/\/\S+/gi, "")
    .replace(/\s*Imported from Wikidata(?:\s*:\s*https?:\/\/\S+)?/gi, "")
    .trim();
  return cleaned || null;
};

const mergeImportedPersonWithCanonical = (stored: Thinker, canonical: Thinker): Thinker => ({
  ...stored,
  name: canonical.name,
  birth: canonical.birth,
  death: canonical.death,
  fields: mergeUniqueStrings(canonical.fields, stored.fields),
  subfields: mergeUniqueStrings(canonical.subfields, stored.subfields),
  region: canonical.region || stored.region,
  era: canonical.era || stored.era,
  movement: canonical.movement || stored.movement,
  bridge_score: Math.max(canonical.bridge_score || 0, stored.bridge_score || 0),
  works: mergeUniqueStrings(canonical.works, stored.works),
  notes: canonical.notes || stripSourceAnnotationsFromNotes(stored.notes),
});

const mergeCanonicalEdgeEvidence = (storedEdge: InfluenceEdge, seedEdge: InfluenceEdge): InfluenceEdge => {
  const sourceClaims = mergeUniqueStrings(storedEdge.sourceClaims, seedEdge.sourceClaims);
  const claimIds = mergeUniqueStrings(storedEdge.claimIds, seedEdge.claimIds);
  const threadIds = mergeUniqueStrings(storedEdge.threadIds, seedEdge.threadIds);
  const confidence = Math.max(storedEdge.confidence ?? 0, seedEdge.confidence ?? 0) || undefined;
  const status = storedEdge.status === "rejected"
    ? storedEdge.status
    : normalizeEdgeStatus(
        seedEdge.status === "accepted" || storedEdge.status === "accepted" ? "accepted" : storedEdge.status,
        confidence,
        sourceClaims,
        claimIds
      );

  return {
    ...storedEdge,
    confidence,
    sourceClaims,
    claimIds,
    threadIds,
    status,
  };
};

export const mergeAtlasStateWithCanonicalSeed = (
  atlasState: { people: Thinker[]; edges: InfluenceEdge[] },
  canonicalPeople: Thinker[],
  canonicalEdges: InfluenceEdge[],
  retiredCanonicalPersonIds: readonly string[] = []
) => {
  const retiredIds = new Set(retiredCanonicalPersonIds);
  const canonicalPeopleById = new Map(canonicalPeople.map((person) => [person.id, person]));
  const mergedPeople = atlasState.people
    .filter((person) => !retiredIds.has(person.id))
    .map((person) => {
      const canonical = canonicalPeopleById.get(person.id);
      const wasImported = person.movement === "Imported" || /Imported from Wikidata/i.test(person.notes || "");
      return canonical && wasImported
        ? mergeImportedPersonWithCanonical(person, canonical)
        : { ...person, notes: stripSourceAnnotationsFromNotes(person.notes) };
    });
  const peopleIds = new Set(mergedPeople.map((person) => person.id));
  canonicalPeople.forEach((person) => {
    if (!peopleIds.has(person.id)) {
      mergedPeople.push(person);
      peopleIds.add(person.id);
    }
  });

  const normalizedSeedEdges = normalizeStoredEdges(canonicalEdges, mergedPeople);
  const edgeByKey = new Map<string, InfluenceEdge>();
  normalizeStoredEdges(atlasState.edges, mergedPeople)
    .filter((edge) => !retiredIds.has(edge.source) && !retiredIds.has(edge.target))
    .forEach((edge) => {
      edgeByKey.set(getEdgeMergeKey(edge), edge);
    });

  normalizedSeedEdges.forEach((seedEdge) => {
    const key = getEdgeMergeKey(seedEdge);
    const storedEdge = edgeByKey.get(key);
    edgeByKey.set(key, storedEdge ? mergeCanonicalEdgeEvidence(storedEdge, seedEdge) : seedEdge);
  });

  const mergedEdges = Array.from(edgeByKey.values()).filter((edge) =>
    edge.status !== "accepted" || hasEdgeSourceEvidence(edge)
  );

  return {
    people: normalizeStoredPeople(mergedPeople),
    edges: normalizeStoredEdges(mergedEdges, mergedPeople),
  };
};

export const serializeAtlasState = (people: Thinker[], edges: InfluenceEdge[]) => {
  const normalizedPeople = normalizeStoredPeople(people);
  const normalizedEdges = normalizeStoredEdges(edges, normalizedPeople);
  const entities = buildExpandedKnowledgeEntitiesFromAtlas(normalizedPeople, normalizedEdges);
  return JSON.stringify({
    version: ATLAS_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    people: normalizedPeople,
    edges: normalizedEdges,
    entities,
  } satisfies StoredAtlasState);
};

export const persistAtlasStateToStorage = (
  people: Thinker[],
  edges: InfluenceEdge[],
  storage: StorageLike = localStorage
) => {
  storage.setItem(ATLAS_STATE_STORAGE_KEY, serializeAtlasState(people, edges));
  storage.removeItem(PREVIOUS_ATLAS_STATE_STORAGE_KEY);
  storage.removeItem(LEGACY_PEOPLE_STORAGE_KEY);
  storage.removeItem(LEGACY_EDGES_STORAGE_KEY);
};

export const clearPersistedAtlasState = (storage: StorageLike = localStorage) => {
  storage.removeItem(ATLAS_STATE_STORAGE_KEY);
  storage.removeItem(PREVIOUS_ATLAS_STATE_STORAGE_KEY);
  storage.removeItem(LEGACY_PEOPLE_STORAGE_KEY);
  storage.removeItem(LEGACY_EDGES_STORAGE_KEY);
};

export const loadAtlasStateFromStorage = (storage: StorageLike = localStorage) => {
  const savedState = storage.getItem(ATLAS_STATE_STORAGE_KEY);
  if (savedState) {
    const normalizedState = normalizeStoredAtlasState(JSON.parse(savedState));
    if (normalizedState) return normalizedState;
  }

  const previousState = storage.getItem(PREVIOUS_ATLAS_STATE_STORAGE_KEY);
  if (previousState) {
    const normalizedState = normalizeStoredAtlasState(JSON.parse(previousState));
    if (normalizedState) {
      persistAtlasStateToStorage(normalizedState.people, normalizedState.edges, storage);
      return normalizedState;
    }
  }

  const legacyPeople = storage.getItem(LEGACY_PEOPLE_STORAGE_KEY);
  const legacyEdges = storage.getItem(LEGACY_EDGES_STORAGE_KEY);
  if (!legacyPeople || !legacyEdges) return null;

  const people = normalizeStoredPeople(JSON.parse(legacyPeople));
  if (people.length === 0) return null;
  const edges = normalizeStoredEdges(JSON.parse(legacyEdges), people);
  persistAtlasStateToStorage(people, edges, storage);
  return {
    people,
    edges,
    entities: buildExpandedKnowledgeEntitiesFromAtlas(people, edges),
  };
};
