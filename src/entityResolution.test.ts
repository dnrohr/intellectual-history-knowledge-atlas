import { describe, expect, it } from "vitest";
import { scorePersonEntityMatch, scoreWorkEntityMatch } from "./entityResolution";

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
});
