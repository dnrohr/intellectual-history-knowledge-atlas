import { INITIAL_EDGES_DATA, INITIAL_PEOPLE_DATA } from "../src/data";
import { validateBulkEdgeStructure } from "../src/edgeValidation";

const invalidResults = validateBulkEdgeStructure(INITIAL_PEOPLE_DATA, INITIAL_EDGES_DATA)
  .filter((result) => result.structuralStatus === "invalid");

if (invalidResults.length > 0) {
  console.error("# Bulk Edge Structural Validation Failed");
  invalidResults.forEach((result) => {
    console.error(
      `- ${result.subject.source.id}->${result.subject.target.id} (${result.subject.type}): ${result.blockingReasons.join(", ")}`
    );
  });
  process.exit(1);
}

console.log(`Bulk edge structural validation passed for ${INITIAL_EDGES_DATA.length} edge(s).`);
