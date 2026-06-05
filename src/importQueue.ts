export type WikidataCandidate = {
  id: string;
  entityType?: "Person" | "Work" | "Concept" | "Movement" | "Institution";
  name: string;
  description: string;
  birth: number | null;
  death: number | null;
  aliases?: string[];
  fields?: string[];
  topics?: string[];
  region?: string | null;
  era?: string | null;
  movement?: string | null;
  works?: string[];
  institutions?: string[];
  movements?: string[];
  concepts?: string[];
  awards?: string[];
  advisors?: string[];
  students?: string[];
  influencedBy?: string[];
  employers?: string[];
  educatedAt?: string[];
  memberOf?: string[];
  sourceUrl: string;
  wikipediaUrl: string | null;
  wikidataClaims?: {
    instanceOf?: string[];
    occupations?: string[];
    fieldsOfWork?: string[];
    notableWorks?: string[];
    movements?: string[];
    awards?: string[];
    employers?: string[];
    educatedAt?: string[];
    memberOf?: string[];
    advisors?: string[];
    students?: string[];
    influencedBy?: string[];
  };
};

export type ImportReviewStatus = "queued" | "edited" | "accepted" | "skipped" | "duplicate";

export type ImportReviewItem = {
  id: string;
  candidate: WikidataCandidate;
  confidence: number;
  duplicateId: string | null;
  status: ImportReviewStatus;
};

type StoredImportReviewQueue = {
  version: number;
  updatedAt: string;
  items: ImportReviewItem[];
};

export const IMPORT_QUEUE_SCHEMA_VERSION = 2;
export const IMPORT_QUEUE_STORAGE_KEY = "atlas_import_queue_v2";
export const LEGACY_IMPORT_QUEUE_STORAGE_KEY = "atlas_import_queue_v1";

const IMPORT_QUEUE_STATUSES: ImportReviewStatus[] = ["queued", "edited", "accepted", "skipped", "duplicate"];

const isImportReviewStatus = (status: unknown): status is ImportReviewStatus =>
  typeof status === "string" && IMPORT_QUEUE_STATUSES.includes(status as ImportReviewStatus);

const normalizeImportReviewQueueItem = (item: Partial<ImportReviewItem> | null | undefined): ImportReviewItem | null => {
  if (!item || !item.id || !item.candidate?.id || !item.candidate.name) return null;
  const duplicateId = typeof item.duplicateId === "string" ? item.duplicateId : null;
  return {
    id: String(item.id),
    candidate: item.candidate,
    confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(100, Math.round(Number(item.confidence)))) : 0,
    duplicateId,
    status: isImportReviewStatus(item.status) ? item.status : duplicateId ? "duplicate" : "queued",
  };
};

export const normalizeImportReviewQueue = (items: unknown): ImportReviewItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => normalizeImportReviewQueueItem(item as Partial<ImportReviewItem>))
    .filter((item): item is ImportReviewItem => Boolean(item));
};

export const normalizeStoredImportReviewQueue = (storedQueue: unknown): ImportReviewItem[] => {
  if (Array.isArray(storedQueue)) return normalizeImportReviewQueue(storedQueue);
  if (storedQueue && typeof storedQueue === "object" && Array.isArray((storedQueue as StoredImportReviewQueue).items)) {
    return normalizeImportReviewQueue((storedQueue as StoredImportReviewQueue).items);
  }
  return [];
};

export const parseStoredImportReviewQueue = (savedQueue: string): ImportReviewItem[] => {
  return normalizeStoredImportReviewQueue(JSON.parse(savedQueue));
};

export const serializeImportReviewQueue = (items: ImportReviewItem[]) =>
  JSON.stringify({
    version: IMPORT_QUEUE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    items: normalizeImportReviewQueue(items),
  } satisfies StoredImportReviewQueue);

export const persistImportReviewQueueToStorage = (items: ImportReviewItem[]) => {
  localStorage.setItem(IMPORT_QUEUE_STORAGE_KEY, serializeImportReviewQueue(items));
  localStorage.removeItem(LEGACY_IMPORT_QUEUE_STORAGE_KEY);
};
