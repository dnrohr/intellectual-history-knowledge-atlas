import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMPORT_QUEUE_SCHEMA_VERSION,
  IMPORT_QUEUE_STORAGE_KEY,
  LEGACY_IMPORT_QUEUE_STORAGE_KEY,
  ImportReviewItem,
  normalizeImportReviewQueue,
  parseStoredImportReviewQueue,
  persistImportReviewQueueToStorage,
  serializeImportReviewQueue,
} from "./importQueue";

const candidate = {
  id: "q1",
  name: "Candidate",
  description: "",
  birth: null,
  death: null,
  sourceUrl: "https://www.wikidata.org/wiki/Q1",
  wikipediaUrl: null,
};

const item = (overrides: Partial<ImportReviewItem> = {}): ImportReviewItem => ({
  id: "q1",
  candidate,
  confidence: 80,
  duplicateId: null,
  status: "queued",
  ...overrides,
});

describe("import queue persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes invalid queue items and clamps confidence", () => {
    const normalized = normalizeImportReviewQueue([
      item({ confidence: 140, status: "accepted" }),
      item({ id: "", status: "queued" }),
      { id: "q2", candidate: { id: "q2" }, confidence: 20, status: "queued" },
      item({ id: "q3", duplicateId: "existing", status: "unknown" as ImportReviewItem["status"] }),
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].confidence).toBe(100);
    expect(normalized[0].status).toBe("accepted");
    expect(normalized[1].status).toBe("duplicate");
  });

  it("parses legacy array storage and versioned object storage", () => {
    const legacyQueue = parseStoredImportReviewQueue(JSON.stringify([item()]));
    const versionedQueue = parseStoredImportReviewQueue(JSON.stringify({
      version: IMPORT_QUEUE_SCHEMA_VERSION,
      updatedAt: "2026-01-01T00:00:00.000Z",
      items: [item({ id: "q2", candidate: { ...candidate, id: "q2", name: "Second" } })],
    }));

    expect(legacyQueue).toHaveLength(1);
    expect(versionedQueue).toHaveLength(1);
    expect(versionedQueue[0].candidate.name).toBe("Second");
  });

  it("serializes normalized queue items with schema metadata", () => {
    const serialized = JSON.parse(serializeImportReviewQueue([
      item({ confidence: -10 }),
      item({ id: "", status: "queued" }),
    ]));

    expect(serialized.version).toBe(IMPORT_QUEUE_SCHEMA_VERSION);
    expect(serialized.updatedAt).toEqual(expect.any(String));
    expect(serialized.items).toHaveLength(1);
    expect(serialized.items[0].confidence).toBe(0);
  });

  it("persists current storage and removes the legacy key", () => {
    const storage = new Map<string, string>([[LEGACY_IMPORT_QUEUE_STORAGE_KEY, "legacy"]]);
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });

    persistImportReviewQueueToStorage([item()]);

    expect(storage.has(LEGACY_IMPORT_QUEUE_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(storage.get(IMPORT_QUEUE_STORAGE_KEY) || "{}").items).toHaveLength(1);
  });
});
