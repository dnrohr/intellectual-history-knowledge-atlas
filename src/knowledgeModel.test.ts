import { describe, expect, it } from "vitest";
import {
  aggregateSourceClaimsBySubject,
  buildExpandedKnowledgeEntitiesFromAtlas,
  buildRelationshipEntityFromInfluenceEdge,
  buildConceptEntitiesFromThinkers,
  buildInstitutionEntities,
  buildMovementEntities,
  buildPersonEntitiesFromThinkers,
  buildWorkAuthorshipRelationships,
  buildWorkEntitiesFromThinkers,
  createSourceClaimEntity,
  getConceptEntityId,
  getAggregatedClaimIdsForSubject,
  getInstitutionEntityId,
  getMovementEntityId,
  getSourceClaimEntityId,
  getWorkEntityId,
  KNOWLEDGE_ENTITY_TYPES,
  normalizeKnowledgeEntities,
  relationshipEndpointsMatchType,
  RELATIONSHIP_TYPE_DEFINITIONS,
  splitRawObservationsFromAcceptedRecords,
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

  it("defines typed relationship vocabulary with endpoint constraints", () => {
    expect(RELATIONSHIP_TYPE_DEFINITIONS).toEqual([
      { type: "person authored work", sourceType: "Person", targetType: "Work" },
      { type: "work introduced concept", sourceType: "Work", targetType: "Concept" },
      { type: "person influenced person", sourceType: "Person", targetType: "Person" },
      { type: "person mentored person", sourceType: "Person", targetType: "Person" },
      { type: "person collaborated with person", sourceType: "Person", targetType: "Person" },
      { type: "person participated in movement", sourceType: "Person", targetType: "Movement" },
      { type: "person affiliated with institution", sourceType: "Person", targetType: "Institution" },
      { type: "concept shaped movement", sourceType: "Concept", targetType: "Movement" },
      { type: "work influenced work", sourceType: "Work", targetType: "Work" },
    ]);
    expect(relationshipEndpointsMatchType("person authored work", "Person", "Work")).toBe(true);
    expect(relationshipEndpointsMatchType("person authored work", "Work", "Person")).toBe(false);
    expect(relationshipEndpointsMatchType("Indirect influence", "Person", "Person")).toBe(true);
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
      claimIds: ["claim:arendt:identity"],
    }];

    expect(buildPersonEntitiesFromThinkers(people)).toEqual([{
      id: "person:arendt",
      type: "Person",
      label: "Hannah Arendt",
      claimIds: ["claim:arendt:identity"],
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
        claimIds: [],
        fields: ["Philosophy", "Sociology"],
      },
      {
        id: "concept:totalitarianism",
        type: "Concept",
        label: "Totalitarianism",
        claimIds: [],
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
      { name: "German Idealism", start: 1780, end: 1850, core: "Mind and history", fields: ["Philosophy"], claimIds: ["claim:german-idealism"] },
    ])).toEqual([
      {
        id: "movement:frankfurt-school",
        type: "Movement",
        label: "Frankfurt School",
        claimIds: [],
        start: null,
        end: null,
        fields: ["Sociology"],
      },
      {
        id: "movement:german-idealism",
        type: "Movement",
        label: "German Idealism",
        claimIds: ["claim:german-idealism"],
        start: 1780,
        end: 1850,
        fields: ["Philosophy"],
      },
    ]);
  });

  it("projects curated institutions into first-class institution nodes", () => {
    expect(getInstitutionEntityId("Princeton IAS")).toBe("institution:princeton-ias");
    expect(buildInstitutionEntities([
      { name: "Princeton IAS", city: "Princeton NJ", peak_start: 1933, peak_end: 1970, figures: ["einstein", "godel"], claimIds: ["claim:princeton"] },
      { name: "Bell Laboratories", city: "Murray Hill NJ", peak_start: 1925, peak_end: 1985, figures: ["shannon"] },
    ])).toEqual([
      {
        id: "institution:bell-laboratories",
        type: "Institution",
        label: "Bell Laboratories",
        claimIds: [],
        city: "Murray Hill NJ",
        figureIds: ["person:shannon"],
      },
      {
        id: "institution:princeton-ias",
        type: "Institution",
        label: "Princeton IAS",
        claimIds: ["claim:princeton"],
        city: "Princeton NJ",
        figureIds: ["person:einstein", "person:godel"],
      },
    ]);
  });

  it("aggregates source claims per entity or relationship subject", () => {
    const claims = normalizeKnowledgeEntities([
      { id: "claim:person:1", type: "SourceClaim", label: "Birth claim", sourceName: "SEP", subjectEntityType: "Person", subjectEntityId: "person:arendt", field: "birth", value: "1906", confidence: 1, status: "accepted" },
      { id: "claim:person:2", type: "SourceClaim", label: "Field claim", sourceName: "Wikidata", subjectEntityType: "Person", subjectEntityId: "person:arendt", field: "field", value: "Philosophy", confidence: 0.8, status: "candidate" },
      { id: "claim:relationship:1", type: "SourceClaim", label: "Influence claim", sourceName: "Manual", subjectEntityType: "Relationship", subjectEntityId: "relationship:1", field: "relationshipType", value: "person influenced person", confidence: 0.6, status: "conflicting" },
    ]).filter((entity) => entity.type === "SourceClaim");

    const aggregations = aggregateSourceClaimsBySubject(claims);

    expect(aggregations).toEqual([
      {
        subjectEntityId: "person:arendt",
        subjectEntityType: "Person",
        claimIds: ["claim:person:1", "claim:person:2"],
        statusCounts: {
          observed: 0,
          candidate: 1,
          accepted: 1,
          rejected: 0,
          stale: 0,
          conflicting: 0,
        },
        averageConfidence: 0.9,
      },
      {
        subjectEntityId: "relationship:1",
        subjectEntityType: "Relationship",
        claimIds: ["claim:relationship:1"],
        statusCounts: {
          observed: 0,
          candidate: 0,
          accepted: 0,
          rejected: 0,
          stale: 0,
          conflicting: 1,
        },
        averageConfidence: 0.6,
      },
    ]);
    expect(getAggregatedClaimIdsForSubject(aggregations, "relationship:1", "Relationship")).toEqual(["claim:relationship:1"]);
  });

  it("creates structured source claim records from drafts", () => {
    expect(getSourceClaimEntityId("person:arendt", "birth", "SEP", "1906")).toBe("claim:person-arendt:birth:sep:1906");
    expect(createSourceClaimEntity({
      sourceName: "SEP",
      sourceUrl: "https://plato.stanford.edu/",
      subjectEntityId: "person:arendt",
      subjectEntityType: "Person",
      field: "birth",
      value: "1906",
      confidence: 1.2,
      status: "candidate",
    })).toEqual({
      id: "claim:person-arendt:birth:sep:1906",
      type: "SourceClaim",
      label: "SEP: birth",
      sourceName: "SEP",
      sourceUrl: "https://plato.stanford.edu/",
      subjectEntityId: "person:arendt",
      subjectEntityType: "Person",
      field: "birth",
      value: "1906",
      confidence: 1,
      status: "candidate",
    });
  });

  it("keeps raw source observations separate from accepted atlas records", () => {
    const acceptedRecords = buildPersonEntitiesFromThinkers([{
      id: "arendt",
      name: "Hannah Arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
    }]);

    const split = splitRawObservationsFromAcceptedRecords([
      {
        id: "observation:1",
        sourceName: "Wikidata",
        sourceUrl: "https://www.wikidata.org/wiki/Q60025",
        observedAt: "2026-06-05T00:00:00.000Z",
        raw: { id: "Q60025", birth: 1906 },
        normalizedClaims: [{
          sourceName: "Wikidata",
          sourceUrl: "https://www.wikidata.org/wiki/Q60025",
          subjectEntityId: "person:arendt",
          subjectEntityType: "Person",
          field: "birth",
          value: "1906",
          confidence: 0.8,
        }],
      },
    ], acceptedRecords);

    expect(split.rawObservations).toHaveLength(1);
    expect(split.acceptedRecords).toEqual(acceptedRecords);
    expect(split.candidateClaims).toEqual([{
      id: "claim:person-arendt:birth:wikidata:1906",
      type: "SourceClaim",
      label: "Wikidata: birth",
      sourceName: "Wikidata",
      sourceUrl: "https://www.wikidata.org/wiki/Q60025",
      subjectEntityId: "person:arendt",
      subjectEntityType: "Person",
      field: "birth",
      value: "1906",
      confidence: 0.8,
      status: "observed",
    }]);
  });

  it("builds expanded knowledge entities from the current atlas state", () => {
    const people: Thinker[] = [{
      id: "arendt",
      name: "Hannah Arendt",
      birth: 1906,
      death: 1975,
      fields: ["Philosophy"],
      subfields: ["Public sphere"],
      movement: "Postwar",
      works: ["The Human Condition"],
    }];

    expect(buildExpandedKnowledgeEntitiesFromAtlas(people, [{
      source: "arendt",
      target: "arendt",
      type: "person influenced person",
      strength: 1,
    }]).map((entity) => entity.type)).toEqual([
      "Person",
      "Work",
      "Concept",
      "Movement",
      "Relationship",
    ]);
  });
});
