import { describe, expect, it } from "vitest";
import {
  buildRelationshipEntityFromInfluenceEdge,
  buildConceptEntitiesFromThinkers,
  buildMovementEntities,
  buildPersonEntitiesFromThinkers,
  buildWorkAuthorshipRelationships,
  buildWorkEntitiesFromThinkers,
  getConceptEntityId,
  getMovementEntityId,
  getWorkEntityId,
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
      { id: "relationship:1", type: "Relationship", label: "Arendt authored Origins", source: { entityType: "Person", entityId: "person:arendt" }, target: { entityType: "Work", entityId: "work:origins" }, relationshipType: "person authored work", confidence: 0.9, status: "accepted" },
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

  it("converts legacy person-to-person edges into typed relationship records", () => {
    const relationship = buildRelationshipEntityFromInfluenceEdge({
      source: "arendt",
      target: "habermas",
      type: "Indirect influence",
      strength: 4,
      confidence: 0.75,
      status: "accepted",
      sourceClaims: ["claim:arendt-habermas"],
    });

    expect(relationship).toMatchObject({
      id: "relationship:person:arendt:Indirect influence:person:habermas",
      type: "Relationship",
      source: { entityType: "Person", entityId: "person:arendt" },
      target: { entityType: "Person", entityId: "person:habermas" },
      relationshipType: "Indirect influence",
      claimIds: ["claim:arendt-habermas"],
    });
  });

  it("projects current thinker works into first-class work nodes", () => {
    const people: Thinker[] = [{
      id: "arendt",
      name: "Hannah Arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
      works: ["The Origins of Totalitarianism", "The Human Condition", "The Origins of Totalitarianism"],
    }];

    expect(getWorkEntityId("arendt", "The Human Condition")).toBe("work:arendt:the-human-condition");
    expect(buildWorkEntitiesFromThinkers(people)).toEqual([
      {
        id: "work:arendt:the-origins-of-totalitarianism",
        type: "Work",
        label: "The Origins of Totalitarianism",
        title: "The Origins of Totalitarianism",
        authorIds: ["person:arendt"],
      },
      {
        id: "work:arendt:the-human-condition",
        type: "Work",
        label: "The Human Condition",
        title: "The Human Condition",
        authorIds: ["person:arendt"],
      },
    ]);
  });

  it("creates authored-work relationships for projected work nodes", () => {
    const people: Thinker[] = [{
      id: "arendt",
      name: "Hannah Arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
      works: ["The Human Condition"],
    }];

    expect(buildWorkAuthorshipRelationships(people)).toEqual([{
      id: "relationship:person:arendt:person authored work:work:arendt:the-human-condition",
      type: "Relationship",
      label: "person:arendt authored The Human Condition",
      source: {
        entityId: "person:arendt",
        entityType: "Person",
      },
      target: {
        entityId: "work:arendt:the-human-condition",
        entityType: "Work",
      },
      relationshipType: "person authored work",
      status: "accepted",
    }]);
  });

  it("projects thinker subfields into first-class concept nodes", () => {
    const people: Thinker[] = [
      {
        id: "arendt",
        name: "Hannah Arendt",
        birth: 1906,
        death: 1975,
        fields: ["Philosophy"],
        subfields: ["Public sphere", "Totalitarianism"],
      },
      {
        id: "habermas",
        name: "Jurgen Habermas",
        birth: 1929,
        death: null,
        fields: ["Sociology", "Philosophy"],
        subfields: ["Public sphere"],
      },
    ];

    expect(getConceptEntityId("Public sphere")).toBe("concept:public-sphere");
    expect(buildConceptEntitiesFromThinkers(people)).toEqual([
      {
        id: "concept:public-sphere",
        type: "Concept",
        label: "Public sphere",
        fields: ["Philosophy", "Sociology"],
      },
      {
        id: "concept:totalitarianism",
        type: "Concept",
        label: "Totalitarianism",
        fields: ["Philosophy"],
      },
    ]);
  });

  it("projects curated and thinker movement labels into first-class movement nodes", () => {
    const people: Thinker[] = [
      {
        id: "hegel",
        name: "G. W. F. Hegel",
        birth: 1770,
        death: 1831,
        fields: ["Philosophy"],
        movement: "German Idealism",
      },
      {
        id: "adorno",
        name: "Theodor W. Adorno",
        birth: 1903,
        death: 1969,
        fields: ["Sociology"],
        movement: "Frankfurt School",
      },
    ];

    expect(getMovementEntityId("German Idealism")).toBe("movement:german-idealism");
    expect(buildMovementEntities(people, [
      { name: "German Idealism", start: 1780, end: 1850, core: "Mind and history", fields: ["Philosophy"] },
    ])).toEqual([
      {
        id: "movement:frankfurt-school",
        type: "Movement",
        label: "Frankfurt School",
        start: null,
        end: null,
        fields: ["Sociology"],
      },
      {
        id: "movement:german-idealism",
        type: "Movement",
        label: "German Idealism",
        start: 1780,
        end: 1850,
        fields: ["Philosophy"],
      },
    ]);
  });
});
