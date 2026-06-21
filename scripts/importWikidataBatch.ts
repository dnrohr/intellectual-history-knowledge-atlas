import { writeFile } from "node:fs/promises";
import { INITIAL_EDGES_DATA, INITIAL_PEOPLE_DATA } from "../src/data";
import { InfluenceEdge, Thinker } from "../src/types";

const API_URL = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "IntellectualHistoryAtlas/0.1 (automated sourced dataset import)";
const DEFAULT_ANCHORS = ["Q302835", "Q9546", "Q282883"];
const MAX_NEW_PEOPLE = 12;
const basePeople = INITIAL_PEOPLE_DATA.filter((person) => !/Imported from Wikidata Q\d+\.$/.test(person.notes || ""));
const baseEdges = INITIAL_EDGES_DATA.filter((edge) => !edge.note?.startsWith("Wikidata P"));

const EXISTING_ID_BY_WIKIDATA_ID: Record<string, string> = {
  Q302835: "tusi",
  Q9546: "al_ghazali",
  Q282883: "suhrawardi",
  Q8011: "avicenna",
  Q333703: "al_razi_theologian",
  Q160460: "al_farabi",
  Q47480: "dirac",
};

type WikidataEntity = {
  id: string;
  labels?: { en?: { value?: string } };
  descriptions?: { en?: { value?: string } };
  claims?: Record<string, any[]>;
};

const entityValue = (claim: any) => claim?.mainsnak?.datavalue?.value;
const entityIds = (entity: WikidataEntity, property: string) =>
  (entity.claims?.[property] || [])
    .filter((claim) => claim.rank !== "deprecated")
    .map((claim) => entityValue(claim)?.id)
    .filter((id): id is string => Boolean(id));

const parseYear = (entity: WikidataEntity, property: string) => {
  const time = entityValue(entity.claims?.[property]?.[0])?.time;
  const match = typeof time === "string" ? time.match(/^([+-])(\d{4,})/) : null;
  if (!match) return null;
  const year = Number(match[2]);
  return match[1] === "-" ? -year : year;
};

const normalizeName = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const slug = (value: string) =>
  normalizeName(value).replace(/\s+/g, "_").replace(/^_+|_+$/g, "");

