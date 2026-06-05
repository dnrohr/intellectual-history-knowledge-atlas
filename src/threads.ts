import { CanonicalThread, InfluenceEdge, Thread, ThreadSourceStatus } from "./types";

const inferThreadSourceStatus = (thread: CanonicalThread): ThreadSourceStatus => {
  if (thread.sourceStatus) return thread.sourceStatus;
  if (thread.confidence === "high") return "sourced";
  if (thread.confidence === "medium") return "partial";
  return "needs-source";
};

export const buildThreadFromCanonical = (thread: CanonicalThread): Thread => ({
  id: thread.id,
  title: thread.title,
  shortPurpose: thread.shortPurpose || thread.purpose,
  orderedEntities: thread.people.map((personId) => ({
    entityId: personId,
    entityType: "Person",
  })),
  keyWorks: thread.keyWorks || [],
  keyConcepts: thread.concepts,
  edgeTypes: thread.edgeTypes,
  confidence: thread.confidence,
  sourceStatus: inferThreadSourceStatus(thread),
});

const edgeMatchesThreadPair = (edge: InfluenceEdge, leftId: string, rightId: string) =>
  (edge.source === leftId && edge.target === rightId) ||
  (edge.source === rightId && edge.target === leftId);

export const tagRelationshipsWithThreads = (
  edges: InfluenceEdge[],
  threads: CanonicalThread[]
): InfluenceEdge[] =>
  edges.map((edge) => {
    const matchingThreadIds = threads
      .filter((thread) =>
        thread.people
          .slice(0, -1)
          .some((personId, index) => edgeMatchesThreadPair(edge, personId, thread.people[index + 1]))
      )
      .map((thread) => thread.id);
    const threadIds = Array.from(new Set([...(edge.threadIds || []), ...matchingThreadIds]));
    return threadIds.length > 0 ? { ...edge, threadIds } : edge;
  });

export type ThreadGapAuditCode =
  | "missing-intermediate-figure"
  | "missing-edge"
  | "missing-edge-source"
  | "weak-claim"
  | "overlong-chronology-jump";

export interface ThreadGapAuditFinding {
  threadId: string;
  code: ThreadGapAuditCode;
  severity: "info" | "warning" | "critical";
  stepIndex: number;
  sourceId?: string;
  targetId?: string;
  message: string;
}

export const auditThreadGaps = (
  threads: CanonicalThread[],
  people: Array<{ id: string; birth: number }>,
  edges: InfluenceEdge[],
  maxChronologyGapYears = 250
): ThreadGapAuditFinding[] => {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const findings: ThreadGapAuditFinding[] = [];

  threads.forEach((thread) => {
    thread.people.forEach((personId, index) => {
      if (!peopleById.has(personId)) {
        findings.push({
          threadId: thread.id,
          code: "missing-intermediate-figure",
          severity: "critical",
          stepIndex: index,
          sourceId: personId,
          message: "Thread references a missing intermediate figure.",
        });
      }
    });

    thread.people.slice(0, -1).forEach((sourceId, index) => {
      const targetId = thread.people[index + 1];
      const source = peopleById.get(sourceId);
      const target = peopleById.get(targetId);
      const edge = edges.find((candidate) => edgeMatchesThreadPair(candidate, sourceId, targetId));

      if (!edge) {
        findings.push({
          threadId: thread.id,
          code: "missing-edge",
          severity: "critical",
          stepIndex: index,
          sourceId,
          targetId,
          message: "Thread step has no relationship edge.",
        });
      } else {
        if ((edge.sourceClaims || edge.claimIds || []).length === 0) {
          findings.push({
            threadId: thread.id,
            code: "missing-edge-source",
            severity: "warning",
            stepIndex: index,
            sourceId,
            targetId,
            message: "Thread relationship has no source claims.",
          });
        }
        if ((edge.confidence ?? 1) < 0.5 || edge.status === "needs_source") {
          findings.push({
            threadId: thread.id,
            code: "weak-claim",
            severity: "warning",
            stepIndex: index,
            sourceId,
            targetId,
            message: "Thread relationship claim is weak or needs source review.",
          });
        }
      }

      if (source && target && Math.abs(target.birth - source.birth) > maxChronologyGapYears) {
        findings.push({
          threadId: thread.id,
          code: "overlong-chronology-jump",
          severity: "info",
          stepIndex: index,
          sourceId,
          targetId,
          message: "Thread step spans a large chronology gap.",
        });
      }
    });
  });

  return findings;
};

