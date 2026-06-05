import { InfluenceEdge, Thinker } from "./types";
import { normalizeStoredEdges, normalizeStoredPeople } from "./storageSchemas";

export const ATLAS_STATE_SCHEMA_VERSION = 7;
export const ATLAS_STATE_STORAGE_KEY = "atlas_state_v7";
export const LEGACY_PEOPLE_STORAGE_KEY = "atlas_people_v6";
export const LEGACY_EDGES_STORAGE_KEY = "atlas_edges_v6";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredAtlasState = {
  version: number;
  updatedAt: string;
  people: Thinker[];
  edges: InfluenceEdge[];
};

export const normalizeStoredAtlasState = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const stored = value as Partial<StoredAtlasState>;
  const people = normalizeStoredPeople(stored.people);
  if (people.length === 0) return null;
  return {
    people,
    edges: normalizeStoredEdges(stored.edges, people),
  };
};

export const serializeAtlasState = (people: Thinker[], edges: InfluenceEdge[]) => {
  const normalizedPeople = normalizeStoredPeople(people);
  const normalizedEdges = normalizeStoredEdges(edges, normalizedPeople);
  return JSON.stringify({
    version: ATLAS_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    people: normalizedPeople,
    edges: normalizedEdges,
  } satisfies StoredAtlasState);
};

export const persistAtlasStateToStorage = (
  people: Thinker[],
  edges: InfluenceEdge[],
  storage: StorageLike = localStorage
) => {
  storage.setItem(ATLAS_STATE_STORAGE_KEY, serializeAtlasState(people, edges));
  storage.removeItem(LEGACY_PEOPLE_STORAGE_KEY);
  storage.removeItem(LEGACY_EDGES_STORAGE_KEY);
};

export const loadAtlasStateFromStorage = (storage: StorageLike = localStorage) => {
  const savedState = storage.getItem(ATLAS_STATE_STORAGE_KEY);
  if (savedState) {
    const normalizedState = normalizeStoredAtlasState(JSON.parse(savedState));
    if (normalizedState) return normalizedState;
  }

  const legacyPeople = storage.getItem(LEGACY_PEOPLE_STORAGE_KEY);
  const legacyEdges = storage.getItem(LEGACY_EDGES_STORAGE_KEY);
  if (!legacyPeople || !legacyEdges) return null;

  const people = normalizeStoredPeople(JSON.parse(legacyPeople));
  if (people.length === 0) return null;
  const edges = normalizeStoredEdges(JSON.parse(legacyEdges), people);
  persistAtlasStateToStorage(people, edges, storage);
  return { people, edges };
};
