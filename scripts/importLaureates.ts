import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { INITIAL_PEOPLE_DATA } from "../src/data";
import { InfluenceEdge, Thinker } from "../src/types";

export const NOBEL_API_URL = "https://api.nobelprize.org/2.1/laureates?limit=2000";
export const IMU_FIELDS_URL = "https://www.mathunion.org/imu-awards/fields-medal";
export const INCLUDED_NOBEL_CATEGORIES = new Set(["Physics", "Chemistry", "Physiology or Medicine"]);
export const EXCLUDED_NOBEL_CATEGORIES = new Set(["Peace", "Literature", "Economic Sciences"]);
const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const USER_AGENT = "IntellectualHistoryAtlas/1.0 (source-backed laureate import; https://github.com/dnrohr/intellectual-history-knowledge-atlas)";

export type AwardCategory = "Physics" | "Chemistry" | "Physiology or Medicine" | "Fields Medal";

export interface LaureateAward {
  award: "Nobel Prize" | "Fields Medal";
  category: AwardCategory;
  year: number;
  officialSourceUrl: string;
  status: "received" | "declined";
  motivation?: string;
}

export interface LaureateRecord {
  atlasId: string;
  wikidataId: string;
  name: string;
  birthYear: number;
  deathYear: number | null;
  birthPlace: string | null;
  nationality: string[];
  gender: string | null;
  description: string | null;
  fieldsOfWork: string[];
  wikidataUrl: string;
  awards: LaureateAward[];
  match: { resolution: "existing-person" | "new-person"; existingAtlasId?: string; method: "normalized-name" | "birth-surname-shared-token" | "stable-wikidata-id" };
  provenance: Array<{ sourceName: string; sourceUrl: string; fields: string[] }>;
}

export interface LaureateRelationshipCandidate extends InfluenceEdge {
  id: string;
  evidenceProperty: "P184" | "P185" | "P737" | "P802";
  evidenceSourceUrl: string;
  evidenceClaim: string;
  status: "suggested";
}

export const isSupportedLaureateRelationship = (candidate: Partial<LaureateRelationshipCandidate>) =>
  ["P184", "P185", "P737", "P802"].includes(candidate.evidenceProperty || "")
  && typeof candidate.evidenceSourceUrl === "string"
  && /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/.test(candidate.evidenceSourceUrl)
  && typeof candidate.evidenceClaim === "string"
  && /Q\d+ P(?:184|185|737|802) Q\d+/.test(candidate.evidenceClaim);

type ExistingPerson = Pick<Thinker, "id" | "name" | "birth" | "death">;
type WikidataEntity = {
  id: string;
  labels?: { en?: { value?: string } };
  descriptions?: { en?: { value?: string } };
  claims?: Record<string, any[]>;
};

export const normalizePersonName = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[łŁ]/g, "l")
  .replace(/[øØ]/g, "o")
  .replace(/[đĐðÐ]/g, "d")
  .replace(/[þÞ]/g, "th")
  .replace(/æ/gi, "ae")
  .replace(/œ/gi, "oe")
  .toLowerCase()
  .replace(/\b(jr|sr)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const stableLaureateId = (wikidataId: string) => `laureate_${wikidataId.toLowerCase()}`;

const decodeHtml = (value: string) => value
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#039;|&apos;/g, "'")
  .replace(/&quot;/g, "\"")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">");

