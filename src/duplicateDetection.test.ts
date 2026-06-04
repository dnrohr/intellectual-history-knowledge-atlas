import { describe, expect, it } from "vitest";
import { findDuplicateCandidateId } from "./duplicateDetection";
import { Thinker } from "./types";
import { WikidataCandidate } from "./importQueue";

const person = (overrides: Partial<Thinker>): Thinker => ({
  id: "person",
  name: "Person",
  birth: 0,
  death: null,
  fields: ["Philosophy"],
  ...overrides,
});

const candidate = (overrides: Partial<WikidataCandidate>): WikidataCandidate => ({
  id: "candidate",
  name: "Candidate",
  description: "",
  birth: null,
  death: null,
  sourceUrl: "https://www.wikidata.org/wiki/Q0",
  wikipediaUrl: null,
  ...overrides,
});

describe("findDuplicateCandidateId", () => {
  it("matches normalized names and parenthetical aliases", () => {
    const people = [person({ id: "avicenna", name: "Avicenna (Ibn Sina)", birth: 980 })];

    expect(findDuplicateCandidateId(candidate({ name: "Ibn Sina", birth: 980 }), people)).toBe("avicenna");
  });

  it("matches candidate aliases", () => {
    const people = [person({ id: "confucius", name: "Confucius", birth: -551 })];

    expect(findDuplicateCandidateId(candidate({ name: "Kong Qiu", aliases: ["Confucius"], birth: -551 }), people)).toBe("confucius");
  });

  it("matches reused source urls in notes", () => {
    const people = [person({ id: "kant", name: "Immanuel Kant", birth: 1724, notes: "Imported from https://en.wikipedia.org/wiki/Immanuel_Kant" })];

    expect(findDuplicateCandidateId(candidate({ name: "Different Kant", wikipediaUrl: "https://en.wikipedia.org/wiki/Immanuel_Kant" }), people)).toBe("kant");
  });

  it("matches close dates when a work overlaps", () => {
    const people = [person({ id: "darwin", name: "Charles Darwin", birth: 1809, death: 1882, works: ["Origin of Species"] })];

    expect(findDuplicateCandidateId(candidate({ name: "C. Darwin", birth: 1810, death: 1881, works: ["Origin of Species"] }), people)).toBe("darwin");
  });

  it("does not match close dates without death or work evidence", () => {
    const people = [person({ id: "nearby", name: "Nearby Person", birth: 1809, death: 1882 })];

    expect(findDuplicateCandidateId(candidate({ name: "Another Person", birth: 1810, death: 1895 }), people)).toBeNull();
  });
});
