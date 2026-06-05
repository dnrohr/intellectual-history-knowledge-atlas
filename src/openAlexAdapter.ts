import { createSourceClaimEntity, getInstitutionEntityId, getWorkEntityId } from "./knowledgeModel";
import {
  ConceptEntity,
  InstitutionEntity,
  KnowledgeEntity,
  RelationshipEntity,
  RelationshipEndpointType,
  SourceClaimDraft,
  SourceObservation,
  WorkEntity,
} from "./types";
import {
  createEmptyAdapterResult,
  SourceAdapter,
  SourceAdapterEntitySearchResult,
  SourceAdapterFetchContext,
  SourceAdapterFetchResult,
} from "./sourceAdapters";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface OpenAlexAdapterOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

const OPENALEX_ENTITY_ENDPOINTS: Record<RelationshipEndpointType, string> = {
  Person: "authors",
  Work: "works",
  Concept: "topics",
  Institution: "institutions",
  Movement: "topics",
};

const openAlexIdPart = (id: string) => id.split("/").pop() || id;

const toOpenAlexUrl = (baseUrl: string, endpoint: string, context: SourceAdapterFetchContext) => {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${endpoint}`);
  if (context.query) url.searchParams.set("search", context.query);
  if (context.limit) url.searchParams.set("per-page", String(context.limit));
  return url;
};

const toOpenAlexWorksByAuthorUrl = (baseUrl: string, authorId: string, limit = 20) => {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/works`);
  url.searchParams.set("filter", `authorships.author.id:${authorId}`);
  url.searchParams.set("per-page", String(limit));
  return url;
};

const fetchOpenAlexJson = async (fetchImpl: FetchLike, url: URL) => {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`OpenAlex request failed with ${response.status}`);
  return response.json();
};

const getSourceUrl = (record: any) => record?.id || record?.ids?.openalex || "";

const makeObservation = (
  sourceId: string,
  raw: unknown,
  normalizedClaims: SourceClaimDraft[] = []
): SourceObservation => ({
  id: `observation:openalex:${openAlexIdPart(sourceId)}`,
  sourceName: "OpenAlex",
  sourceUrl: sourceId,
  sourceType: "bibliographic",
  observedAt: new Date().toISOString(),
  raw,
  normalizedClaims,
});

const makeClaim = (
  subjectEntityId: string,
  subjectEntityType: SourceClaimDraft["subjectEntityType"],
  field: string,
  value: string,
  sourceUrl: string,
  confidence = 0.8
): SourceClaimDraft => ({
  sourceName: "OpenAlex",
  sourceUrl,
  sourceType: "bibliographic",
  sourceReliability: 0.8,
  extractionMethod: "api_field",
  subjectEntityId,
  subjectEntityType,
  field,
  value,
  confidence,
  status: "observed",
});

const mapSearchResult = (
  record: any,
  entityType: RelationshipEndpointType
): SourceAdapterEntitySearchResult => ({
  sourceId: record.id,
  label: record.display_name || record.title || record.id,
  entityType,
  description: record.description || record.primary_topic?.display_name || record.type || undefined,
  sourceUrl: getSourceUrl(record),
  confidence: Number.isFinite(record.relevance_score) ? Math.min(1, record.relevance_score / 1000) : 0.7,
});

const mapWork = (record: any): WorkEntity => {
  const title = record.display_name || record.title || openAlexIdPart(record.id);
  return {
    id: getWorkEntityId("openalex", title),
    type: "Work",
    label: title,
    title,
    date: Number.isFinite(record.publication_year) ? record.publication_year : null,
    identifiers: {
      openalex: record.id,
      ...(record.doi ? { doi: record.doi } : {}),
    },
  };
};

const mapInstitution = (record: any): InstitutionEntity => ({
  id: getInstitutionEntityId(record.display_name || openAlexIdPart(record.id)),
  type: "Institution",
  label: record.display_name || openAlexIdPart(record.id),
  city: record.geo?.city || null,
  claimIds: [],
});

const mapConcept = (record: any): ConceptEntity => ({
  id: `concept:${openAlexIdPart(record.id).toLowerCase()}`,
  type: "Concept",
  label: record.display_name || openAlexIdPart(record.id),
  description: record.description || record.domain?.display_name || null,
  fields: [record.field?.display_name, record.domain?.display_name].filter(Boolean),
});

const mapEntityRecord = (record: any, entityType: RelationshipEndpointType): KnowledgeEntity => {
  if (entityType === "Work") return mapWork(record);
  if (entityType === "Institution") return mapInstitution(record);
  if (entityType === "Concept" || entityType === "Movement") return mapConcept(record);
  return {
    id: `person:${openAlexIdPart(record.id).toLowerCase()}`,
    type: "Person",
    label: record.display_name || openAlexIdPart(record.id),
    thinkerId: `openalex:${openAlexIdPart(record.id)}`,
    birth: 0,
    death: null,
    fields: ["Unclassified"],
  };
};

const getOpenAlexPersonEntityId = (sourceId: string) =>
  `person:openalex-${openAlexIdPart(sourceId).toLowerCase()}`;

const getContextEntityType = (context: SourceAdapterFetchContext): RelationshipEndpointType =>
  context.entityType === "Person" ||
  context.entityType === "Work" ||
  context.entityType === "Concept" ||
  context.entityType === "Movement" ||
  context.entityType === "Institution"
    ? context.entityType
    : "Work";

