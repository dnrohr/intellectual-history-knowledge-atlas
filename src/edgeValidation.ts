import { InfluenceEdge, KnownRelationshipType, SourceClaimEntity, Thinker } from "./types";

export type BulkEdgeValidationOrigin = "existing-edge" | "discovered-candidate";
export type BulkEdgeStructuralStatus = "valid" | "invalid";
export type BulkEdgeEvidenceStatus = "supported" | "unsupported" | "weak" | "conflicting";
export type BulkEdgeChronologyStatus = "valid" | "impossible" | "unknown";
export type BulkEdgeRecommendedAction =
  | "confirm"
  | "add"
  | "remove"
  | "discard"
  | "auto-investigate";
export type BulkEdgeFinalDisposition =
  | "confirmed-existing-edge"
  | "added-confirmed-edge"
  | "removed-existing-edge"
  | "discarded-candidate";

export interface BulkEdgeEndpoint {
  id: string;
  label?: string;
}

export interface BulkEdgeValidationSubject {
  id: string;
  source: BulkEdgeEndpoint;
  target: BulkEdgeEndpoint;
  type: string;
  edge?: InfluenceEdge;
  claimIds: string[];
  sourceUrls: string[];
}

export interface BulkEdgeValidationResult {
  id: string;
  origin: BulkEdgeValidationOrigin;
  subject: BulkEdgeValidationSubject;
  structuralStatus: BulkEdgeStructuralStatus;
  evidenceStatus: BulkEdgeEvidenceStatus;
  chronologyStatus: BulkEdgeChronologyStatus;
  sourceClaimCoverage: number;
  confidenceScore: number;
  recommendedAction: BulkEdgeRecommendedAction;
  finalDisposition?: BulkEdgeFinalDisposition;
  blockingReasons: string[];
}

export interface BulkEdgeValidationInputs {
  edges: InfluenceEdge[];
  claims?: SourceClaimEntity[];
}

const LEGACY_RELATIONSHIP_TYPES = [
  "Collaboration",
  "Critique",
  "Friendship",
  "Indirect influence",
  "Influence",
  "Mentorship",
  "Parallel",
  "Parallel development",
  "Recorded influence",
  "Rivalry",
  "Source-context neighbor",
] as const;

const TYPED_RELATIONSHIP_TYPES: KnownRelationshipType[] = [
  "person authored work",
  "work introduced concept",
  "person influenced person",
  "person mentored person",
  "person collaborated with person",
  "person participated in movement",
  "person affiliated with institution",
  "concept shaped movement",
  "work influenced work",
];

export const VALID_EDGE_RELATIONSHIP_TYPES = [
  ...LEGACY_RELATIONSHIP_TYPES,
  ...TYPED_RELATIONSHIP_TYPES,
] as const;

const VALID_EDGE_RELATIONSHIP_TYPE_SET = new Set<string>(VALID_EDGE_RELATIONSHIP_TYPES);
const NON_DIRECTIONAL_RELATIONSHIP_TYPES = new Set([
  "Collaboration",
  "Critique",
  "Friendship",
  "Parallel",
  "Parallel development",
  "Rivalry",
  "Source-context neighbor",
  "person collaborated with person",
]);

const edgeId = (edge: InfluenceEdge, index = 0) =>
  edge.id || `edge:${edge.source}:${edge.type}:${edge.target}:${index}`;

export const createExistingEdgeValidationSubject = (
  edge: InfluenceEdge,
  index = 0
): BulkEdgeValidationSubject => ({
  id: edgeId(edge, index),
  source: { id: edge.source },
  target: { id: edge.target },
  type: String(edge.type),
  edge,
  claimIds: edge.claimIds || [],
  sourceUrls: edge.sourceClaims || [],
});

export const createBulkEdgeValidationResult = (
  result: BulkEdgeValidationResult
): BulkEdgeValidationResult => result;

const edgeDirectionKey = (edge: InfluenceEdge) =>
  `${edge.source}->${edge.target}:${edge.type}`;

const edgePairKey = (edge: InfluenceEdge) =>
  `${[edge.source, edge.target].sort().join("<->")}:${edge.type}`;

const hasImpossibleChronology = (edge: InfluenceEdge, peopleById: Map<string, Thinker>) => {
  if (NON_DIRECTIONAL_RELATIONSHIP_TYPES.has(String(edge.type))) return false;
  const source = peopleById.get(edge.source);
  const target = peopleById.get(edge.target);
  if (!source || !target) return false;
  return source.birth > target.birth + 20;
};

export const validateBulkEdgeStructure = (
  people: Thinker[],
  edges: InfluenceEdge[]
): BulkEdgeValidationResult[] => {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const directionCounts = new Map<string, number>();
  const pairDirections = new Map<string, Set<string>>();

  edges.forEach((edge) => {
    const directionKey = edgeDirectionKey(edge);
    directionCounts.set(directionKey, (directionCounts.get(directionKey) || 0) + 1);
    const pairKey = edgePairKey(edge);
    pairDirections.set(pairKey, new Set([...(pairDirections.get(pairKey) || []), `${edge.source}->${edge.target}`]));
  });

  return edges.map((edge, index) => {
    const blockingReasons: string[] = [];
    if (!peopleById.has(edge.source)) blockingReasons.push("missing-source");
    if (!peopleById.has(edge.target)) blockingReasons.push("missing-target");
    if (edge.source === edge.target) blockingReasons.push("self-link");
    if (hasImpossibleChronology(edge, peopleById)) blockingReasons.push("impossible-chronology");
    if ((directionCounts.get(edgeDirectionKey(edge)) || 0) > 1) blockingReasons.push("duplicate-same-direction");
    if ((pairDirections.get(edgePairKey(edge))?.size || 0) > 1) blockingReasons.push("duplicate-opposite-direction");
    if (!VALID_EDGE_RELATIONSHIP_TYPE_SET.has(String(edge.type))) blockingReasons.push("invalid-relationship-type");

    const structuralStatus: BulkEdgeStructuralStatus = blockingReasons.length > 0 ? "invalid" : "valid";
    return createBulkEdgeValidationResult({
      id: `validation:structure:${edgeId(edge, index)}`,
      origin: "existing-edge",
      subject: createExistingEdgeValidationSubject(edge, index),
      structuralStatus,
      evidenceStatus: "unsupported",
      chronologyStatus: blockingReasons.includes("impossible-chronology") ? "impossible" : "valid",
      sourceClaimCoverage: 0,
      confidenceScore: edge.confidence ?? 0.5,
      recommendedAction: structuralStatus === "valid" ? "auto-investigate" : "remove",
      finalDisposition: structuralStatus === "valid" ? undefined : "removed-existing-edge",
      blockingReasons,
    });
  });
};
