import { createSourceClaimEntity } from "./knowledgeModel";
import { KnowledgeEntity, SourceClaimDraft, SourceObservation } from "./types";
import {
  createEmptyAdapterResult,
  SourceAdapter,
  SourceAdapterEntitySearchResult,
  SourceAdapterFetchResult,
} from "./sourceAdapters";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface WikipediaDbpediaAdapterOptions {
  wikipediaBaseUrl?: string;
  dbpediaLookupUrl?: string;
  fetchImpl?: FetchLike;
}

const fetchJson = async (fetchImpl: FetchLike, url: URL) => {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Fallback source request failed with ${response.status}`);
  return response.json();
};

const slug = (value: string) =>
  value.trim().replace(/\s+/g, "_");

const personIdFromTitle = (title: string) =>
  `person:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

const makeSummaryClaim = (entityId: string, entityType: SourceClaimDraft["subjectEntityType"], summary: any): SourceClaimDraft => ({
  sourceName: "Wikipedia",
  sourceUrl: summary.content_urls?.desktop?.page || summary.content_urls?.mobile?.page,
  sourceType: "encyclopedia",
  sourceReliability: 0.45,
  extractionMethod: "text_extraction",
  subjectEntityId: entityId,
  subjectEntityType: entityType,
  field: "summary",
  value: summary.extract || "",
  confidence: 0.45,
  status: "candidate",
});

const makeObservation = (sourceName: string, sourceUrl: string | undefined, raw: unknown, claims: SourceClaimDraft[]): SourceObservation => ({
  id: `observation:${sourceName.toLowerCase()}:${sourceUrl || Date.now()}`,
  sourceName,
  sourceUrl,
  sourceType: sourceName === "DBpedia" ? "curated_dataset" : "encyclopedia",
  observedAt: new Date().toISOString(),
  raw,
  normalizedClaims: claims,
});

export const createWikipediaDbpediaAdapter = (options: WikipediaDbpediaAdapterOptions = {}): SourceAdapter => {
  const wikipediaBaseUrl = options.wikipediaBaseUrl || "https://en.wikipedia.org/api/rest_v1";
  const dbpediaLookupUrl = options.dbpediaLookupUrl || "https://lookup.dbpedia.org/api/search";
  const fetchImpl = options.fetchImpl || fetch;

  return {
    id: "wikipedia-dbpedia",
    name: "Wikipedia/DBpedia fallback",
    async searchEntities(context) {
      if (!context.query) return createEmptyAdapterResult("wikipedia-dbpedia");
      const url = new URL(dbpediaLookupUrl);
      url.searchParams.set("query", context.query);
      url.searchParams.set("format", "JSON");
      if (context.limit) url.searchParams.set("maxResults", String(context.limit));
      const json = await fetchJson(fetchImpl, url);
      const docs = json.docs || json.results || [];
      const records: SourceAdapterEntitySearchResult[] = docs.map((doc: any) => ({
        sourceId: doc.resource?.[0] || doc.uri?.[0] || doc.uri || doc.id,
        label: doc.label?.[0] || doc.label || context.query,
        entityType: context.entityType === "Work" || context.entityType === "Institution" || context.entityType === "Movement" || context.entityType === "Concept"
          ? context.entityType
          : "Person",
        description: doc.comment?.[0] || doc.description?.[0] || undefined,
        sourceUrl: doc.resource?.[0] || doc.uri?.[0] || doc.uri,
        confidence: 0.4,
      }));
      return {
        adapterId: "wikipedia-dbpedia",
        records,
        claims: [],
        observations: [makeObservation("DBpedia", String(url), json, [])],
      };
    },
    async fetchEntityDetail(context) {
      const title = context.query || context.sourceId;
      if (!title) return createEmptyAdapterResult("wikipedia-dbpedia");
      const url = new URL(`${wikipediaBaseUrl.replace(/\/$/, "")}/page/summary/${encodeURIComponent(slug(title))}`);
      const summary = await fetchJson(fetchImpl, url);
      const entityType = context.entityType === "Work" || context.entityType === "Institution" || context.entityType === "Movement" || context.entityType === "Concept"
        ? context.entityType
        : "Person";
      const entity: KnowledgeEntity = {
        id: entityType === "Person" ? personIdFromTitle(summary.title || title) : `${entityType.toLowerCase()}:${personIdFromTitle(summary.title || title).replace(/^person:/, "")}`,
        type: entityType,
        label: summary.title || title,
        ...(entityType === "Person" ? { thinkerId: personIdFromTitle(summary.title || title), birth: 0, death: null, fields: ["Unclassified"] } : {}),
      } as KnowledgeEntity;
      const claims = [makeSummaryClaim(entity.id, entityType, summary)];
      return {
        adapterId: "wikipedia-dbpedia",
        records: [entity],
        claims,
        observations: [makeObservation("Wikipedia", claims[0].sourceUrl, summary, claims)],
      };
    },
    async fetchRelationships() {
      return createEmptyAdapterResult("wikipedia-dbpedia");
    },
    async fetchWorks() {
      return createEmptyAdapterResult("wikipedia-dbpedia");
    },
    async fetchAffiliations() {
      return createEmptyAdapterResult("wikipedia-dbpedia");
    },
    async fetchCitationsOrReferences() {
      return createEmptyAdapterResult("wikipedia-dbpedia");
    },
    normalizeSourceClaims(observations) {
      return observations.flatMap((observation) => observation.normalizedClaims);
    },
  };
};

export const materializeWikipediaSummaryClaims = (claims: SourceClaimDraft[]) =>
  claims.map(createSourceClaimEntity);
