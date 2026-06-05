import {
  KnowledgeEntity,
  KnowledgeEntityType,
  RelationshipEntity,
  SourceClaimDraft,
  SourceObservation,
} from "./types";

export interface SourceAdapterEntitySearchResult {
  sourceId: string;
  label: string;
  entityType: Exclude<KnowledgeEntityType, "SourceClaim" | "Relationship">;
  description?: string;
  sourceUrl?: string;
  confidence: number;
}

export interface SourceAdapterFetchContext {
  query?: string;
  sourceId?: string;
  entityId?: string;
  entityType?: KnowledgeEntityType;
  limit?: number;
}

export interface SourceAdapterFetchResult<T> {
  adapterId: string;
  observations: SourceObservation[];
  claims: SourceClaimDraft[];
  records: T[];
}

export interface SourceAdapter {
  id: string;
  name: string;
  searchEntities(context: SourceAdapterFetchContext): Promise<SourceAdapterFetchResult<SourceAdapterEntitySearchResult>>;
  fetchEntityDetail(context: SourceAdapterFetchContext): Promise<SourceAdapterFetchResult<KnowledgeEntity>>;
  fetchRelationships(context: SourceAdapterFetchContext): Promise<SourceAdapterFetchResult<RelationshipEntity>>;
  fetchWorks(context: SourceAdapterFetchContext): Promise<SourceAdapterFetchResult<KnowledgeEntity>>;
  fetchAffiliations(context: SourceAdapterFetchContext): Promise<SourceAdapterFetchResult<RelationshipEntity>>;
  fetchCitationsOrReferences(context: SourceAdapterFetchContext): Promise<SourceAdapterFetchResult<RelationshipEntity>>;
  normalizeSourceClaims(observations: SourceObservation[]): SourceClaimDraft[];
}

export type SourceAdapterRunStatus = "completed" | "running" | "held" | "failed";

export interface SourceAdapterRunRecord {
  id: string;
  adapterId: string;
  adapterName: string;
  runAt: string | null;
  status: SourceAdapterRunStatus;
  queryCount: number;
  observationCount: number;
  claimCount: number;
  errorMessage?: string;
}

export interface SourceAdapterRunSummary {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  heldRuns: number;
  latestRunAt: string | null;
  latestErrors: Array<{
    adapterId: string;
    adapterName: string;
    errorMessage: string;
  }>;
}

export const createEmptyAdapterResult = <T>(adapterId: string): SourceAdapterFetchResult<T> => ({
  adapterId,
  observations: [],
  claims: [],
  records: [],
});

export const summarizeSourceAdapterRuns = (runs: SourceAdapterRunRecord[]): SourceAdapterRunSummary => {
  const completedRuns = runs.filter((run) => run.status === "completed").length;
  const failedRuns = runs.filter((run) => run.status === "failed").length;
  const heldRuns = runs.filter((run) => run.status === "held").length;
  const latestRunAt = runs
    .map((run) => run.runAt)
    .filter((runAt): runAt is string => Boolean(runAt))
    .sort()
    .at(-1) || null;

  return {
    totalRuns: runs.length,
    completedRuns,
    failedRuns,
    heldRuns,
    latestRunAt,
    latestErrors: runs
      .filter((run) => run.status === "failed" && run.errorMessage)
      .map((run) => ({
        adapterId: run.adapterId,
        adapterName: run.adapterName,
        errorMessage: run.errorMessage as string,
      })),
  };
};
