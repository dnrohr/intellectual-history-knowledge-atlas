import { INITIAL_EDGES_DATA, INITIAL_PEOPLE_DATA } from "../src/data";
import { CANONICAL_THREADS } from "../src/threads";
import { InfluenceEdge, Thinker } from "../src/types";

const EXPLICIT_EDGE_THRESHOLD = 2;
const HIGH_BRIDGE_SCORE = 4;

const explicitEdges = INITIAL_EDGES_DATA.filter((edge) => edge.source !== "metadata");
const explicitEdgeKeys = new Set(explicitEdges.map((edge) => `${edge.source}->${edge.target}`));
const peopleById = new Map(INITIAL_PEOPLE_DATA.map((person) => [person.id, person]));

const hasExplicitEdge = (personId: string) =>
  explicitEdges.some((edge) => edge.source === personId || edge.target === personId);

const explicitDegree = (personId: string) =>
  explicitEdges.filter((edge) => edge.source === personId || edge.target === personId).length;

const hasMetadataInfluence = (person: Thinker) =>
  (person.influenced || []).some((targetId) => !explicitEdgeKeys.has(`${person.id}->${targetId}`));

const fields = Array.from(new Set(INITIAL_PEOPLE_DATA.flatMap((person) => person.fields))).sort();

const peopleForField = (field: string) =>
  INITIAL_PEOPLE_DATA.filter((person) => person.fields.includes(field));

const formatList = (items: string[], limit = 12) => {
  const visible = items.slice(0, limit);
  const suffix = items.length > limit ? `, +${items.length - limit} more` : "";
  return visible.length ? `${visible.join(", ")}${suffix}` : "none";
};

const edgeConflictKey = (edge: InfluenceEdge) =>
  [edge.source, edge.target].sort().join("<->");

const duplicateConflicts = Array.from(
  explicitEdges.reduce((groups, edge) => {
    const key = edgeConflictKey(edge);
    groups.set(key, [...(groups.get(key) || []), edge]);
    return groups;
  }, new Map<string, InfluenceEdge[]>())
).filter(([, edges]) => {
  const directions = new Set(edges.map((edge) => `${edge.source}->${edge.target}`));
  const types = new Set(edges.map((edge) => edge.type));
  return directions.size > 1 || types.size > 1;
});

const threadPeople = new Set(CANONICAL_THREADS.flatMap((thread) => thread.people));
const threadCoverageByField = fields.map((field) => {
  const fieldPeople = peopleForField(field);
  const covered = fieldPeople.filter((person) => threadPeople.has(person.id));
  return { field, covered: covered.length, total: fieldPeople.length };
});

const eras = Array.from(new Set(INITIAL_PEOPLE_DATA.map((person) => person.era))).sort();
const threadCoverageByEra = eras.map((era) => {
  const eraPeople = INITIAL_PEOPLE_DATA.filter((person) => person.era === era);
  const covered = eraPeople.filter((person) => threadPeople.has(person.id));
  return { era, covered: covered.length, total: eraPeople.length };
});

console.log("# Dataset QA Report");
console.log("");
console.log(`People: ${INITIAL_PEOPLE_DATA.length}`);
console.log(`Explicit edges: ${explicitEdges.length}`);
console.log(`Canonical threads: ${CANONICAL_THREADS.length}`);
console.log("");

console.log("## Edge Expansion Audit By Field");
for (const field of fields) {
  const fieldPeople = peopleForField(field);
  const isolated = fieldPeople.filter((person) => !hasExplicitEdge(person.id));
  const metadataOnly = fieldPeople.filter((person) => !hasExplicitEdge(person.id) && hasMetadataInfluence(person));
  const sparseHighBridge = fieldPeople.filter(
    (person) => (person.bridge_score || 0) >= HIGH_BRIDGE_SCORE && explicitDegree(person.id) < EXPLICIT_EDGE_THRESHOLD
  );

  console.log(`### ${field}`);
  console.log(`- People: ${fieldPeople.length}`);
  console.log(`- Isolated explicit-edge people: ${isolated.length} (${formatList(isolated.map((person) => person.name))})`);
  console.log(`- Metadata-only people: ${metadataOnly.length} (${formatList(metadataOnly.map((person) => person.name))})`);
  console.log(
    `- High bridge-score people with fewer than ${EXPLICIT_EDGE_THRESHOLD} explicit edges: ${sparseHighBridge.length} (${formatList(
      sparseHighBridge.map((person) => `${person.name}=${person.bridge_score || 0}/${explicitDegree(person.id)}`)
    )})`
  );
}

console.log("");
console.log("## Duplicate Or Conflicting Explicit Edges");
if (duplicateConflicts.length === 0) {
  console.log("- none");
} else {
  for (const [key, edges] of duplicateConflicts.slice(0, 50)) {
    console.log(
      `- ${key}: ${edges.map((edge) => `${edge.source}->${edge.target} (${edge.type})`).join("; ")}`
    );
  }
}

console.log("");
console.log("## Thread Coverage By Field");
for (const item of threadCoverageByField) {
  console.log(`- ${item.field}: ${item.covered}/${item.total}`);
}

console.log("");
console.log("## Thread Coverage By Era");
for (const item of threadCoverageByEra) {
  console.log(`- ${item.era}: ${item.covered}/${item.total}`);
}

console.log("");
console.log("## Missing Thread People");
const missingThreadPeople = Array.from(threadPeople).filter((personId) => !peopleById.has(personId));
console.log(`- ${formatList(missingThreadPeople)}`);
