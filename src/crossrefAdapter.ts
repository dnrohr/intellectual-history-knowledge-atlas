import { createSourceClaimEntity, getWorkEntityId } from "./knowledgeModel";
import { RelationshipEntity, SourceClaimDraft, SourceObservation, WorkEntity } from "./types";
import {
  createEmptyAdapterResult,
  SourceAdapter,
  SourceAdapterEntitySearchResult,
  SourceAdapterFetchResult,
} from "./sourceAdapters";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface CrossrefAdapterOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

const doiPart = (doiOrUrl: string) => doiOrUrl.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

const crossrefWorkUrl = (baseUrl: string, doi: string) =>
  new URL(`${baseUrl.replace(/\/$/, "")}/works/${encodeURIComponent(doiPart(doi))}`);

const fetchCrossrefJson = async (fetchImpl: FetchLike, url: URL) => {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": "IntellectualHistoryAtlas/0.1 (mailto:example@example.com)" },
  });
  if (!response.ok) throw new Error(`Crossref request failed with ${response.status}`);
  return response.json();
};

const getIssuedYear = (record: any) =>
  record?.issued?.["date-parts"]?.[0]?.[0] || record?.published?.["date-parts"]?.[0]?.[0] || null;

const getTitle = (record: any) => record?.title?.[0] || record?.DOI || "Untitled Crossref work";

const getSourceUrl = (record: any) =>
  record?.URL || (record?.DOI ? `https://doi.org/${record.DOI}` : "");

const makeWork = (record: any): WorkEntity => {
  const title = getTitle(record);
  return {
    id: getWorkEntityId("crossref", title),
    type: "Work",
    label: title,
    title,
    date: getIssuedYear(record),
    identifiers: {
      ...(record?.DOI ? { doi: record.DOI } : {}),
      ...(record?.URL ? { crossref: record.URL } : {}),
    },
  };
};

const makeClaim = (
  subjectEntityId: string,
  field: string,
  value: string,
  sourceUrl: string,
  confidence = 0.85
): SourceClaimDraft => ({
  sourceName: "Crossref",
  sourceUrl,
  sourceType: "bibliographic",
  sourceReliability: 0.85,
  extractionMethod: "api_field",
  subjectEntityId,
  subjectEntityType: "Work",
  field,
  value,
  confidence,
  status: "observed",
});

const makeObservation = (record: any, claims: SourceClaimDraft[] = []): SourceObservation => ({
  id: `observation:crossref:${record?.DOI || record?.URL || getTitle(record)}`,
  sourceName: "Crossref",
  sourceUrl: getSourceUrl(record),
  sourceType: "bibliographic",
  observedAt: new Date().toISOString(),
  raw: record,
  normalizedClaims: claims,
});

const resultFromWorks = (
  records: any[]
): SourceAdapterFetchResult<WorkEntity> => {
  const works = records.map(makeWork);
  const claims = works.flatMap((work, index) => [
    makeClaim(work.id, "title", work.title, getSourceUrl(records[index])),
    ...(work.date ? [makeClaim(work.id, "date", String(work.date), getSourceUrl(records[index]))] : []),
  ]);
  return {
    adapterId: "crossref",
    records: works,
    claims,
    observations: records.map((record) => makeObservation(record, claims)),
  };
};

export const createCrossrefAdapter = (options: CrossrefAdapterOptions = {}): SourceAdapter => {
  const baseUrl = options.baseUrl || "https://api.crossref.org/v1";
  const fetchImpl = options.fetchImpl || fetch;

  return {
    id: "crossref",
    name: "Crossref",
    async searchEntities(context) {
      const url = new URL(`${baseUrl.replace(/\/$/, "")}/works`);
      if (context.query) url.searchParams.set("query.bibliographic", context.query);
      if (context.limit) url.searchParams.set("rows", String(context.limit));
      const json = await fetchCrossrefJson(fetchImpl, url);
      const records = json.message?.items || [];
      return {
        adapterId: "crossref",
        records: records.map((record: any): SourceAdapterEntitySearchResult => ({
          sourceId: record.DOI,
          label: getTitle(record),
          entityType: "Work",
          description: record.type,
          sourceUrl: getSourceUrl(record),
          confidence: 0.75,
        })),
        claims: [],
        observations: records.map((record: any) => makeObservation(record)),
      };
    },
    async fetchEntityDetail(context) {
      if (!context.sourceId) return createEmptyAdapterResult("crossref");
      const json = await fetchCrossrefJson(fetchImpl, crossrefWorkUrl(baseUrl, context.sourceId));
      return resultFromWorks([json.message]);
    },
    async fetchRelationships() {
      return createEmptyAdapterResult("crossref");
    },
    async fetchWorks(context) {
      if (context.sourceId) {
        const json = await fetchCrossrefJson(fetchImpl, crossrefWorkUrl(baseUrl, context.sourceId));
        return resultFromWorks([json.message]);
      }
      const search = await this.searchEntities(context);
      return resultFromWorks(search.observations.map((observation) => observation.raw));
    },
    async fetchAffiliations() {
      return createEmptyAdapterResult("crossref");
    },
    async fetchCitationsOrReferences(context) {
      if (!context.sourceId) return createEmptyAdapterResult("crossref");
      const json = await fetchCrossrefJson(fetchImpl, crossrefWorkUrl(baseUrl, context.sourceId));
      const target = makeWork(json.message);
      const relationships: RelationshipEntity[] = (json.message?.reference || [])
        .filter((reference: any) => reference.DOI)
        .slice(0, context.limit || 20)
        .map((reference: any) => {
          const sourceWorkId = getWorkEntityId("crossref", reference["article-title"] || reference.DOI);
          const id = `relationship:${sourceWorkId}:work influenced work:${target.id}`;
          return {
            id,
            type: "Relationship",
            label: `${sourceWorkId} influenced ${target.label}`,
            source: { entityId: sourceWorkId, entityType: "Work" },
            target: { entityId: target.id, entityType: "Work" },
            relationshipType: "work influenced work",
            status: "suggested",
            claimIds: [createSourceClaimEntity({
              ...makeClaim(id, "reference.DOI", reference.DOI, getSourceUrl(json.message), 0.75),
              subjectEntityType: "Relationship",
            }).id],
          };
        });
      return {
        adapterId: "crossref",
        records: relationships,
        claims: [],
        observations: [makeObservation(json.message)],
      };
    },
    normalizeSourceClaims(observations) {
      return observations.flatMap((observation) => observation.normalizedClaims);
    },
  };
};
