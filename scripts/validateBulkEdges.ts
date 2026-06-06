import { INITIAL_EDGES_DATA, INITIAL_PEOPLE_DATA } from "../src/data";
import { validateBulkEdgeRelationshipRules } from "../src/edgeValidation";

const invalidResults = validateBulkEdgeRelationshipRules(INITIAL_PEOPLE_DATA, INITIAL_EDGES_DATA, [], new Date())
  .filter((result) => result.finalDisposition !== "confirmed-existing-edge");

if (invalidResults.length > 0) {
  console.error("# Bulk Edge Validation Failed");
  invalidResults.forEach((result) => {
    console.error(
      `- ${result.subject.source.id}->${result.subject.target.id} (${result.subject.type}): ${result.blockingReasons.join(", ")}`
    );
  });
  process.exit(1);
}

console.log(`Bulk edge validation passed for all ${INITIAL_EDGES_DATA.length} edge(s).`);