const stripHtml = (value: string) => decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const fetchText = async (url: string, attempts = 5) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json,text/html" } });
    if (response.ok) return response.text();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) {
      throw new Error(`Request failed (${response.status}): ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (2 ** attempt)));
  }
  throw new Error(`Request retry limit reached: ${url}`);
};

const fetchJson = async <T>(url: string) => JSON.parse(await fetchText(url)) as T;

const claimValue = (claim: any) => claim?.mainsnak?.datavalue?.value;
const entityIds = (entity: WikidataEntity | undefined, property: string) => (entity?.claims?.[property] || [])
  .filter((claim) => claim.rank !== "deprecated")
  .map((claim) => claimValue(claim)?.id)
  .filter((id): id is string => /^Q\d+$/.test(id || ""));

const parseWikidataYear = (entity: WikidataEntity | undefined, property: string) => {
  const time = claimValue(entity?.claims?.[property]?.find((claim) => claim.rank !== "deprecated"))?.time;
  const match = typeof time === "string" ? time.match(/^([+-])(\d{4,})/) : null;
  return match ? Number(match[2]) * (match[1] === "-" ? -1 : 1) : null;
};

const fetchWikidataEntities = async (ids: string[]) => {
  const entities: Record<string, WikidataEntity> = {};
  const unique = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id));
  for (let index = 0; index < unique.length; index += 50) {
    const url = new URL(WIKIDATA_API_URL);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", unique.slice(index, index + 50).join("|"));
    url.searchParams.set("languages", "en");
    url.searchParams.set("props", "labels|descriptions|claims");
    url.searchParams.set("format", "json");
    Object.assign(entities, (await fetchJson<{ entities: Record<string, WikidataEntity> }>(url.toString())).entities);
  }
  return entities;
};

export const parseFieldsMedalists = (html: string) => {
  const section = html.match(/The Fields Medalists, chronologically listed[\s\S]*?<\/section>/i)?.[0];
  if (!section) throw new Error("Could not find the IMU Fields Medalists section.");
  const groups = [...section.matchAll(/<div class="list__group">([\s\S]*?)<\/div>/gi)];
  return groups.flatMap((group) => {
    const year = Number(group[1].match(/<h3>(\d{4})<\/h3>/i)?.[1]);
    if (!year) return [];
    return [...group[1].matchAll(/<li class="blue-link">\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)].map((match) => {
      const rawName = stripHtml(match[1]);
      return { name: rawName.replace(/\*$/, "").trim(), year, status: rawName.endsWith("*") ? "declined" as const : "received" as const };
    });
  });
};

const fieldsMedalistWikidataRows = async () => {
  const query = `SELECT ?person ?personLabel ?dob ?dod WHERE { ?person wdt:P166 wd:Q28835. OPTIONAL { ?person wdt:P569 ?dob. } OPTIONAL { ?person wdt:P570 ?dod. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const url = `${WIKIDATA_SPARQL_URL}?format=json&query=${encodeURIComponent(query)}`;
  const result = await fetchJson<any>(url);
  return result.results.bindings.map((row: any) => ({
    wikidataId: row.person.value.match(/Q\d+$/)?.[0] as string,
    name: row.personLabel.value as string,
    birthYear: row.dob?.value ? Number(row.dob.value.slice(0, 4)) : null,
    deathYear: row.dod?.value ? Number(row.dod.value.slice(0, 4)) : null,
  }));
};

export const resolveExistingPersonMatch = (name: string, birthYear: number, people: ExistingPerson[]) => {
  const normalized = normalizePersonName(name);
  const candidates = people.filter((person) => normalizePersonName(person.name) === normalized);
  const exact = candidates.find((person) => person.birth === birthYear) || (candidates.length === 1 ? candidates[0] : undefined);
  if (exact) return { person: exact, method: "normalized-name" as const };

  const meaningfulTokens = (value: string) => normalizePersonName(value)
    .split(" ")
    .filter((token) => token.length > 1 && !["sir", "jr", "sr"].includes(token));
  const tokens = meaningfulTokens(name);
  const surname = tokens.at(-1);
  const givenTokens = new Set(tokens.slice(0, -1));
  const conservativeMatches = people.filter((person) => {
    if (person.birth !== birthYear) return false;
    const personTokens = meaningfulTokens(person.name);
    if (!surname || personTokens.at(-1) !== surname) return false;
    return personTokens.slice(0, -1).some((token) => givenTokens.has(token));
  });
  return conservativeMatches.length === 1
    ? { person: conservativeMatches[0], method: "birth-surname-shared-token" as const }
    : undefined;
};

export const resolveExistingPerson = (name: string, birthYear: number, people: ExistingPerson[]) =>
  resolveExistingPersonMatch(name, birthYear, people)?.person;

const inferEra = (birthYear: number) => birthYear < 1900 ? "19th Century" : birthYear < 1945 ? "Modernism" : birthYear < 1980 ? "Postwar" : "Contemporary";
const categoryField = (category: AwardCategory) => category === "Physiology or Medicine" ? "Biology" : category === "Fields Medal" ? "Mathematics" : category;

const officialNobelUrl = (prize: any, laureate: any) => prize.links?.find((link: any) => link.rel === "external" && link.class?.includes("laureate facts"))?.href
  || laureate.links?.find((link: any) => link.rel === "external")?.href
  || `https://www.nobelprize.org/laureate/${laureate.id}`;

export const nobelAwardsForLaureate = (laureate: any): LaureateAward[] => (laureate.nobelPrizes || [])
  .filter((prize: any) => INCLUDED_NOBEL_CATEGORIES.has(prize.category?.en))
  .map((prize: any) => ({
    award: "Nobel Prize",
    category: prize.category.en,
    year: Number(prize.awardYear),
    officialSourceUrl: officialNobelUrl(prize, laureate),
    status: "received",
    motivation: prize.motivation?.en,
  }));

const findFieldsWikidataRow = (name: string, rows: Awaited<ReturnType<typeof fieldsMedalistWikidataRows>>) => {
  const normalized = normalizePersonName(name);
  const aliases: Record<string, string> = {
    "curtis t mcmullen": "curtis mcmullen",
    "gregori alexandrovitch margulis": "grigory margulis",
    "ngo bao chau": "ngo bao chau",
    "pierre rene deligne": "pierre deligne",
    "vaughan f r jones": "vaughan jones",
    "w timothy gowers": "timothy gowers",
  };
  const wanted = aliases[normalized] || normalized;
  const significant = (value: string) => value.split(" ").filter((token) => token.length > 1).join(" ");
  const [first, ...rest] = wanted.split(" ");
  const last = rest.at(-1);
  const surnameMatches = rows.filter((row) => normalizePersonName(row.name).split(" ").at(-1) === last);
  return rows.find((row) => normalizePersonName(row.name) === wanted)
    || rows.find((row) => significant(normalizePersonName(row.name)) === significant(wanted))
    || rows.find((row) => {
      const tokens = normalizePersonName(row.name).split(" ");
      return Boolean(last && tokens[0] === first && tokens.at(-1) === last);
    })
    || (surnameMatches.length === 1 ? surnameMatches[0] : undefined)
    || rows.find((row) => wanted.includes(normalizePersonName(row.name)) || normalizePersonName(row.name).includes(wanted));
};

const mergeRecord = (records: Map<string, LaureateRecord>, incoming: LaureateRecord) => {
  const current = records.get(incoming.wikidataId);
  if (!current) {
    records.set(incoming.wikidataId, incoming);
    return;
  }
  current.awards.push(...incoming.awards);
  current.awards.sort((a, b) => a.year - b.year || a.category.localeCompare(b.category));
  current.provenance.push(...incoming.provenance.filter((source) => !current.provenance.some((item) => item.sourceUrl === source.sourceUrl)));
  current.fieldsOfWork = [...new Set([...current.fieldsOfWork, ...incoming.fieldsOfWork])];
};

const buildRelationshipCandidates = async (
  records: LaureateRecord[],
  legacyPeople: ExistingPerson[],
  entities: Record<string, WikidataEntity>,
) => {
  const relatedIds = [...new Set(records.flatMap((record) => ["P184", "P185", "P737", "P802"].flatMap((property) => entityIds(entities[record.wikidataId], property))))];
  const relatedEntities = await fetchWikidataEntities(relatedIds);
  const atlasIdByQid = new Map(records.map((record) => [record.wikidataId, record.atlasId]));
  const legacyByName = new Map(legacyPeople.map((person) => [normalizePersonName(person.name), person.id]));
  for (const [qid, entity] of Object.entries(relatedEntities)) {
    const label = entity.labels?.en?.value;
    if (label && legacyByName.has(normalizePersonName(label))) atlasIdByQid.set(qid, legacyByName.get(normalizePersonName(label))!);
  }

  const candidates = new Map<string, LaureateRelationshipCandidate>();
  const add = (sourceQid: string, targetQid: string, property: LaureateRelationshipCandidate["evidenceProperty"], evidenceQid: string) => {
    const source = atlasIdByQid.get(sourceQid);
    const target = atlasIdByQid.get(targetQid);
    if (!source || !target || source === target) return;
    const type = property === "P737" ? "Influence" : "Mentorship";
    const key = `${source}->${target}:${type}`;
    if (candidates.has(key)) return;
    const evidenceSourceUrl = `https://www.wikidata.org/wiki/${evidenceQid}`;
    candidates.set(key, {
      id: `candidate:${source}:${target}:${type.toLowerCase()}`,
      source,
      target,
      type,
      strength: type === "Mentorship" ? 5 : 4,
      confidence: type === "Mentorship" ? 0.95 : 0.9,
      note: `Wikidata ${property} explicitly records this ${type === "Mentorship" ? "adviser/student" : "influenced-by"} relationship; requires curator review before canonical promotion.`,
      sourceClaims: [evidenceSourceUrl],
      status: "suggested",
      evidenceProperty: property,
      evidenceSourceUrl,
      evidenceClaim: `${evidenceQid} ${property} ${property === "P737" || property === "P184" ? sourceQid : targetQid}`,
    });
  };

  for (const record of records) {
    const entity = entities[record.wikidataId];
    for (const qid of entityIds(entity, "P184")) add(qid, record.wikidataId, "P184", record.wikidataId);
    for (const qid of entityIds(entity, "P185")) add(record.wikidataId, qid, "P185", record.wikidataId);
    for (const qid of entityIds(entity, "P802")) add(record.wikidataId, qid, "P802", record.wikidataId);
    for (const qid of entityIds(entity, "P737")) add(qid, record.wikidataId, "P737", record.wikidataId);
  }
  return [...candidates.values()].sort((a, b) => a.id.localeCompare(b.id));
};

const writeGeneratedModule = async (records: LaureateRecord[], people: Thinker[]) => {
  const output = [
    'import { Thinker } from "./types";',
    'import type { LaureateRecord } from "../scripts/importLaureates";',
    "",
    "// Generated by scripts/importLaureates.ts. Do not edit by hand.",
    `export const LAUREATE_ROSTER: LaureateRecord[] = ${JSON.stringify(records, null, 2)};`,
    "",
    `export const LAUREATE_IMPORTED_PEOPLE: Thinker[] = ${JSON.stringify(people, null, 2)};`,
    "",
  ].join("\n");
  await writeFile(path.join("src", "generatedLaureates.ts"), output, "utf8");
};

export const generateLaureateImport = async (existingPeople: ExistingPerson[] = INITIAL_PEOPLE_DATA.filter((person) => !person.id.startsWith("laureate_"))) => {
  const [nobelResponse, fieldsHtml, fieldsRows] = await Promise.all([
    fetchJson<any>(NOBEL_API_URL),
    fetchText(IMU_FIELDS_URL),
    fieldsMedalistWikidataRows(),
  ]);
  const records = new Map<string, LaureateRecord>();

  for (const laureate of nobelResponse.laureates || []) {
    const awards = nobelAwardsForLaureate(laureate);
    if (awards.length === 0) continue;
    const wikidataId = laureate.wikidata?.id;
    const name = laureate.knownName?.en || laureate.fullName?.en;
    const birthYear = Number(laureate.birth?.year || laureate.birth?.date?.slice(0, 4));
    if (!wikidataId || !name || !Number.isInteger(birthYear)) throw new Error(`Nobel laureate ${laureate.id} lacks required identity metadata.`);
    const existingMatch = resolveExistingPersonMatch(name, birthYear, existingPeople);
    const existing = existingMatch?.person;
    const officialUrls = [...new Set(awards.map((award) => award.officialSourceUrl))];
    mergeRecord(records, {
      atlasId: existing?.id || stableLaureateId(wikidataId), wikidataId, name, birthYear,
      deathYear: laureate.death?.year ? Number(laureate.death.year) : null,
      birthPlace: laureate.birth?.place?.locationString?.en || null,
      nationality: [], gender: laureate.gender || null,
      description: awards.map((award) => award.motivation).filter(Boolean).join("; ") || null,
      fieldsOfWork: [...new Set(awards.map((award) => categoryField(award.category)))],
      wikidataUrl: laureate.wikidata.url,
      awards,
      match: existing ? { resolution: "existing-person", existingAtlasId: existing.id, method: existingMatch!.method } : { resolution: "new-person", method: "stable-wikidata-id" },
      provenance: [
        { sourceName: "Nobel Prize API", sourceUrl: NOBEL_API_URL, fields: ["name", "birth", "death", "gender", "awards", "wikidataId"] },
        ...officialUrls.map((sourceUrl) => ({ sourceName: "Nobel Prize", sourceUrl, fields: ["award", "category", "year", "motivation"] })),
        { sourceName: "Wikidata", sourceUrl: laureate.wikidata.url, fields: ["identity"] },
      ],
    });
  }

  const fieldsMedalists = parseFieldsMedalists(fieldsHtml);
  for (const medalist of fieldsMedalists) {
    const row = findFieldsWikidataRow(medalist.name, fieldsRows);
    if (!row) throw new Error(`Could not resolve Fields medalist to Wikidata: ${medalist.name}`);
    const birthYear = row.birthYear;
    if (!Number.isInteger(birthYear)) throw new Error(`Fields medalist lacks birth year: ${medalist.name}`);
    const existingMatch = resolveExistingPersonMatch(medalist.name, birthYear, existingPeople);
    const existing = existingMatch?.person;
    const yearUrl = medalist.year >= 1990 && medalist.year !== 2010
      ? `${IMU_FIELDS_URL}/fields-medals-${medalist.year}`
      : IMU_FIELDS_URL;
    mergeRecord(records, {
      atlasId: existing?.id || stableLaureateId(row.wikidataId), wikidataId: row.wikidataId,
      name: medalist.name, birthYear, deathYear: row.deathYear, birthPlace: null,
      nationality: [], gender: null, description: null, fieldsOfWork: ["Mathematics"],
      wikidataUrl: `https://www.wikidata.org/wiki/${row.wikidataId}`,
      awards: [{ award: "Fields Medal", category: "Fields Medal", year: medalist.year, officialSourceUrl: yearUrl, status: medalist.status }],
      match: existing ? { resolution: "existing-person", existingAtlasId: existing.id, method: existingMatch!.method } : { resolution: "new-person", method: "stable-wikidata-id" },
      provenance: [
        { sourceName: "International Mathematical Union", sourceUrl: IMU_FIELDS_URL, fields: ["name", "award", "year", "status"] },
        { sourceName: "Wikidata", sourceUrl: `https://www.wikidata.org/wiki/${row.wikidataId}`, fields: ["identity", "birth", "death"] },
      ],
    });
  }

  const sortedRecords = [...records.values()].sort((a, b) => a.atlasId.localeCompare(b.atlasId));
  const entities = await fetchWikidataEntities(sortedRecords.map((record) => record.wikidataId));
  const enrichmentIds = [...new Set(Object.values(entities).flatMap((entity) => ["P27", "P101", "P106"].flatMap((property) => entityIds(entity, property))))];
  const enrichmentEntities = await fetchWikidataEntities(enrichmentIds);
  const labelFor = (qid: string) => enrichmentEntities[qid]?.labels?.en?.value || qid;
  for (const record of sortedRecords) {
    const entity = entities[record.wikidataId];
    record.deathYear ??= parseWikidataYear(entity, "P570");
    record.description ??= entity?.descriptions?.en?.value || null;
    record.nationality = [...new Set(entityIds(entity, "P27").map(labelFor).filter((label) => !/^Q\d+$/.test(label)))];
    const fields = entityIds(entity, "P101").map(labelFor).filter((label) => !/^Q\d+$/.test(label));
    if (fields.length) record.fieldsOfWork = [...new Set([...record.fieldsOfWork, ...fields])];
  }

  const importedPeople: Thinker[] = sortedRecords.filter((record) => record.match.resolution === "new-person").map((record) => ({
    id: record.atlasId,
    name: record.name,
    birth: record.birthYear,
    death: record.deathYear,
    fields: [...new Set(record.awards.map((award) => categoryField(award.category)))],
    subfields: record.fieldsOfWork.slice(0, 4),
    region: record.nationality.join("/") || record.birthPlace,
    era: inferEra(record.birthYear),
    movement: null,
    bridge_score: 2,
    works: [], influenced: [],
    notes: `${record.description || "Award recipient"} Awards: ${record.awards.map((award) => `${award.category} (${award.year})`).join(", ")}. Sources: ${record.provenance.map((source) => source.sourceUrl).join("; ")}`,
  }));
  const candidates = await buildRelationshipCandidates(sortedRecords, existingPeople, entities);
  const duplicateReport = {
    inputAwardOccurrences: sortedRecords.reduce((sum, record) => sum + record.awards.length, 0),
    uniquePeople: sortedRecords.length,
    existingMatches: sortedRecords.filter((record) => record.match.resolution === "existing-person").map((record) => ({ name: record.name, wikidataId: record.wikidataId, atlasId: record.atlasId })),
    newPeople: importedPeople.length,
    repeatLaureates: sortedRecords.filter((record) => record.awards.length > 1).map((record) => ({ name: record.name, wikidataId: record.wikidataId, atlasId: record.atlasId, awards: record.awards })),
    nearMatchRejections: sortedRecords.filter((record) => record.match.resolution === "new-person").flatMap((record) => {
      const surname = normalizePersonName(record.name).split(" ").at(-1);
      return existingPeople
        .filter((person) => person.birth === record.birthYear && normalizePersonName(person.name).split(" ").at(-1) === surname)
        .map((person) => ({
          laureateName: record.name,
          wikidataId: record.wikidataId,
          existingAtlasId: person.id,
          existingName: person.name,
          reason: "Rejected: birth year and surname match, but no additional given-name token matches.",
        }));
    }),
    identifierCollisions: [] as string[],
  };

  await mkdir(path.join("data", "laureates"), { recursive: true });
  await Promise.all([
    writeGeneratedModule(sortedRecords, importedPeople),
    writeFile(path.join("data", "laureates", "roster.json"), `${JSON.stringify({ sources: { nobel: NOBEL_API_URL, fields: IMU_FIELDS_URL }, laureates: sortedRecords }, null, 2)}\n`, "utf8"),
    writeFile(path.join("data", "laureates", "duplicate-resolution.json"), `${JSON.stringify(duplicateReport, null, 2)}\n`, "utf8"),
    writeFile(path.join("data", "laureates", "relationship-candidates.json"), `${JSON.stringify({ policy: "Only explicit Wikidata P184/P185/P737/P802 claims; shared-award and co-laureate links are prohibited.", candidates }, null, 2)}\n`, "utf8"),
  ]);
  return { records: sortedRecords, importedPeople, candidates, duplicateReport, fieldsMedalists };
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await generateLaureateImport();
  console.log(`Generated ${result.records.length} unique laureates, ${result.importedPeople.length} new canonical people, ${result.candidates.length} relationship candidates.`);
  console.log(`Matched ${result.duplicateReport.existingMatches.length} existing atlas people; consolidated ${result.duplicateReport.repeatLaureates.length} repeat laureates.`);
}
