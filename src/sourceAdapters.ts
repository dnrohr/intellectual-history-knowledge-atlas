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

export const createEmptyAdapterResult = <T>(adapterId: string): SourceAdapterFetchResult<T> => ({
  adapterId,
  observations: [],
  claims: [],
  records: [],
});