export const CANONICAL_THREADS: CanonicalThread[] = [
  {
    id: "logic-to-computation",
    title: "Logic To Computation",
    field: "Logic / Computing",
    purpose: "Follow formal reasoning from term logic and Stoic propositional logic into symbolic logic, analytic philosophy, and computability.",
    people: ["aristotle", "chrysippus", "leibniz", "boole", "frege", "russell", "wittgenstein", "turing"],
    concepts: ["syllogism", "propositional logic", "calculus ratiocinator", "Boolean algebra", "predicate logic", "logicism", "logical atomism", "language games", "universal computation"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship", "Source-context neighbor"],
    confidence: "medium",
  },
  {
    id: "metaphysics-to-idealism",
    title: "Metaphysics To Idealism",
    field: "Philosophy",
    purpose: "Trace being, substance, reason, and mind from classical metaphysics into German Idealism.",
    people: ["plato", "aristotle", "aquinas", "descartes", "spinoza", "leibniz", "kant", "hegel"],
    concepts: ["forms", "substance", "scholastic synthesis", "rationalism", "monism", "transcendental idealism", "dialectic"],
    edgeTypes: ["Influence", "Indirect influence", "Transmission"],
    confidence: "medium",
  },
  {
    id: "empiricism-to-pragmatism",
    title: "Empiricism To Pragmatism",
    field: "Philosophy / Psychology",
    purpose: "Follow sensory empiricism and skepticism into practical consequences, instrumentalism, and neo-pragmatism.",
    people: ["bacon", "locke", "hume", "mill", "peirce", "james", "dewey", "rorty"],
    concepts: ["induction", "tabula rasa", "skepticism", "liberty", "pragmatic maxim", "functional psychology", "instrumentalism", "anti-foundationalism"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "existentialism-to-poststructuralism",
    title: "Existentialism To Poststructuralism",
    field: "Philosophy / Critical Theory",
    purpose: "Trace existential freedom, genealogy, deconstruction, and performativity across modern continental philosophy.",
    people: ["kierkegaard", "nietzsche", "heidegger", "sartre", "simone_de_beauvoir", "foucault", "derrida", "butler"],
    concepts: ["anxiety", "nihilism", "Dasein", "existence precedes essence", "existential feminism", "power-knowledge", "deconstruction", "performativity"],
    edgeTypes: ["Influence", "Indirect influence", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "probability-to-causality",
    title: "Probability To Causality",
    field: "Mathematics / AI",
    purpose: "Follow uncertainty from chance problems into statistics, information theory, and causal machine learning.",
    people: ["pascal", "fermat", "bayes", "laplace", "gauss", "fisher_ronald", "kolmogorov", "shannon", "pearl_judea"],
    concepts: ["probability", "inverse probability", "least squares", "statistical inference", "axiomatized probability", "information", "causal graphs"],
    edgeTypes: ["Influence", "Indirect influence", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "causality-machine-learning",
    title: "Causality Machine Learning",
    field: "Mathematics / AI",
    purpose: "Trace Bayesian inference, statistical inference, axiomatized probability, causal graphs, statistical learning, and causal deep learning.",
    people: ["bayes", "laplace", "fisher_ronald", "kolmogorov", "pearl_judea", "vapnik", "bengio"],
    concepts: ["Bayesian updating", "inverse probability", "statistical inference", "probability axioms", "causal graphs", "statistical learning theory", "causal deep learning"],
    edgeTypes: ["Influence", "Indirect influence", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "geometry-to-topology",
    title: "Geometry To Topology",
    field: "Mathematics",
    purpose: "Follow geometry from axiomatic constructions through coordinates, manifolds, topology, and 3-manifold geometrization.",
    people: ["euclid", "descartes", "gauss", "riemann", "poincare", "hilbert", "noether", "atiyah", "thurston", "perelman"],
    concepts: ["axiomatic geometry", "analytic geometry", "curvature", "Riemannian manifolds", "topology", "axiomatization", "abstract algebra", "K-theory", "geometrization", "Ricci flow"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship"],
    confidence: "needs-review",
  },
  {
    id: "calculus-to-analysis",
    title: "Calculus To Analysis",
    field: "Mathematics",
    purpose: "Trace infinitesimal methods from ancient exhaustion through calculus, spectral analysis, rigor, and complex analysis.",
    people: ["archimedes", "newton", "leibniz", "euler", "fourier", "cauchy", "weierstrass", "riemann"],
    concepts: ["method of exhaustion", "fluxions", "differential notation", "analysis", "Fourier series", "limits", "epsilon-delta rigor", "complex manifolds"],
    edgeTypes: ["Influence", "Indirect influence", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "computation-foundations",
    title: "Computation Foundations",
    field: "Logic / Computing",
    purpose: "Trace formal calculation from symbolic logic through undecidability, lambda calculus, stored-program architecture, and information theory.",
    people: ["leibniz", "boole", "frege", "hilbert", "godel", "church", "turing", "von_neumann", "shannon"],
    concepts: ["binary arithmetic", "Boolean algebra", "predicate logic", "formalism", "incompleteness", "lambda calculus", "universal computation", "stored program", "information entropy"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship"],
    confidence: "medium",
  },
  {
    id: "symbolic-ai",
    title: "Symbolic AI",
    field: "Computing / AI",
    purpose: "Follow symbolic reasoning from formal logic and computability into Logic Theorist, Lisp-era AI, and early AI institutions.",
    people: ["leibniz", "boole", "frege", "russell", "turing", "newell", "simon_herbert", "mccarthy", "minsky"],
    concepts: ["calculus ratiocinator", "Boolean algebra", "predicate logic", "logicism", "computability", "Logic Theorist", "bounded rationality", "Lisp", "symbolic AI"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "neural-networks",
    title: "Neural Networks",
    field: "Computing / Cognitive Science",
    purpose: "Trace the path from neural logic and learning rules into perceptrons and deep learning.",
    people: ["mcculloch", "pitts", "hebb", "rosenblatt", "minsky", "rumelhart", "hinton", "lecun", "bengio"],
    concepts: ["threshold neuron", "Hebbian learning", "perceptron", "connectionism", "backpropagation", "deep learning"],
    edgeTypes: ["Collaboration", "Influence", "Indirect influence"],
    confidence: "medium",
  },
  {
    id: "language-and-cognition",
    title: "Language And Cognition",
    field: "Linguistics / Psychology",
    purpose: "Compare formal grammar, symbolic cognition, and embodied/cognitive linguistics.",
    people: ["saussure", "chomsky", "fodor", "pinker", "lakoff", "hofstadter"],
    concepts: ["structural linguistics", "generative grammar", "language of thought", "language acquisition", "conceptual metaphor", "analogy"],
    edgeTypes: ["Influence", "Parallel", "Indirect influence"],
    confidence: "needs-review",
  },
  {
    id: "human-computer-networks",
    title: "Human-Computer Networks",
    field: "Computing / Design",
    purpose: "Trace computability, stored-program architecture, information theory, interactive computing, object interfaces, and the web.",
    people: ["turing", "von_neumann", "shannon", "engelbart", "kay", "berners_lee"],
    concepts: ["universal computation", "stored program", "information entropy", "interactive computing", "personal computing", "hypertext web"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "quantum-field-thread",
    title: "Quantum Field Thread",
    field: "Physics",
    purpose: "Follow quantum mechanics through field theory, diagrams, renormalization, and unification.",
    people: ["planck", "einstein", "bohr", "heisenberg", "schrodinger", "dirac", "feynman", "dyson", "weinberg", "witten"],
    concepts: ["quanta", "relativity", "Copenhagen interpretation", "matrix mechanics", "wave mechanics", "QED", "renormalization", "electroweak theory", "string theory"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "medium",
  },
  {
    id: "mechanics-to-relativity",
    title: "Mechanics To Relativity",
    field: "Physics / Mathematics",
    purpose: "Follow mechanics from geometric statics and kinematics into analytical dynamics, field equations, and relativistic spacetime.",
    people: ["archimedes", "galileo", "newton", "hamilton_wr", "maxwell", "einstein"],
    concepts: ["statics", "kinematics", "laws of motion", "Hamiltonian dynamics", "field equations", "relativity"],
    edgeTypes: ["Influence", "Indirect influence"],
    confidence: "needs-review",
  },
  {
    id: "electromagnetism-to-information",
    title: "Electromagnetism To Information",
    field: "Physics / Computing",
    purpose: "Connect field theory, radio waves, communication limits, and the thermodynamics of information.",
    people: ["coulomb", "ampere", "faraday", "maxwell", "hertz", "shannon", "landauer"],
    concepts: ["electrostatics", "electrodynamics", "field lines", "Maxwell equations", "radio waves", "channel capacity", "information thermodynamics"],
    edgeTypes: ["Influence", "Indirect influence"],
    confidence: "needs-review",
  },
  {
    id: "mechanical-to-electrical-systems",
    title: "Mechanical To Electrical Systems",
    field: "Engineering / Computing",
    purpose: "Trace steam power, electromagnetic induction, field theory, electrical power systems, VLSI design, and modern processor architecture.",
    people: ["watt", "faraday", "maxwell", "tesla", "edison", "mead", "hennessy", "patterson"],
    concepts: ["steam engine", "electromagnetic induction", "Maxwell equations", "AC grids", "electrical utilities", "VLSI", "RISC architecture"],
    edgeTypes: ["Influence", "Indirect influence", "Rivalry", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "aerospace-flight",
    title: "Aerospace Flight",
    field: "Engineering / Aerospace",
    purpose: "Trace rocket equations, liquid-fueled rocketry, launch vehicles, Soviet spaceflight, and high-altitude aerospace systems engineering.",
    people: ["tsiolkovsky", "goddard", "von_braun", "korolev_sergei", "johnson_kelly", "rich_ben"],
    concepts: ["rocket equation", "liquid-fueled rockets", "Saturn V", "R-7", "Skunk Works", "stealth aircraft"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "energy-materials-storage",
    title: "Energy Materials Storage",
    field: "Chemistry / Engineering",
    purpose: "Trace electrochemical batteries, electrolysis, electromagnetic induction, intercalation chemistry, lithium cathodes, and commercial storage technologies.",
    people: ["volta", "davy", "faraday", "whittingham_stanley", "goodenough_john", "yoshino_akira"],
    concepts: ["voltaic pile", "electrolysis", "electromagnetic induction", "lithium intercalation", "lithium-cobalt-oxide cathodes", "lithium-ion batteries"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship"],
    confidence: "needs-review",
  },
  {
    id: "relativity-to-cosmology",
    title: "Relativity To Cosmology",
    field: "Physics / Cosmology",
    purpose: "Follow general relativity into observational confirmation, expanding-universe cosmology, inflation, and singularity theory.",
    people: ["einstein", "eddington", "lemaitre", "gamow", "peebles", "guth", "hawking", "penrose"],
    concepts: ["general relativity", "eclipse verification", "expanding universe", "Big Bang nucleosynthesis", "cosmic microwave background", "inflation", "black hole thermodynamics", "singularity theorems"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration", "Mentorship"],
    confidence: "needs-review",
  },
  {
    id: "matter-to-particles",
    title: "Matter To Particles",
    field: "Physics",
    purpose: "Trace atomic structure from electron and nucleus discoveries into neutrons, nuclear reactions, quarks, and electroweak theory.",
    people: ["thomson_jj", "rutherford", "bohr", "chadwick", "fermi_enrico", "gell_mann", "weinberg"],
    concepts: ["electron", "nuclear atom", "quantized atom", "neutron", "nuclear reactions", "quarks", "electroweak unification"],
    edgeTypes: ["Mentorship", "Influence", "Indirect influence"],
    confidence: "needs-review",
  },
  {
    id: "evolution-to-genomics",
    title: "Evolution To Genomics",
    field: "Biology",
    purpose: "Connect natural history, evolutionary theory, genetics, molecular biology, and gene editing.",
    people: ["aristotle", "linnaeus", "darwin", "mendel", "morgan_th", "fisher_ronald", "haldane", "rosalind_franklin", "watson_crick", "sanger_fred", "doudna", "venter"],
    concepts: ["classification", "natural selection", "inheritance", "chromosomes", "population genetics", "DNA structure", "sequencing", "CRISPR", "genomics"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "evolutionary-theory",
    title: "Evolutionary Theory",
    field: "Biology",
    purpose: "Trace biological classification and evolutionary explanation into genetics, population synthesis, and modern debates over selection.",
    people: ["aristotle", "linnaeus", "lamarck", "darwin", "mendel", "fisher_ronald", "haldane", "wright_sewall", "gould", "dawkins"],
    concepts: ["classification", "taxonomy", "acquired inheritance", "natural selection", "inheritance", "population genetics", "modern synthesis", "genetic drift", "punctuated equilibrium", "gene-centric selection"],
    edgeTypes: ["Influence", "Indirect influence", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "microbiology-medicine",
    title: "Microbiology And Medicine",
    field: "Biology / Medicine",
    purpose: "Follow circulation, germ theory, bacteriology, antiseptic surgery, and vaccine development into modern clinical medicine.",
    people: ["harvey", "pasteur", "koch", "lister", "salk_jonas", "sabin_albert"],
    concepts: ["circulation", "germ theory", "bacteriology", "antisepsis", "inactivated vaccine", "live attenuated vaccine"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "molecular-biology",
    title: "Molecular Biology",
    field: "Biology / Genetics",
    purpose: "Trace inheritance, chromosomes, DNA structure, gene regulation, genetic coding, sequencing, genome editing, and synthetic genomics.",
    people: ["mendel", "morgan_th", "rosalind_franklin", "watson_crick", "brenner_sydney", "monod", "nirenberg_marshall", "sanger_fred", "doudna", "venter"],
    concepts: ["inheritance", "chromosomes", "DNA structure", "messenger RNA", "operon regulation", "genetic code", "sequencing", "CRISPR", "genomics"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration", "Mentorship"],
    confidence: "needs-review",
  },
  {
    id: "ecology-systems",
    title: "Ecology Systems",
    field: "Biology / Environment",
    purpose: "Connect biogeography, ecosystem ecology, ecological niches, systems ecology, planetary ecology, biodiversity, and environmental warning.",
    people: ["humboldt", "tansley", "hutchinson_ge", "odum_howard", "lovelock_james", "wilson_eo", "carson_rachel"],
    concepts: ["biogeography", "ecosystem", "ecological niche", "energy flows", "Gaia hypothesis", "biodiversity", "environmental warning"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "liberalism-and-capabilities",
    title: "Liberalism And Capabilities",
    field: "Political Thought / Economics",
    purpose: "Trace social contract theory, liberty, justice, entitlement critique, and human capability debates.",
    people: ["hobbes", "locke", "rousseau", "smith", "mill", "rawls", "rawls_alt", "sen", "nussbaum"],
    concepts: ["social contract", "natural rights", "political economy", "liberty", "justice as fairness", "minimal state", "capabilities"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "political-economy",
    title: "Political Economy",
    field: "Economics / Political Thought",
    purpose: "Trace classical political economy through population limits, labor value, macroeconomic management, market order, embedded markets, and capabilities.",
    people: ["smith", "ricardo", "malthus", "marx", "keynes", "hayek", "polanyi", "sen"],
    concepts: ["invisible hand", "comparative advantage", "population limits", "historical materialism", "macroeconomics", "spontaneous order", "double movement", "capabilities"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "sociology-social-science",
    title: "Sociology Social Science",
    field: "Social Science",
    purpose: "Trace positivist sociology, social facts, bureaucracy, exchange systems, cultural capital, and actor-network theory.",
    people: ["comte", "durkheim", "weber", "mauss", "bourdieu", "latour"],
    concepts: ["positivism", "social facts", "bureaucracy", "gift exchange", "habitus", "actor-network theory"],
    edgeTypes: ["Influence", "Indirect influence", "Mentorship", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "feminist-thought",
    title: "Feminist Thought",
    field: "Political Thought / Philosophy",
    purpose: "Trace feminist liberty, gender equality, existential feminism, intersectionality, and gender performativity.",
    people: ["wollstonecraft", "harriet_mill", "simone_de_beauvoir", "hooks_bell", "butler"],
    concepts: ["women's rights", "feminist liberty", "gender equality", "existential feminism", "intersectionality", "gender performativity"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration"],
    confidence: "needs-review",
  },
  {
    id: "postcolonial-cultural-theory",
    title: "Postcolonial Cultural Theory",
    field: "Political Thought / Cultural Theory",
    purpose: "Trace materialist critique, cultural hegemony, cultural materialism, postcolonial representation, and intersectional cultural critique.",
    people: ["marx", "gramsci", "williams_raymond", "said", "hooks_bell"],
    concepts: ["historical materialism", "cultural hegemony", "cultural materialism", "Orientalism", "intersectionality"],
    edgeTypes: ["Influence", "Indirect influence"],
    confidence: "needs-review",
  },
  {
    id: "literary-modernity",
    title: "Literary Modernity",
    field: "Literature / Theory",
    purpose: "Trace romantic world-literature, psychological existential fiction, bureaucratic modernism, labyrinthine metafiction, and postmodern textual theory.",
    people: ["goethe", "dostoevsky", "kafka", "borges", "derrida"],
    concepts: ["world literature", "psychological existentialism", "bureaucratic alienation", "metafiction", "deconstruction"],
    edgeTypes: ["Influence", "Indirect influence", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "aesthetics-romanticism",
    title: "Aesthetics Romanticism",
    field: "Philosophy / Arts",
    purpose: "Trace critical aesthetics, romantic literature, total artwork, perspectival critique, and modern naturalist aesthetics.",
    people: ["kant", "goethe", "wagner", "nietzsche", "santayana", "croce"],
    concepts: ["critical aesthetics", "romanticism", "Gesamtkunstwerk", "will to power", "naturalist aesthetics", "aesthetic expression"],
    edgeTypes: ["Influence", "Indirect influence", "Collaboration", "Parallel"],
    confidence: "needs-review",
  },
  {
    id: "communication-networks",
    title: "Communication Networks",
    field: "Engineering / Computing",
    purpose: "Follow media and signal systems from printing through telegraphy, information theory, packet networks, Ethernet, and the web.",
    people: ["gutenberg", "gauss", "kelvin", "nyquist", "shannon", "cerf", "metcalfe", "berners_lee"],
    concepts: ["printing", "electromagnetic telegraphy", "submarine cables", "sampling", "channel capacity", "packet networking", "Ethernet", "World Wide Web"],
    edgeTypes: ["Influence", "Indirect influence"],
    confidence: "medium",
  },
];

export const THREADS: Thread[] = CANONICAL_THREADS.map(buildThreadFromCanonical);
