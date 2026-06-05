import { describe, expect, it } from "vitest";
import { scorePersonEntityMatch } from "./entityResolution";

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
});