const fetchJsonWithRetry = async (url: URL, attempts = 6): Promise<any> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response.json();
    if (response.status !== 429 || attempt === attempts - 1) {
      throw new Error(`Wikidata request failed with ${response.status}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30000, 2000 * (2 ** attempt));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error("Wikidata request retry limit reached");
};

const fetchEntities = async (ids: string[]) => {
  const entities: Record<string, WikidataEntity> = {};
  const uniqueIds = Array.from(new Set(ids));
  for (let index = 0; index < uniqueIds.length; index += 50) {
    const url = new URL(API_URL);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", uniqueIds.slice(index, index + 50).join("|"));
    url.searchParams.set("languages", "en");
    url.searchParams.set("props", "labels|descriptions|claims");
    url.searchParams.set("format", "json");
    Object.assign(entities, (await fetchJsonWithRetry(url)).entities || {});
  }
  return entities;
};

const inferField = (text: string) => {
  const value = text.toLowerCase();
  if (/computer|programmer|software|informatics|machine learning/.test(value)) return "Computing";
  if (/engineer|inventor|networking|electrical/.test(value)) return "Engineering";
  if (/chemist|chemistry/.test(value)) return "Chemistry";
  if (/biolog|genetic|biochem/.test(value)) return "Biology";
  if (/mathematic|geometry|algebra/.test(value)) return "Mathematics";
  if (/astronom/.test(value)) return "Astronomy";
  if (/physic/.test(value)) return "Physics";
  if (/histor/.test(value)) return "History";
  if (/logic/.test(value)) return "Logic";
  if (/theolog|philosoph|jurist|scholar|faqih/.test(value)) return "Philosophy";
  return "Philosophy";
};

const inferEra = (birth: number, description: string) => {
  if (birth < 500) return "Ancient";
  if (birth < 1400 && /(persian|arab|iraqi|andalus|islam|muslim|bahrain|iranian)/i.test(description)) {
    return "Islamic Golden Age";
  }
  if (birth < 1400) return "Medieval";
  if (birth < 1600) return "Renaissance";
  if (birth < 1800) return "Enlightenment";
  if (birth < 1900) return "19th Century";
  if (birth < 1945) return "Modernism";
  if (birth < 1980) return "Postwar";
  return "Contemporary";
};

const serializePerson = (person: Thinker) => `  ${JSON.stringify(person)},`;
const serializeEdge = (edge: InfluenceEdge) => `  ${JSON.stringify(edge)},`;

const anchors = process.argv.filter((arg) => /^Q\d+$/.test(arg));
const anchorIds = anchors.length > 0 ? anchors : DEFAULT_ANCHORS;
const apply = process.argv.includes("--apply");
const twentiethCenturyStem = process.argv.includes("--twentieth-century-stem");
const maxNewPeople = twentiethCenturyStem ? 30 : MAX_NEW_PEOPLE;
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const outputPath = outputArg?.slice("--output=".length) || "src/generatedWikidataBatch.ts";

const anchorEntities = await fetchEntities(anchorIds);
const relationProperties = ["P737", "P184", "P185", "P802"];
const relatedIds = Object.values(anchorEntities).flatMap((entity) =>
  relationProperties.flatMap((property) => entityIds(entity, property))
);
const entities = { ...anchorEntities, ...await fetchEntities(relatedIds) };

const labelIds = Object.values(entities).flatMap((entity) =>
  ["P31", "P106", "P101", "P27", "P135", "P800"].flatMap((property) => entityIds(entity, property))
);
const labels = await fetchEntities(labelIds);
const labelFor = (id: string) => labels[id]?.labels?.en?.value || entities[id]?.labels?.en?.value || id;

const existingByName = new Map(basePeople.map((person) => [normalizeName(person.name), person.id]));
const importedIdByQid = new Map<string, string>(Object.entries(EXISTING_ID_BY_WIKIDATA_ID));
const newPeople: Thinker[] = [];
const provenance: Array<{ atlasId: string; wikidataId: string; sourceUrl: string }> = [];

for (const wikidataId of Array.from(new Set([...anchorIds, ...relatedIds]))) {
  if (importedIdByQid.has(wikidataId) || newPeople.length >= maxNewPeople) continue;
  const entity = entities[wikidataId];
  const name = entity?.labels?.en?.value?.trim();
  const birth = entity ? parseYear(entity, "P569") : null;
  if (!entity || !name || birth === null || !entityIds(entity, "P31").includes("Q5")) continue;

  const existingId = existingByName.get(normalizeName(name));
  if (existingId) {
    importedIdByQid.set(wikidataId, existingId);
    continue;
  }

  const description = entity.descriptions?.en?.value || "Person represented in Wikidata";
  if (description.replace(/\([^)]*\)/g, "").trim().split(/\s+/).length < 5) continue;
  const occupations = entityIds(entity, "P106").map(labelFor);
  const fieldsOfWork = entityIds(entity, "P101").map(labelFor);
  const classificationText = [description, ...occupations, ...fieldsOfWork].join(" ");
  if (twentiethCenturyStem && (
    birth < 1870 || birth > 1980 ||
    !/(scientist|engineer|computer|physic|chemist|mathematic|inventor|programmer|cybernetic|astronom)/i.test(classificationText)
  )) continue;
  const works = entityIds(entity, "P800").map(labelFor).filter((label) => !/^Q\d+$/.test(label));
  if (works.length === 0) continue;
  const countries = entityIds(entity, "P27").map(labelFor).filter((label) => !/^Q\d+$/.test(label));
  const movements = entityIds(entity, "P135").map(labelFor).filter((label) => !/^Q\d+$/.test(label));
  const id = slug(name);
  const era = inferEra(birth, description);
  const person: Thinker = {
    id,
    name,
    birth,
    death: parseYear(entity, "P570"),
    fields: [inferField(classificationText)],
    subfields: (fieldsOfWork.length > 0 ? fieldsOfWork : occupations).slice(0, 3),
    region: countries.join("/") || null,
    era,
    movement: movements[0] || (era === "Islamic Golden Age" ? "Islamic Golden Age" : null),
    bridge_score: 3,
    works,
    influenced: [],
    notes: description.replace(/[.\s]+$/, "") + ".",
  };
  newPeople.push(person);
  existingByName.set(normalizeName(name), id);
  importedIdByQid.set(wikidataId, id);
  provenance.push({ atlasId: id, wikidataId, sourceUrl: `https://www.wikidata.org/wiki/${wikidataId}` });
}

const knownIds = new Set([...basePeople.map((person) => person.id), ...newPeople.map((person) => person.id)]);
const birthById = new Map([...basePeople, ...newPeople].map((person) => [person.id, person.birth]));
const existingEdgeKeys = new Set(baseEdges.map((edge) => `${edge.source}->${edge.target}`));
const newEdges: InfluenceEdge[] = [];
const addEdge = (source: string | undefined, target: string | undefined, property: string, evidenceEntityId: string) => {
  if (!source || !target || !knownIds.has(source) || !knownIds.has(target) || source === target) return;
  if (property !== "P737" && (birthById.get(source) || 0) > (birthById.get(target) || 0)) return;
  const key = `${source}->${target}`;
  if (existingEdgeKeys.has(key)) return;
  const mentorship = property !== "P737";
  newEdges.push({
    source,
    target,
    type: mentorship ? "Mentorship" : "Influence",
    strength: mentorship ? 5 : 4,
    note: mentorship
      ? `Wikidata ${property} explicitly records the advisor/student relationship.`
      : "Wikidata P737 explicitly records this influence relationship.",
    confidence: mentorship ? 0.95 : 0.9,
    sourceClaims: [`https://www.wikidata.org/wiki/${evidenceEntityId}`],
    status: "accepted",
  });
  existingEdgeKeys.add(key);
};

for (const entity of Object.values(entities)) {
  const subjectId = importedIdByQid.get(entity.id);
  for (const relatedId of entityIds(entity, "P737")) addEdge(importedIdByQid.get(relatedId), subjectId, "P737", entity.id);
  for (const relatedId of entityIds(entity, "P184")) addEdge(importedIdByQid.get(relatedId), subjectId, "P184", entity.id);
  for (const relatedId of entityIds(entity, "P185")) addEdge(subjectId, importedIdByQid.get(relatedId), "P185", entity.id);
  for (const relatedId of entityIds(entity, "P802")) addEdge(subjectId, importedIdByQid.get(relatedId), "P802", entity.id);
}

const output = [
  'import { InfluenceEdge, Thinker } from "./types";',
  "",
  "// Generated by scripts/importWikidataBatch.ts from explicit Wikidata statements.",
  `export const WIKIDATA_BATCH_PROVENANCE = ${JSON.stringify(provenance, null, 2)} as const;`,
  "",
  "export const WIKIDATA_IMPORTED_PEOPLE: Thinker[] = [",
  ...newPeople.map(serializePerson),
  "];",
  "",
  "export const WIKIDATA_IMPORTED_EDGES: InfluenceEdge[] = [",
  ...newEdges.map(serializeEdge),
  "];",
  "",
].join("\n");

console.log(`# Wikidata batch\nAnchors: ${anchorIds.join(", ")}\nNew people: ${newPeople.length}\nNew relationships: ${newEdges.length}`);
newPeople.forEach((person) => console.log(`- person: ${person.name} (${person.birth})`));
newEdges.forEach((edge) => console.log(`- edge: ${edge.source} -> ${edge.target} (${edge.type})`));

if (apply) {
  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  await writeFile("wikidata-batch-preview.ts", output, "utf8");
  console.log("Dry run wrote wikidata-batch-preview.ts");
}
