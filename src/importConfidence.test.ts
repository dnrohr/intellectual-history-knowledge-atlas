import { describe, expect, it } from "vitest";
import { scoreCandidateConfidence } from "./importConfidence";
import { WikidataCandidate } from "./importQueue";

const candidate = (overrides: Partial<WikidataCandidate>): WikidataCandidate => ({
  id: "q1",
  name: "Candidate",
  description: "",
  birth: null,
  death: null,
  sourceUrl: "https://www.wikidata.org/wiki/Q1",
  wikipediaUrl: null,
  ...overrides,
});

describe("scoreCandidateConfidence", () => {
  it("returns zero for missing candidates", () => {
    expect(scoreCandidateConfidence("kant", null)).toBe(0);
  });

  it("rewards exact normalized name matches", () => {
    expect(scoreCandidateConfidence("Immanuel Kant", candidate({ name: "Immanuel Kant" }))).toBe(55);
    expect(scoreCandidateConfidence("immanuel-kant", candidate({ name: "Immanuel Kant" }))).toBe(55);
  });

  it("adds structured metadata signals", () => {
    const scored = scoreCandidateConfidence("Kant", candidate({
      name: "Kant",
      birth: 1724,
      description: "German philosopher",
      fields: ["Philosophy"],
      topics: ["Epistemology"],
      wikipediaUrl: "https://en.wikipedia.org/wiki/Immanuel_Kant",
    }));

    expect(scored).toBe(100);
  });

  it("caps confidence at 100", () => {
    const scored = scoreCandidateConfidence("Rich Candidate", candidate({
      name: "Rich Candidate",
      birth: 1900,
      description: "A fully described person",
      fields: ["Philosophy", "Mathematics"],
      topics: ["Logic", "Epistemology"],
      wikipediaUrl: "https://example.com/rich",
    }));

    expect(scored).toBeLessThanOrEqual(100);
  });
});
