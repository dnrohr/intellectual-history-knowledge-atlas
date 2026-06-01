export interface TaxonomyDomain {
  name: string;
  fields: string[];
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

export const CONTROLLED_TOPICS: Record<string, string[]> = {
  Mathematics: ["Geometry", "Algebra", "Analysis", "Number Theory", "Probability", "Topology"],
  Logic: ["Formal Logic", "Foundations", "Language & Meaning", "Computability"],
  Computing: ["Computation", "Information Theory", "Algorithms", "Networks", "Artificial Intelligence"],
  Physics: ["Mechanics", "Optics", "Electromagnetism", "Quantum Theory", "Relativity", "Thermodynamics"],
  Astronomy: ["Celestial Mechanics", "Observation", "Planetary Models", "Cosmic Distance"],
  Cosmology: ["Universe Structure", "Expansion", "Black Holes", "Dark Matter", "Early Universe"],
  Chemistry: ["Atomic Theory", "Bonding", "Materials", "Biochemistry", "Laboratory Method"],
  Biology: ["Evolution", "Genetics", "Anatomy", "Ecology", "Molecular Biology"],
  Engineering: ["Machines", "Energy Systems", "Aerospace", "Communication Systems", "Infrastructure"],
  Philosophy: ["Metaphysics", "Epistemology", "Ethics", "Mind", "Science & Method", "Language"],
  "Political Thought": ["Rights", "State Power", "Democracy", "Justice", "Revolution", "Political Economy"],
  Economics: ["Markets", "Value", "Macroeconomics", "Game Theory", "Institutions"],
  History: ["Historical Method", "Civilization", "Culture", "Technology & Society"],
  Psychology: ["Cognition", "Behavior", "Development", "Social Psychology", "Consciousness"],
  Linguistics: ["Grammar", "Signs & Meaning", "Language Structure", "Cognitive Linguistics"],
  Literature: ["Poetics", "Narrative", "Modernism", "Political Literature", "Critical Theory"],
  Music: ["Composition", "Harmony", "Theory", "Performance", "Cultural Form"],
};

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
