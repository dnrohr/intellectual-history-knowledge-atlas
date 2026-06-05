import { SourceAdapter, SourceAdapterEntitySearchResult, SourceAdapterFetchResult } from "./sourceAdapters";
import { KnowledgeEntityType, SourceClaimDraft, SourceObservation } from "./types";

export interface ManualSourceEntry {
  id: string;
  title: string;
  sourceName: string;
  sourceUrl?: string;
  sourceType: "reference" | "encyclopedia" | "bibliographic" | "primary_text" | "curated_dataset";
  subjects: Array<{
    entityId: string;
    entityType: Exclude<KnowledgeEntityType, "SourceClaim">;
    label: string;
  }>;
  claims: Array<Omit<SourceClaimDraft, "sourceName" | "sourceUrl" | "sourceType" | "sourceReliability" | "extractionMethod">>;
}

const makeObservation = (entry: ManualSourceEntry): SourceObservation => ({
  id: `observation:manual:${entry.id}`,
  sourceName: entry.sourceName,
  sourceUrl: entry.sourceUrl,
  sourceType: entry.sourceType,
  observedAt: new Date().toISOString(),
  raw: entry,
  normalizedClaims: entry.claims.map((claim) => ({
    ...claim,
    sourceName: entry.sourceName,
    sourceUrl: entry.sourceUrl,
    sourceType: entry.sourceType,
    sourceReliability: entry.sourceType === "primary_text" ? 0.95 : 0.8,
    extractionMethod: "manual_seed",
  })),
});

const matchesEntry = (entry: ManualSourceEntry, query = "") => {
  const needle = query.toLowerCase();
  return !needle || [entry.title, entry.sourceName, ...entry.subjects.map((subject) => subject.label)]
    .some((value) => value.toLowerCase().includes(needle));
};

const resultFromEntries = (
  entries: ManualSourceEntry[]
): SourceAdapterFetchResult<SourceAdapterEntitySearchResult> => {
  const observations = entries.map(makeObservation);
  return {
    adapterId: "manual-source",
    observations,
    claims: observations.flatMap((observation) => observation.normalizedClaims),
    records: entries.flatMap((entry) => entry.subjects.map((subject) => ({
      sourceId: entry.id,
      label: subject.label,
      entityType: subject.entityType === "Relationship" ? "Person" : subject.entityType,
      description: entry.title,
      sourceUrl: entry.sourceUrl,
      confidence: entry.sourceType === "primary_text" ? 0.85 : 0.75,
    }))),
  };
};

export const createManualSourceAdapter = (entries: ManualSourceEntry[]): SourceAdapter => ({
  id: "manual-source",
  name: "Manual reference sources",
  async searchEntities(context) {
    return resultFromEntries(entries.filter((entry) => matchesEntry(entry, context.query)).slice(0, context.limit || entries.length));
  },
  async fetchEntityDetail(context) {
    const matches = entries.filter((entry) =>
      entry.id === context.sourceId ||
      entry.subjects.some((subject) => subject.entityId === context.entityId)
    );
    return {
      ...resultFromEntries(matches),
      records: [],
    };
  },
  async fetchRelationships() {
    return { ...resultFromEntries(entries), records: [] };
  },
  async fetchWorks() {
    return { ...resultFromEntries(entries), records: [] };
  },
  async fetchAffiliations() {
    return { ...resultFromEntries(entries), records: [] };
  },
  async fetchCitationsOrReferences() {
    return { ...resultFromEntries(entries), records: [] };
  },
  normalizeSourceClaims(observations) {
    return observations.flatMap((observation) => observation.normalizedClaims);
  },
});
