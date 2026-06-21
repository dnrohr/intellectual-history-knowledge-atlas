import { describe, expect, it } from "vitest";
import {
  ATLAS_STATE_SCHEMA_VERSION,
  ATLAS_STATE_STORAGE_KEY,
  clearPersistedAtlasState,
  LEGACY_EDGES_STORAGE_KEY,
  LEGACY_PEOPLE_STORAGE_KEY,
  loadAtlasStateFromStorage,
  mergeAtlasStateWithCanonicalSeed,
  PREVIOUS_ATLAS_STATE_STORAGE_KEY,
  persistAtlasStateToStorage,
  serializeAtlasState,
} from "./storageMigrations";
import { InfluenceEdge, Thinker } from "./types";

const person = (id: string): Thinker => ({
  id,
  name: id,
  birth: 1900,
  death: null,
  fields: ["Philosophy"],
});

const edge: InfluenceEdge = {
  source: "source",
  target: "target",
  type: "Influence",
  strength: 4,
};

const storage = (entries: Array<[string, string]> = []) => {
  const values = new Map(entries);
  return {
    values,
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

describe("atlas storage migrations", () => {
  it("serializes a versioned atlas state", () => {
    const serialized = JSON.parse(serializeAtlasState([person("source"), person("target")], [edge]));

    expect(serialized.version).toBe(ATLAS_STATE_SCHEMA_VERSION);
    expect(serialized.people).toHaveLength(2);
    expect(serialized.edges).toHaveLength(1);
    expect(serialized.entities.map((entity: { type: string }) => entity.type)).toEqual([
      "Person",
      "Person",
      "Relationship",
    ]);
  });

  it("loads current versioned storage", () => {
    const store = storage([[ATLAS_STATE_STORAGE_KEY, serializeAtlasState([person("source"), person("target")], [edge])]]);

    const loaded = loadAtlasStateFromStorage(store);

    expect(loaded?.people).toHaveLength(2);
    expect(loaded?.edges).toHaveLength(1);
    expect(loaded?.entities).toHaveLength(3);
  });

  it("migrates previous versioned storage into expanded state storage", () => {
    const previousState = {
      version: 7,
      updatedAt: new Date().toISOString(),
      people: [person("source"), person("target")],
      edges: [edge],
    };
    const store = storage([[PREVIOUS_ATLAS_STATE_STORAGE_KEY, JSON.stringify(previousState)]]);

    const loaded = loadAtlasStateFromStorage(store);

    expect(loaded?.entities.map((entity) => entity.type)).toEqual(["Person", "Person", "Relationship"]);
    expect(store.values.has(ATLAS_STATE_STORAGE_KEY)).toBe(true);
    expect(store.values.has(PREVIOUS_ATLAS_STATE_STORAGE_KEY)).toBe(false);
  });

  it("migrates legacy people and edge keys into versioned storage", () => {
    const store = storage([
      [LEGACY_PEOPLE_STORAGE_KEY, JSON.stringify([person("source"), person("target")])],
      [LEGACY_EDGES_STORAGE_KEY, JSON.stringify([edge])],
    ]);

    const loaded = loadAtlasStateFromStorage(store);

    expect(loaded?.edges).toHaveLength(1);
    expect(store.values.has(ATLAS_STATE_STORAGE_KEY)).toBe(true);
    expect(store.values.has(PREVIOUS_ATLAS_STATE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(LEGACY_PEOPLE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(LEGACY_EDGES_STORAGE_KEY)).toBe(false);
  });

  it("persists only the current storage key", () => {
    const store = storage([
      [PREVIOUS_ATLAS_STATE_STORAGE_KEY, "legacy"],
      [LEGACY_PEOPLE_STORAGE_KEY, "legacy"],
      [LEGACY_EDGES_STORAGE_KEY, "legacy"],
    ]);

    persistAtlasStateToStorage([person("source"), person("target")], [edge], store);

    expect(store.values.has(ATLAS_STATE_STORAGE_KEY)).toBe(true);
    expect(store.values.has(PREVIOUS_ATLAS_STATE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(LEGACY_PEOPLE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(LEGACY_EDGES_STORAGE_KEY)).toBe(false);
  });

  it("clears persisted atlas state keys for public demo sessions", () => {
    const store = storage([
      [ATLAS_STATE_STORAGE_KEY, "current"],
      [PREVIOUS_ATLAS_STATE_STORAGE_KEY, "previous"],
      [LEGACY_PEOPLE_STORAGE_KEY, "people"],
      [LEGACY_EDGES_STORAGE_KEY, "edges"],
      ["atlas_import_queue_v2", "queue"],
    ]);

    clearPersistedAtlasState(store);

    expect(store.values.has(ATLAS_STATE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(PREVIOUS_ATLAS_STATE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(LEGACY_PEOPLE_STORAGE_KEY)).toBe(false);
    expect(store.values.has(LEGACY_EDGES_STORAGE_KEY)).toBe(false);
    expect(store.values.has("atlas_import_queue_v2")).toBe(true);
  });

  it("merges missing canonical people and accepted edges into stale stored state", () => {
    const staleState = {
      people: [person("source"), person("target")],
      edges: [{ ...edge, confidence: 0.3, status: "suggested" as const }],
    };
    const canonicalPeople = [person("source"), person("target"), person("new-target")];
    const canonicalEdges: InfluenceEdge[] = [
      { ...edge, confidence: 0.85, sourceClaims: ["https://example.com/edge"] },
      { source: "target", target: "new-target", type: "Influence", strength: 3, confidence: 0.85, sourceClaims: ["https://example.com/new"] },
    ];

    const merged = mergeAtlasStateWithCanonicalSeed(staleState, canonicalPeople, canonicalEdges);

    expect(merged.people.map((item) => item.id)).toEqual(["source", "target", "new-target"]);
    expect(merged.edges).toHaveLength(2);
    expect(merged.edges[0]).toMatchObject({
      source: "source",
      target: "target",
      confidence: 0.85,
      sourceClaims: ["https://example.com/edge"],
      status: "accepted",
    });
    expect(merged.edges[1]).toMatchObject({
      source: "target",
      target: "new-target",
      status: "accepted",
    });
  });

  it("does not revive locally rejected canonical edges", () => {
    const staleState = {
      people: [person("source"), person("target")],
      edges: [{ ...edge, status: "rejected" as const }],
    };
    const canonicalEdges: InfluenceEdge[] = [
      { ...edge, confidence: 0.85, sourceClaims: ["https://example.com/edge"] },
    ];

    const merged = mergeAtlasStateWithCanonicalSeed(staleState, staleState.people, canonicalEdges);

    expect(merged.edges[0]).toMatchObject({
      status: "rejected",
      sourceClaims: ["https://example.com/edge"],
    });
  });

  it("prunes retired canonical people and their stored edges", () => {
    const staleState = {
      people: [person("source"), person("retired"), person("local-person")],
      edges: [
        { ...edge, target: "retired" },
        { ...edge, target: "local-person" },
      ],
    };

    const merged = mergeAtlasStateWithCanonicalSeed(
      staleState,
      [person("source")],
      [],
      ["retired"]
    );

    expect(merged.people.map((item) => item.id)).toEqual(["source", "local-person"]);
    expect(merged.edges).toHaveLength(1);
    expect(merged.edges[0]).toMatchObject({ source: "source", target: "local-person" });
    expect(merged.edges.some((item) => item.source === "retired" || item.target === "retired")).toBe(false);
  });

  it("removes Wikidata import annotations from persisted card biographies", () => {
    const davidMarr = {
      ...person("david_marr"),
      name: "David Marr",
      notes: "Computational neuroscientist. Imported from Wikidata: https://www.wikidata.org/wiki/Q312640",
    };

    const merged = mergeAtlasStateWithCanonicalSeed({ people: [davidMarr], edges: [] }, [], []);

    expect(merged.people[0].notes).toBe("Computational neuroscientist.");
  });

  it("upgrades a persisted imported person with richer canonical card data", () => {
    const storedMarr = {
      ...person("david_marr"),
      name: "David Marr",
      movement: "Imported",
      works: [],
      notes: "British scientist. Imported from Wikidata: https://www.wikidata.org/wiki/Q92844",
    };
    const canonicalMarr = {
      ...storedMarr,
      movement: "Cognitive Science",
      works: ["Vision"],
      notes: "Established a computational theory of vision.",
    };

    const merged = mergeAtlasStateWithCanonicalSeed({ people: [storedMarr], edges: [] }, [canonicalMarr], []);

    expect(merged.people[0]).toMatchObject({
      movement: "Cognitive Science",
      works: ["Vision"],
      notes: "Established a computational theory of vision.",
    });
  });
});
