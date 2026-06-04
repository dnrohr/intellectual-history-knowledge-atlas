import { Thinker } from "./types";

export interface TaxonomyDomain {
  name: string;
  fields: string[];
}

export interface TaxonomyTopicGroup {
  name: string;
  topics: string[];
}

export interface AtlasLensOption {
  id: string;
  label: string;
  matches: string[];
}

export interface AtlasLens {
  id: string;
  label: string;
  description: string;
  options: AtlasLensOption[];
}

export const TAXONOMY_DOMAINS: TaxonomyDomain[] = [
  {
    name: "Formal Systems",
    fields: ["Mathematics", "Logic", "Computing"],
  },
  {
    name: "Natural Inquiry",
    fields: ["Physics", "Astronomy", "Cosmology", "Chemistry", "Biology", "Engineering"],
  },
  {
    name: "Human Systems",
    fields: ["Philosophy", "Political Thought", "Economics", "History", "Psychology", "Linguistics"],
  },
  {
    name: "Arts & Interpretation",
    fields: ["Literature", "Music"],
  },
];

export const TOPIC_GROUPS: Record<string, TaxonomyTopicGroup[]> = {
  Mathematics: [
    { name: "Structures", topics: ["Geometry", "Algebra", "Topology"] },
    { name: "Change & Quantity", topics: ["Analysis", "Number Theory"] },
    { name: "Uncertainty", topics: ["Probability"] },
  ],
  Logic: [
    { name: "Formal Systems", topics: ["Formal Logic", "Foundations"] },
    { name: "Language", topics: ["Language & Meaning"] },
    { name: "Computation", topics: ["Computability"] },
  ],
  Computing: [
    { name: "Core Theory", topics: ["Computation", "Information Theory", "Algorithms"] },
    { name: "Systems", topics: ["Networks"] },
    { name: "Intelligence", topics: ["Artificial Intelligence"] },
  ],
  Physics: [
    { name: "Classical Nature", topics: ["Mechanics", "Optics", "Thermodynamics"] },
    { name: "Fields & Matter", topics: ["Electromagnetism", "Quantum Theory"] },
    { name: "Space & Time", topics: ["Relativity"] },
  ],
  Astronomy: [
    { name: "Observation", topics: ["Observation", "Cosmic Distance"] },
    { name: "Models", topics: ["Celestial Mechanics", "Planetary Models"] },
  ],
  Cosmology: [
    { name: "Large-Scale Structure", topics: ["Universe Structure", "Expansion"] },
    { name: "Extreme Objects", topics: ["Black Holes", "Dark Matter"] },
    { name: "Origins", topics: ["Early Universe"] },
  ],
  Chemistry: [
    { name: "Matter", topics: ["Atomic Theory", "Bonding", "Materials"] },
    { name: "Life & Method", topics: ["Biochemistry", "Laboratory Method"] },
  ],
  Biology: [
    { name: "Organisms", topics: ["Anatomy", "Ecology"] },
    { name: "Lineage", topics: ["Evolution", "Genetics"] },
    { name: "Molecular Life", topics: ["Molecular Biology"] },
  ],
  Engineering: [
    { name: "Machines & Energy", topics: ["Machines", "Energy Systems"] },
    { name: "Built Systems", topics: ["Aerospace", "Communication Systems", "Infrastructure"] },
  ],
  Philosophy: [
    { name: "Reality & Knowledge", topics: ["Metaphysics", "Epistemology"] },
    { name: "Value & Action", topics: ["Ethics"] },
    { name: "Mind & Language", topics: ["Mind", "Language"] },
    { name: "Inquiry", topics: ["Science & Method"] },
  ],
  "Political Thought": [
    { name: "Authority", topics: ["State Power", "Democracy", "Revolution"] },
    { name: "Norms", topics: ["Rights", "Justice"] },
    { name: "Material Order", topics: ["Political Economy"] },
  ],
  Economics: [
    { name: "Exchange", topics: ["Markets", "Value"] },
    { name: "Systems", topics: ["Macroeconomics", "Institutions"] },
    { name: "Strategic Action", topics: ["Game Theory"] },
  ],
  History: [
    { name: "Method", topics: ["Historical Method"] },
    { name: "Collective Life", topics: ["Civilization", "Culture", "Technology & Society"] },
  ],
  Psychology: [
    { name: "Mind", topics: ["Cognition", "Consciousness"] },
    { name: "Behavior", topics: ["Behavior", "Development", "Social Psychology"] },
  ],
  Linguistics: [
    { name: "Structure", topics: ["Grammar", "Language Structure"] },
    { name: "Meaning", topics: ["Signs & Meaning", "Cognitive Linguistics"] },
  ],
  Literature: [
    { name: "Form", topics: ["Poetics", "Narrative"] },
    { name: "Historical Modes", topics: ["Modernism", "Political Literature", "Critical Theory"] },
  ],
  Music: [
    { name: "Form", topics: ["Composition", "Harmony", "Theory"] },
    { name: "Practice", topics: ["Performance", "Cultural Form"] },
  ],
};

export const CONTROLLED_TOPICS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TOPIC_GROUPS).map(([field, groups]) => [
    field,
    groups.flatMap((group) => group.topics),
  ])
);

