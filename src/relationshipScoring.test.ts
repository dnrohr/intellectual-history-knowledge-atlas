import { describe, expect, it } from "vitest";
import { scoreCandidateRelationship } from "./relationshipScoring";
import { WikidataCandidate } from "./importQueue";
import { Thinker } from "./types";

const thinker = (overrides: Partial<Thinker>): Thinker => ({
  id: "person",
  name: "Person",
  birth: 0,
  death: null,
  fields: ["Philosophy"],
  subfields: [],
  works: [],
  notes: null,
  ...overrides,
});

const candidate = (overrides: Partial<WikidataCandidate>): WikidataCandidate => ({
  id: "candidate",
  name: "Candidate",
  description: "",
  birth: null,
  death: null,
  sourceUrl: "https://www.wikidata.org/wiki/Q1",
  wikipediaUrl: null,
  fields: [],
  topics: [],
  works: [],
  ...overrides,
});

describe("scoreCandidateRelationship", () => {
  it("classifies direct advisor or student claims as mentorship", () => {
    const suggestion = scoreCandidateRelationship(
      candidate({ birth: 400, advisors: ["Hypatia"] }),
      thinker({ id: "candidate-draft", name: "Candidate", birth: 400 }),
      thinker({ id: "hypatia", name: "Hypatia", birth: 350 })
    );

    expect(suggestion.category).toBe("direct mentorship");
    expect(suggestion.confidenceExplanation).toBe("direct Wikidata claim");
    expect(suggestion.reasons).toContain("Wikidata advisor");
    expect(suggestion.score).toBeGreaterThanOrEqual(8);
  });

  it("classifies influenced-by claims as likely influence", () => {
    const suggestion = scoreCandidateRelationship(
      candidate({ birth: 1724, influencedBy: ["David Hume"] }),
      thinker({ id: "kant-draft", name: "Immanuel Kant", birth: 1724 }),
      thinker({ id: "hume", name: "David Hume", birth: 1711 })
    );

    expect(suggestion.category).toBe("likely influence");
    expect(suggestion.confidenceExplanation).toBe("direct Wikidata claim");
    expect(suggestion.reasons).toContain("Wikidata influenced by");
  });

  it("classifies shared works as collaboration", () => {
    const suggestion = scoreCandidateRelationship(
      candidate({ birth: 1900, works: ["Principia Mathematica"] }),
      thinker({ id: "whitehead-draft", name: "Alfred North Whitehead", birth: 1861 }),
      thinker({ id: "russell", name: "Bertrand Russell", birth: 1872, works: ["Principia Mathematica"] })
    );

    expect(suggestion.category).toBe("collaboration");
    expect(suggestion.reasons).toContain("work: Principia Mathematica");
    expect(suggestion.confidence).toBe("strong");
  });

  it("uses shared context and close chronology for parallel development", () => {
    const suggestion = scoreCandidateRelationship(
      candidate({ birth: 1879, fields: ["Physics"], topics: ["Relativity"] }),
      thinker({ id: "einstein-draft", name: "Albert Einstein", birth: 1879, fields: ["Physics"], subfields: ["Relativity"] }),
      thinker({ id: "poincare", name: "Henri Poincare", birth: 1854, fields: ["Physics"], subfields: ["Relativity"] })
    );

    expect(suggestion.category).toBe("parallel development");
    expect(suggestion.confidence).toBe("strong");
    expect(suggestion.reasons).toContain("field: Physics");
    expect(suggestion.reasons).toContain("topic: Relativity");
  });

  it("keeps thin evidence in needs-review", () => {
    const suggestion = scoreCandidateRelationship(
      candidate({ birth: 1960, fields: ["Sociology"] }),
      thinker({ id: "candidate-draft", name: "Candidate", birth: 1960, fields: ["Sociology"] }),
      thinker({ id: "ancient", name: "Ancient Thinker", birth: -400, fields: ["Philosophy"] })
    );

    expect(suggestion.category).toBe("needs review");
    expect(suggestion.confidence).toBe("weak");
    expect(suggestion.confidenceExplanation).toBe("thin evidence");
  });
});
