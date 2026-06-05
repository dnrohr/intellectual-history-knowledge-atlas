import { describe, expect, it } from "vitest";
import {
  buildPersonEntitiesFromThinkers,
  KNOWLEDGE_ENTITY_TYPES,
  normalizeKnowledgeEntities,
} from "./knowledgeModel";
import { Thinker } from "./types";

describe("knowledge model entities", () => {
  it("defines the first-class entity types used by the expanded graph", () => {
    expect(KNOWLEDGE_ENTITY_TYPES).toEqual([
      "Person",
      "Work",
      "Concept",
      "Movement",
      "Institution",
      "SourceClaim",
      "Relationship",
    ]);
  });

  it("normalizes valid mixed entity records and drops malformed records", () => {
    const entities = normalizeKnowledgeEntities([
      { id: "person:arendt", type: "Person", label: "Hannah Arendt", thinkerId: "arendt", birth: 1906, death: 1975, fields: ["Philosophy"], claimIds: ["claim:1"] },
      { id: "work:origins", type: "Work", label: "The Origins of Totalitarianism", title: "The Origins of Totalitarianism", authorIds: ["person:arendt"], date: 1951, identifiers: { isbn: "9780156701532", bad: 123 } },
      { id: "concept:public-sphere", type: "Concept", label: "Public sphere", fields: ["Political Theory"] },
      { id: "movement:phenomenology", type: "Movement", label: "Phenomenology", start: 1900, end: 1970 },
      { id: "institution:new-school", type: "Institution", label: "The New School", city: "New York", figureIds: ["person:arendt"] },
      { id: "claim:1", type: "SourceClaim", label: "SEP claim", sourceName: "Stanford Encyclopedia of Philosophy", sourceUrl: "https://plato.stanford.edu/", subjectEntityType: "Person", subjectEntityId: "person:arendt", field: "birth", value: "1906", confidence: 1.5, status: "accepted" },
      { id: "relationship:1", type: "Relationship", label: "Arendt authored Origins", sourceId: "person:arendt", targetId: "work:origins", relationshipType: "person authored work", confidence: 0.9, status: "accepted" },
      { id: "bad", type: "Person", label: "Missing fields", thinkerId: "bad", birth: "1900", death: null, fields: ["Philosophy"] },
    ]);

    expect(entities.map((entity) => entity.type)).toEqual([
      "Person",
      "Work",
      "Concept",
      "Movement",
      "Institution",
      "SourceClaim",
      "Relationship",
    ]);
    expect(entities.find((entity) => entity.type === "SourceClaim")?.confidence).toBe(1);
    expect(entities.find((entity) => entity.type === "Work")).toMatchObject({
      identifiers: { isbn: "9780156701532" },
    });
  });

  it("can project current thinkers into first-class person entities", () => {
    const people: Thinker[] = [{
      id: "arendt",
      name: "Hannah Arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
    }];

    expect(buildPersonEntitiesFromThinkers(people)).toEqual([{
      id: "person:arendt",
      type: "Person",
      label: "Hannah Arendt",
      thinkerId: "arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
    }]);
  });
});
