import { describe, expect, it } from "vitest";
import {
  ATLAS_STATE_SCHEMA_VERSION,
  ATLAS_STATE_STORAGE_KEY,
  LEGACY_EDGES_STORAGE_KEY,
  LEGACY_PEOPLE_STORAGE_KEY,
  loadAtlasStateFromStorage,
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
});
