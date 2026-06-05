import { INITIAL_EDGES_DATA, INITIAL_PEOPLE_DATA } from "../src/data";
import { validateImportedOrGeneratedAtlasData } from "../src/schemaValidation";

interface CanonicalDatasetCheckIssue {
  code: "impossible-date" | "invalid-reference" | "self-link" | "schema-error";
  path: string;
  message: string;
}

const peopleById = new Map(INITIAL_PEOPLE_DATA.map((person) => [person.id, person]));

const schemaResult = validateImportedOrGeneratedAtlasData({
  people: INITIAL_PEOPLE_DATA,
  edges: INITIAL_EDGES_DATA,
});

const issues: CanonicalDatasetCheckIssue[] = [
  ...schemaResult.issues.map((issue) => ({
    code: "schema-error" as const,
    path: issue.path,
    message: issue.message,
  })),
];

INITIAL_PEOPLE_DATA.forEach((person, index) => {
  if (typeof person.death === "number" && person.death < person.birth) {
    issues.push({
      code: "impossible-date",
      path: `people[${index}]`,
      message: `${person.id} has death year ${person.death} earlier than birth year ${person.birth}.`,
    });
  }
});

INITIAL_EDGES_DATA.forEach((edge, index) => {
  if (edge.source === edge.target) {
    issues.push({
      code: "self-link",
      path: `edges[${index}]`,
      message: `${edge.source} links to itself.`,
    });
  }

  const missingSource = edge.source !== "metadata" && !peopleById.has(edge.source);
  const missingTarget = !peopleById.has(edge.target);
  if (missingSource || missingTarget) {
    issues.push({
      code: "invalid-reference",
      path: `edges[${index}]`,
      message: `${edge.source}->${edge.target} references ${[
        missingSource ? `missing source ${edge.source}` : "",
        missingTarget ? `missing target ${edge.target}` : "",
      ].filter(Boolean).join(" and ")}.`,
    });
  }
});

if (issues.length > 0) {
  console.error("# Canonical Dataset Validation Failed");
  issues.forEach((issue) => {
    console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
  });
  process.exit(1);
}

console.log("Canonical dataset validation passed.");
