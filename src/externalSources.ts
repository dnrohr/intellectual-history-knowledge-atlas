export interface ExternalSource {
  id: string;
  name: string;
  bestFor: string;
  importTargets: string[];
  reviewNotes: string;
  status: "ready-to-design" | "requires-api-key";
}

export const EXTERNAL_SOURCES: ExternalSource[] = [
  {
    id: "wikidata",
    name: "Wikidata",
    bestFor: "biographical facts, occupations, works, institutions, movements",
    importTargets: ["Person", "Work", "Institution", "Movement", "Claim"],
    reviewNotes: "Good first adapter because entities are stable and source claims can be reviewed before merge.",
    status: "ready-to-design",
  },
  {
    id: "openalex",
    name: "OpenAlex",
    bestFor: "modern authors, works, institutions, concepts, citation neighborhoods",
    importTargets: ["Person", "Work", "Concept", "Relationship"],
    reviewNotes: "Useful for scholarly networks, but imported concepts need mapping into atlas lenses.",
    status: "ready-to-design",
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    bestFor: "paper references, citations, authors, influence-like publication trails",
    importTargets: ["Work", "Person", "Relationship"],
    reviewNotes: "Best for recent science and computing; should stay in a review queue because citation is not the same as intellectual influence.",
    status: "requires-api-key",
  },
];