export const ATLAS_LENSES: AtlasLens[] = [
  {
    id: "problem",
    label: "Problem Area",
    description: "The broad question this person helps clarify.",
    options: [
      { id: "knowledge", label: "Knowledge", matches: ["epistemology", "logic", "method", "foundations", "signs", "meaning", "grammar"] },
      { id: "matter", label: "Matter & Nature", matches: ["physics", "chemistry", "matter", "atomic", "mechanics", "thermodynamics", "materials"] },
      { id: "life", label: "Life", matches: ["biology", "evolution", "genetics", "anatomy", "ecology", "molecular"] },
      { id: "mind", label: "Mind", matches: ["mind", "psychology", "cognition", "consciousness", "behavior"] },
      { id: "order", label: "Society & Order", matches: ["political", "economics", "state", "rights", "justice", "democracy", "institutions", "history"] },
      { id: "form", label: "Form & Expression", matches: ["literature", "music", "poetics", "narrative", "composition", "harmony", "critical"] },
      { id: "computation", label: "Computation", matches: ["computing", "computation", "algorithms", "information", "artificial intelligence", "networks"] },
      { id: "cosmos", label: "Cosmos", matches: ["astronomy", "cosmology", "celestial", "planetary", "universe", "black holes", "expansion"] },
    ],
  },
  {
    id: "method",
    label: "Method",
    description: "The style of intellectual work.",
    options: [
      { id: "proof", label: "Proof & Formalization", matches: ["mathematics", "logic", "proof", "formal", "geometry", "algebra", "topology", "foundations"] },
      { id: "experiment", label: "Experiment", matches: ["experiment", "laboratory", "observation", "empirical", "scientific method"] },
      { id: "modeling", label: "Models & Systems", matches: ["model", "systems", "networks", "simulation", "mechanics", "economics"] },
      { id: "critique", label: "Critique", matches: ["critique", "deconstruction", "power", "critical", "political", "feminism"] },
      { id: "interpretation", label: "Interpretation", matches: ["interpretation", "hermeneutics", "literature", "history", "culture", "language"] },
      { id: "synthesis", label: "Synthesis", matches: ["synthesis", "polymath", "humanism", "interdisciplinary", "bridge"] },
    ],
  },
  {
    id: "role",
    label: "Historical Role",
    description: "How this person tends to function in the atlas.",
    options: [
      { id: "founder", label: "Founder", matches: ["founded", "father of", "first", "pioneered", "invented", "created"] },
      { id: "formalizer", label: "Formalizer", matches: ["formalized", "axiomatic", "systematic", "codified", "proved", "defined"] },
      { id: "transmitter", label: "Transmitter", matches: ["translated", "commentaries", "transmitted", "popularized", "communicator"] },
      { id: "critic", label: "Critic", matches: ["critic", "challenged", "response", "argued against", "deconstruct"] },
      { id: "connector", label: "Connector", matches: ["bridge", "synthesized", "linked", "combined", "integrated"] },
    ],
  },
];

export const getDomainForField = (field: string) =>
  TAXONOMY_DOMAINS.find((domain) => domain.fields.includes(field))?.name || "Other Domains";

export const getFieldsForDomain = (domainName: string) =>
  TAXONOMY_DOMAINS.find((domain) => domain.name === domainName)?.fields || [];

export const getTopicGroupsForField = (field: string, extraTopics: string[] = []) => {
  const groups = TOPIC_GROUPS[field] || [];
  const knownTopics = new Set(groups.flatMap((group) => group.topics));
  const localTopics = Array.from(new Set(extraTopics.filter((topic) => topic && !knownTopics.has(topic)))).sort();

  return localTopics.length > 0
    ? [...groups, { name: "Local Additions", topics: localTopics }]
    : groups;
};

export const buildDisciplineGroups = (fields: string[]) => {
  const disciplineGroups = TAXONOMY_DOMAINS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => fields.includes(field)),
  }));

  const groupedFields = new Set(disciplineGroups.flatMap((group) => group.fields));
  const ungroupedFields = fields.filter((field) => !groupedFields.has(field));
  return ungroupedFields.length > 0
    ? [...disciplineGroups, { name: "Other Domains", fields: ungroupedFields }]
    : disciplineGroups;
};

export const buildSubfieldsByField = (fields: string[], people: Thinker[]) =>
  Object.fromEntries(
    fields.map((field) => [
      field,
      Array.from(new Set([...(CONTROLLED_TOPICS[field] || []), ...people
        .filter((person) => person.fields?.includes(field))
        .flatMap((person) => person.subfields || [])])).sort(),
    ])
  ) as Record<string, string[]>;

export const buildTopicGroupsByField = (fields: string[], subfieldsByField: Record<string, string[]>) =>
  Object.fromEntries(
    fields.map((field) => [field, getTopicGroupsForField(field, subfieldsByField[field] || [])])
  ) as Record<string, TaxonomyTopicGroup[]>;

export const inferLensTags = (item: {
  fields?: string[];
  subfields?: string[];
  works?: string[];
  notes?: string | null;
  movement?: string | null;
}) => {
  const haystack = [
    ...(item.fields || []),
    ...(item.subfields || []),
    ...(item.works || []),
    item.notes || "",
    item.movement || "",
  ].join(" ").toLowerCase();

  return ATLAS_LENSES.reduce<Record<string, string[]>>((acc, lens) => {
    acc[lens.id] = lens.options
      .filter((option) => option.matches.some((match) => haystack.includes(match.toLowerCase())))
      .map((option) => option.id);
    return acc;
  }, {});
};

export const getLensOptionLabel = (optionId: string) => {
  for (const lens of ATLAS_LENSES) {
    const option = lens.options.find((item) => item.id === optionId);
    if (option) return option.label;
  }
  return optionId;
};
