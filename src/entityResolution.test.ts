import { describe, expect, it } from "vitest";
import {
  buildEntityResolutionResult,
  classifyEntityMergeDecision,
  DEFAULT_ENTITY_RESOLUTION_POLICY,
  requiresManualMergeOverride,
  scoreNamedEntityMatch,
  scorePersonEntityMatch,
  scoreWorkEntityMatch,
} from "./entityResolution";

describe("entity resolution", () => {
  it("scores person matches from names, dates, external IDs, and context overlap", () => {
    const score = scorePersonEntityMatch({
      id: "candidate",
      name: "Hannah Arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
      occupations: ["political theorist"],
      externalIds: { viaf: ["123"], loc: ["n79021164"] },
      works: ["The Human Condition"],
      institutions: ["The New School"],
      movements: ["Existential phenomenology"],
    }, {
      id: "existing",
      name: "H. Arendt",
      alternateNames: ["Hannah Arendt"],
      birth: 1906,
      death: 1975,
      fields: ["Political Thought", "Philosophy"],
      occupations: ["Political theorist"],
      externalIds: { viaf: ["123"] },
      works: ["The Human Condition"],
      institutions: ["The New School"],
      movements: ["Existential phenomenology"],
    });

    expect(score).toEqual({
      score: 0.96,
      reasons: ["name", "birth", "death", "external-id", "field", "occupation", "work", "institution", "movement"],
    });
  });

  it("keeps weak person matches low without identity evidence", () => {
    expect(scorePersonEntityMatch({
      id: "candidate",
      name: "Jane Smith",
      birth: 1906,
      fields: ["Philosophy"],
    }, {
      id: "existing",
      name: "Hannah Arendt",
      birth: 1906,
      fields: ["Philosophy"],
    }).score).toBeLessThan(0.3);
  });

  it("scores work matches from identifiers, titles, authors, and dates", () => {
    expect(scoreWorkEntityMatch({
      id: "candidate",
      title: "Critique of Pure Reason",
      translatedTitles: ["Kritik der reinen Vernunft"],
      authorNames: ["Immanuel Kant"],
      date: 1781,
      identifiers: { doi: "https://doi.org/10.1000/kant", openalex: "https://openalex.org/W1" },
    }, {
      id: "existing",
      title: "Kritik der reinen Vernunft",
      authorNames: ["Immanuel Kant"],
      date: 1781,
      identifiers: { doi: "10.1000/kant", openalex: "https://openalex.org/W1" },
    })).toEqual({
      score: 1,
      reasons: ["doi", "openalex", "title", "author", "date"],
    });
  });

  it("keeps weak work matches low when only dates overlap", () => {
    expect(scoreWorkEntityMatch({
      id: "candidate",
      title: "One Work",
      date: 1781,
    }, {
      id: "existing",
      title: "Another Work",
      date: 1781,
    }).score).toBe(0.1);
  });

  it("scores institution matches using name, city, and external IDs", () => {
    expect(scoreNamedEntityMatch({
      id: "candidate",
      type: "Institution",
      label: "Institute for Advanced Study",
      city: "Princeton",
      externalIds: { ror: ["https://ror.org/00hx57361"] },
    }, {
      id: "existing",
      type: "Institution",
      label: "IAS",
      alternateLabels: ["Institute for Advanced Study"],
      city: "Princeton",
      externalIds: { ror: ["https://ror.org/00hx57361"] },
    })).toEqual({
      score: 0.7,
      reasons: ["label", "external-id", "city"],
    });
  });

  it("scores movement matches using labels, chronology, and fields", () => {
    expect(scoreNamedEntityMatch({
      id: "candidate",
      type: "Movement",
      label: "German Idealism",
      start: 1780,
      end: 1850,
      fields: ["Philosophy"],
    }, {
      id: "existing",
      type: "Movement",
      label: "German Idealism",
      start: 1785,
      end: 1845,
      fields: ["Philosophy"],
    })).toEqual({
      score: 0.65,
      reasons: ["label", "chronology", "field"],
    });
  });

  it("scores concept matches using labels, fields, and broader terms", () => {
    expect(scoreNamedEntityMatch({
      id: "candidate",
      type: "Concept",
      label: "Public sphere",
      fields: ["Political Thought"],
      broaderTerms: ["Democracy"],
    }, {
      id: "existing",
      type: "Concept",
      label: "Public sphere",
      fields: ["Political Thought"],
      broaderTerms: ["Democracy"],
    })).toEqual({
      score: 0.6,
      reasons: ["label", "broader-term", "field"],
    });
  });

  it("classifies merge decisions from thresholds and conflicts", () => {
    expect(classifyEntityMergeDecision({ score: 0.9, reasons: ["doi"] })).toBe("auto-merge");
    expect(classifyEntityMergeDecision({ score: 0.6, reasons: ["label"] })).toBe("provisional-merge");
    expect(classifyEntityMergeDecision({ score: 0.2, reasons: [] })).toBe("keep-separate");
    expect(classifyEntityMergeDecision({ score: 0.95, reasons: ["name"] }, undefined, true)).toBe("conflict");
  });

  it("preserves conflicting observations with the resolution decision", () => {
    expect(buildEntityResolutionResult({ score: 0.92, reasons: ["name", "birth"] }, [{
      field: "birth",
      candidateValue: "1907",
      existingValue: "1906",
      observationIds: ["observation:wikidata:Q1"],
      claimIds: ["claim:birth-conflict"],
    }])).toEqual({
      decision: "conflict",
      match: { score: 0.92, reasons: ["name", "birth"] },
      conflicts: [{
        field: "birth",
        candidateValue: "1907",
        existingValue: "1906",
        observationIds: ["observation:wikidata:Q1"],
        claimIds: ["claim:birth-conflict"],
      }],
    });
  });

  it("keeps manual merge as an override and recovery path", () => {
    expect(DEFAULT_ENTITY_RESOLUTION_POLICY).toEqual({
      defaultImportPath: "automated-resolution",
      manualMergeRole: "override-recovery",
      manualReviewDecisions: ["provisional-merge", "conflict"],
    });
    expect(requiresManualMergeOverride("auto-merge")).toBe(false);
    expect(requiresManualMergeOverride("keep-separate")).toBe(false);
    expect(requiresManualMergeOverride("provisional-merge")).toBe(true);
    expect(requiresManualMergeOverride("conflict")).toBe(true);
  });
});
