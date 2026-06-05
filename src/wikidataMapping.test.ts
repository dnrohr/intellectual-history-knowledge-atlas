import { describe, expect, it } from "vitest";
import { inferWikidataEntityType } from "./wikidataMapping";

describe("wikidata mapping", () => {
  it("classifies non-person Wikidata entities for harvesting", () => {
    expect(inferWikidataEntityType({ hasBirthDate: true })).toBe("Person");
    expect(inferWikidataEntityType({ instanceOf: ["written work"] })).toBe("Work");
    expect(inferWikidataEntityType({ description: "research university in Germany" })).toBe("Institution");
    expect(inferWikidataEntityType({ instanceOf: ["philosophical movement"] })).toBe("Movement");
    expect(inferWikidataEntityType({ description: "concept in epistemology" })).toBe("Concept");
  });
});