const resultFromRecords = <T>(
  adapterId: string,
  records: T[],
  rawRecords: any[],
  claims: SourceClaimDraft[] = []
): SourceAdapterFetchResult<T> => ({
  adapterId,
  records,
  claims,
  observations: rawRecords.map((record) => makeObservation(getSourceUrl(record), record, claims)),
});

export const createOpenAlexAdapter = (options: OpenAlexAdapterOptions = {}): SourceAdapter => {
  const baseUrl = options.baseUrl || "https://api.openalex.org";
  const fetchImpl = options.fetchImpl || fetch;

  return {
    id: "openalex",
    name: "OpenAlex",
    async searchEntities(context) {
      const entityType = getContextEntityType(context);
      const endpoint = OPENALEX_ENTITY_ENDPOINTS[entityType];
      const json = await fetchOpenAlexJson(fetchImpl, toOpenAlexUrl(baseUrl, endpoint, context));
      const rawRecords = json.results || [];
      return resultFromRecords(
        "openalex",
        rawRecords.map((record: any) => mapSearchResult(record, entityType)),
        rawRecords
      );
    },
    async fetchEntityDetail(context) {
      if (!context.sourceId) return createEmptyAdapterResult("openalex");
      const entityType = getContextEntityType(context);
      const endpoint = OPENALEX_ENTITY_ENDPOINTS[entityType];
      const url = new URL(`${baseUrl.replace(/\/$/, "")}/${endpoint}/${openAlexIdPart(context.sourceId)}`);
      const record = await fetchOpenAlexJson(fetchImpl, url);
      const entity = mapEntityRecord(record, entityType);
      const claims = [makeClaim(entity.id, entityType, "label", entity.label, getSourceUrl(record))];
      return resultFromRecords("openalex", [entity], [record], claims);
    },
    async fetchRelationships(context) {
      if (!context.sourceId || context.entityType !== "Person") return createEmptyAdapterResult("openalex");
      const json = await fetchOpenAlexJson(fetchImpl, toOpenAlexWorksByAuthorUrl(baseUrl, context.sourceId, context.limit || 20));
      const works = json.results || [];
      const sourcePersonId = getOpenAlexPersonEntityId(context.sourceId);
      const relationships = new Map<string, RelationshipEntity>();

      works.forEach((work: any) => {
        (work.authorships || []).forEach((authorship: any) => {
          const coauthorId = authorship.author?.id;
          if (!coauthorId || coauthorId === context.sourceId) return;
          const targetPersonId = getOpenAlexPersonEntityId(coauthorId);
          relationships.set(targetPersonId, {
            id: `relationship:${sourcePersonId}:person collaborated with person:${targetPersonId}`,
            type: "Relationship",
            label: `${sourcePersonId} collaborated with ${authorship.author?.display_name || targetPersonId}`,
            source: { entityId: sourcePersonId, entityType: "Person" },
            target: { entityId: targetPersonId, entityType: "Person" },
            relationshipType: "person collaborated with person",
            status: "suggested",
            claimIds: [createSourceClaimEntity(makeClaim(
              `relationship:${sourcePersonId}:person collaborated with person:${targetPersonId}`,
              "Relationship",
              "authorships",
              work.id,
              getSourceUrl(work),
              0.7
            )).id],
          });
        });
      });

      return resultFromRecords("openalex", Array.from(relationships.values()), works);
    },
    async fetchWorks(context) {
      const json = await fetchOpenAlexJson(fetchImpl, toOpenAlexUrl(baseUrl, "works", context));
      const rawRecords = json.results || [];
      return resultFromRecords("openalex", rawRecords.map(mapWork), rawRecords);
    },
    async fetchAffiliations(context) {
      const json = await fetchOpenAlexJson(fetchImpl, toOpenAlexUrl(baseUrl, "institutions", context));
      const rawRecords = json.results || [];
      return resultFromRecords("openalex", rawRecords.map(mapInstitution), rawRecords);
    },
    async fetchCitationsOrReferences(context) {
      if (!context.sourceId) return createEmptyAdapterResult("openalex");
      const url = new URL(`${baseUrl.replace(/\/$/, "")}/works/${openAlexIdPart(context.sourceId)}`);
      const work = await fetchOpenAlexJson(fetchImpl, url);
      const target = mapWork(work);
      const relationships: RelationshipEntity[] = (work.referenced_works || []).slice(0, context.limit || 20).map((referencedId: string) => {
        const sourceWorkId = getWorkEntityId("openalex", openAlexIdPart(referencedId));
        return {
          id: `relationship:${sourceWorkId}:work influenced work:${target.id}`,
          type: "Relationship",
          label: `${sourceWorkId} influenced ${target.label}`,
          source: { entityId: sourceWorkId, entityType: "Work" },
          target: { entityId: target.id, entityType: "Work" },
          relationshipType: "work influenced work",
          status: "suggested",
          claimIds: [createSourceClaimEntity(makeClaim(`relationship:${sourceWorkId}:work influenced work:${target.id}`, "Relationship", "referenced_works", referencedId, getSourceUrl(work))).id],
        };
      });
      return resultFromRecords("openalex", relationships, [work]);
    },
    normalizeSourceClaims(observations) {
      return observations.flatMap((observation) => observation.normalizedClaims);
    },
  };
};
