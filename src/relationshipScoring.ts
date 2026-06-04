import { Thinker } from "./types";
import { WikidataCandidate } from "./importQueue";
import { getLensOptionLabel, inferLensTags } from "./taxonomy";

export type RelationshipSuggestionCategory =
  | "likely influence"
  | "direct mentorship"
  | "collaboration"
  | "parallel development"
  | "source-context neighbor"
  | "needs review";

export type CandidateRelationshipSuggestion = {
  person: Thinker;
  score: number;
  reasons: string[];
  confidence: "strong" | "medium" | "weak";
  confidenceExplanation: string;
  category: RelationshipSuggestionCategory;
};

const normalizeForComparison = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const externalNameMatches = (values: string[] | undefined, name: string) =>
  (values || []).some((value) => normalizeForComparison(value) === normalizeForComparison(name));

const tokenizeEvidenceText = (value: string) =>
  Array.from(new Set(value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 4)
    .filter((token) => !["philosopher", "mathematician", "scientist", "writer", "known", "notable", "theory", "school"].includes(token))
  ));

export const getCandidatePersonTextOverlap = (candidate: WikidataCandidate, person: Thinker) => {
  const candidateTokens = tokenizeEvidenceText([
    candidate.description,
    candidate.movement || "",
    ...(candidate.works || []),
    ...(candidate.topics || []),
    ...(candidate.advisors || []),
    ...(candidate.students || []),
    ...(candidate.influencedBy || []),
    ...(candidate.employers || []),
    ...(candidate.educatedAt || []),
    ...(candidate.memberOf || []),
  ].join(" "));
  const personTokens = new Set(tokenizeEvidenceText([
    person.notes || "",
    person.movement || "",
    ...(person.works || []),
    ...(person.subfields || []),
  ].join(" ")));

  return candidateTokens.filter((token) => personTokens.has(token)).slice(0, 4);
};

export const scoreCandidateRelationship = (
  candidate: WikidataCandidate,
  draft: Thinker,
  person: Thinker
): CandidateRelationshipSuggestion => {
  const candidateLens = Object.values(inferLensTags(draft)).flat();
  const personLens = Object.values(inferLensTags(person)).flat();
  const sharedFields = person.fields.filter((field) => draft.fields.includes(field));
  const sharedTopics = (person.subfields || []).filter((topic) => draft.subfields?.includes(topic));
  const sharedLensTags = personLens.filter((tag) => candidateLens.includes(tag));
  const sharedWorks = (person.works || []).filter((work) =>
    (candidate.works || []).some((candidateWork) => normalizeForComparison(candidateWork) === normalizeForComparison(work))
  );
  const textOverlap = getCandidatePersonTextOverlap(candidate, person);
  const timeGap = candidate.birth === null
    ? 300
    : Math.min(
        Math.abs(person.birth - (candidate.death ?? candidate.birth)),
        Math.abs(candidate.birth - (person.death ?? person.birth))
      );
  const chronologicalDirection = candidate.birth !== null
    ? person.birth <= candidate.birth ? "candidate may inherit from this node" : "candidate may precede this node"
    : "";
  const chronologyScore = candidate.birth === null
    ? 0
    : timeGap <= 60
    ? 3
    : timeGap <= 150
    ? 2
    : timeGap <= 300
    ? 1
    : -2;
  const movementBonus = candidate.movement && person.movement === candidate.movement ? 4 : 0;
  const eraBonus = candidate.era && person.era === candidate.era ? 2 : 0;
  const regionBonus = candidate.region && person.region === candidate.region ? 1.5 : 0;
  const workBonus = sharedWorks.length * 5;
  const textBonus = Math.min(textOverlap.length, 3) * 1.5;
  const wikidataClaimReasons = [
    externalNameMatches(candidate.influencedBy, person.name) ? "Wikidata influenced by" : "",
    externalNameMatches(candidate.advisors, person.name) ? "Wikidata advisor" : "",
    externalNameMatches(candidate.students, person.name) ? "Wikidata student" : "",
    externalNameMatches(candidate.employers, person.name) ? "Wikidata employer" : "",
    externalNameMatches(candidate.educatedAt, person.name) ? "Wikidata educated at" : "",
    externalNameMatches(candidate.memberOf, person.name) ? "Wikidata member of" : "",
  ].filter(Boolean) as string[];
  const wikidataClaimBonus = wikidataClaimReasons.length * 8;
  const score =
    sharedFields.length * 4 +
    sharedTopics.length * 3 +
    sharedLensTags.length * 2 +
    wikidataClaimBonus +
    movementBonus +
    eraBonus +
    regionBonus +
    workBonus +
    textBonus +
    chronologyScore;
  const reasons = [
    ...wikidataClaimReasons,
    ...sharedFields.slice(0, 2).map((field) => `field: ${field}`),
    ...sharedTopics.slice(0, 2).map((topic) => `topic: ${topic}`),
    ...sharedLensTags.slice(0, 2).map((tag) => `lens: ${getLensOptionLabel(tag)}`),
    ...sharedWorks.slice(0, 1).map((work) => `work: ${work}`),
    ...textOverlap.slice(0, 2).map((token) => `source term: ${token}`),
    movementBonus > 0 ? `movement: ${candidate.movement}` : "",
    eraBonus > 0 ? `era: ${candidate.era}` : "",
    regionBonus > 0 ? `region: ${candidate.region}` : "",
    chronologyScore > 0 ? `chronology: ${chronologicalDirection}` : "",
  ].filter(Boolean) as string[];
  const confidence = score >= 12 ? "strong" : score >= 7 ? "medium" : "weak";
  const confidenceExplanation = wikidataClaimReasons.length > 0
    ? "direct Wikidata claim"
    : confidence === "strong"
    ? "multiple matching signals"
    : confidence === "medium"
    ? "shared context signals"
    : "thin evidence";
  const category: RelationshipSuggestionCategory = wikidataClaimReasons.some((reason) => reason.includes("advisor") || reason.includes("student"))
    ? "direct mentorship"
    : wikidataClaimReasons.some((reason) => reason.includes("influenced by"))
    ? "likely influence"
    : sharedWorks.length > 0 || wikidataClaimReasons.some((reason) => reason.includes("employer") || reason.includes("member of") || reason.includes("educated at"))
    ? "collaboration"
    : confidence === "weak"
    ? "needs review"
    : timeGap <= 40 && (sharedFields.length > 0 || sharedTopics.length > 0 || sharedLensTags.length > 0)
    ? "parallel development"
    : "source-context neighbor";

  return { person, score, reasons, confidence, confidenceExplanation, category };
};
