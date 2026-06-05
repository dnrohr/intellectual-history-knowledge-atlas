import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { INITIAL_EDGES_DATA, INITIAL_PEOPLE_DATA } from "../src/data";
import { normalizeStoredEdges, normalizeStoredPeople } from "../src/storageSchemas";
import { IMPORT_QUEUE_SCHEMA_VERSION, normalizeStoredImportReviewQueue } from "../src/importQueue";

const DEFAULT_SEED_PATH = path.join("assets", "dev-seed-atlas-state.json");

const buildSeedState = () => {
  const people = normalizeStoredPeople(INITIAL_PEOPLE_DATA);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    importQueueSchemaVersion: IMPORT_QUEUE_SCHEMA_VERSION,
    people,
    edges: normalizeStoredEdges(INITIAL_EDGES_DATA, people),
    importReviewQueue: [],
    importAuditLog: [],
    linkReviewQueue: [],
    importConfidenceThreshold: 80,
    rejectedLinkSuggestionKeys: [],
  };
};

const loadAndValidateState = async (filePath: string) => {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  const people = normalizeStoredPeople(parsed.people);
  const edges = normalizeStoredEdges(parsed.edges, people);
  const importReviewQueue = normalizeStoredImportReviewQueue(parsed.importReviewQueue);

  if (people.length === 0) {
    throw new Error(`No valid people found in ${filePath}`);
  }

  return {
    ...parsed,
    people,
    edges,
    importReviewQueue,
    importAuditLog: Array.isArray(parsed.importAuditLog) ? parsed.importAuditLog.filter(Boolean).slice(0, 100) : [],
    linkReviewQueue: Array.isArray(parsed.linkReviewQueue) ? parsed.linkReviewQueue.filter(Boolean) : [],
    importConfidenceThreshold: Number.isFinite(Number(parsed.importConfidenceThreshold))
      ? Math.max(0, Math.min(100, Number(parsed.importConfidenceThreshold)))
      : 80,
    rejectedLinkSuggestionKeys: Array.isArray(parsed.rejectedLinkSuggestionKeys)
      ? parsed.rejectedLinkSuggestionKeys.filter((key: unknown): key is string => typeof key === "string")
      : [],
  };
};

const writeState = async (filePath: string, state: unknown) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const printSummary = (label: string, state: { people: unknown[]; edges: unknown[]; importReviewQueue?: unknown[] }) => {
  console.log(`${label}: ${state.people.length} people, ${state.edges.length} edges, ${state.importReviewQueue?.length || 0} queued imports`);
};

const [command = "help", inputPath, outputPath] = process.argv.slice(2);

if (command === "reset") {
  const targetPath = inputPath || DEFAULT_SEED_PATH;
  const state = buildSeedState();
  await writeState(targetPath, state);
  printSummary(`Reset ${targetPath}`, state);
} else if (command === "import") {
  if (!inputPath) throw new Error("Usage: npm run seed:import -- <input-json> [output-json]");
  const state = await loadAndValidateState(inputPath);
  const targetPath = outputPath || DEFAULT_SEED_PATH;
  await writeState(targetPath, {
    ...state,
    version: 1,
    exportedAt: new Date().toISOString(),
    importQueueSchemaVersion: IMPORT_QUEUE_SCHEMA_VERSION,
  });
  printSummary(`Imported ${inputPath} into ${targetPath}`, state);
} else if (command === "check") {
  if (!inputPath) throw new Error("Usage: npm run seed:check -- <input-json>");
  const state = await loadAndValidateState(inputPath);
  printSummary(`Checked ${inputPath}`, state);
} else {
  console.log([
    "Usage:",
    "  npm run seed:reset -- [output-json]",
    "  npm run seed:import -- <input-json> [output-json]",
    "  npm run seed:check -- <input-json>",
  ].join("\n"));
}
