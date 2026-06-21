import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAUREATE_ROSTER } from "../src/generatedLaureates";
import {
  EXCLUDED_NOBEL_CATEGORIES,
  INCLUDED_NOBEL_CATEGORIES,
  isSupportedLaureateRelationship,
  nobelAwardsForLaureate,
  parseFieldsMedalists,
  resolveExistingPerson,
  stableLaureateId,
} from "./importLaureates";

describe("laureate import", () => {
  it("includes only the requested Nobel categories", () => {
    const laureate = {
      id: "test",
      wikidata: { id: "Q1" },
      nobelPrizes: [
        ...[...INCLUDED_NOBEL_CATEGORIES].map((category, index) => ({ awardYear: String(2000 + index), category: { en: category }, links: [] })),
        ...[...EXCLUDED_NOBEL_CATEGORIES].map((category, index) => ({ awardYear: String(2010 + index), category: { en: category }, links: [] })),
      ],
    };
    expect(nobelAwardsForLaureate(laureate).map((award) => award.category).sort()).toEqual([...INCLUDED_NOBEL_CATEGORIES].sort());
  });

  it("ingests Fields Medal years and declined status from IMU markup", () => {
    const html = `<h2>The Fields Medalists, chronologically listed</h2><div class="list__group"><h3>2006</h3><li class="blue-link"><a href="#">Grigori Perelman*</a></li></div><div class="list__group"><h3>2022</h3><li class="blue-link"><a href="#">Maryna Viazovska</a></li></div></section>`;
    expect(parseFieldsMedalists(html)).toEqual([
      { name: "Grigori Perelman", year: 2006, status: "declined" },
      { name: "Maryna Viazovska", year: 2022, status: "received" },
    ]);
  });

  it("deduplicates repeat laureates by Wikidata identity while preserving awards", () => {
    const repeats = LAUREATE_ROSTER.filter((record) => record.awards.length > 1);
    expect(new Set(LAUREATE_ROSTER.map((record) => record.wikidataId)).size).toBe(LAUREATE_ROSTER.length);
    expect(repeats.map((record) => record.name)).toEqual(expect.arrayContaining(["John Bardeen", "Marie Curie", "Frederick Sanger", "K. Barry Sharpless"]));
  });

  it("matches an existing person by normalized name and birth year", () => {
    expect(resolveExistingPerson("Marie Skłodowska Curie", 1867, [
      { id: "curie", name: "Marie Sklodowska Curie", birth: 1867, death: 1934 },
    ])?.id).toBe("curie");
    expect(resolveExistingPerson("Richard P. Feynman", 1918, [
      { id: "feynman", name: "Richard Feynman", birth: 1918, death: 1988 },
    ])?.id).toBe("feynman");
    expect(resolveExistingPerson("Kenneth G. Wilson", 1936, [
      { id: "wilson_robert", name: "Robert Woodrow Wilson", birth: 1936, death: null },
    ])).toBeUndefined();
  });

  it("generates stable IDs from Wikidata IDs", () => {
    expect(stableLaureateId("Q937")).toBe("laureate_q937");
  });

  it("requires award and identity provenance for every generated record", () => {
    for (const record of LAUREATE_ROSTER) {
      expect(record.wikidataId).toMatch(/^Q\d+$/);
      expect(record.provenance.some((source) => source.sourceName === "Wikidata" && source.sourceUrl === record.wikidataUrl)).toBe(true);
      for (const award of record.awards) {
        expect(award.officialSourceUrl).toMatch(/^https:\/\/(www\.)?(nobelprize\.org|mathunion\.org)\//);
      }
    }
  });

  it("rejects unsupported co-laureate relationships", () => {
    expect(isSupportedLaureateRelationship({
      source: "laureate_a",
      target: "laureate_b",
      type: "Co-laureate",
      evidenceClaim: "Shared the 2020 prize",
      evidenceSourceUrl: "https://www.nobelprize.org/prizes/physics/2020/summary/",
    })).toBe(false);
    const candidates = JSON.parse(readFileSync("data/laureates/relationship-candidates.json", "utf8")).candidates;
    expect(candidates.every(isSupportedLaureateRelationship)).toBe(true);
    expect(candidates.some((candidate: any) => /co-laureate|shared award/i.test(`${candidate.type} ${candidate.note}`))).toBe(false);
  });
});
