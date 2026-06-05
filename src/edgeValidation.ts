import { InfluenceEdge, KnownRelationshipType, SourceClaimEntity, Thinker } from "./types";
import { getSourceClaimRecencyDays } from "./knowledgeModel";

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

const relationshipSubjectIdForEdge = (edge: InfluenceEdge) =>
  edge.id || `relationship:person:${edge.source}:${edge.type}:person:${edge.target}`;

const isHighImpactEdge = (edge: InfluenceEdge) =>
  edge.status === "accepted" ||
  edge.strength >= 4 ||
  (edge.threadIds || []).length > 0;

const isUsableRelationshipClaim = (claim: SourceClaimEntity) =>
  claim.subjectEntityType === "Relationship" &&
  claim.status !== "rejected" &&
  claim.status !== "conflicting" &&
  claim.status !== "stale";

export const validateBulkEdgeEvidence = (
  people: Thinker[],
  edges: InfluenceEdge[],
  claims: SourceClaimEntity[] = [],
  now: Date = new Date()
): BulkEdgeValidationResult[] => {
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  return validateBulkEdgeStructure(people, edges).map((result) => {
    const edge = result.subject.edge;
    if (!edge || result.structuralStatus === "invalid") return result;

    const claimIds = edge.claimIds || [];
    const sourceUrls = edge.sourceClaims || [];
    const attachedClaims = claimIds.map((claimId) => claimsById.get(claimId)).filter((claim): claim is SourceClaimEntity => Boolean(claim));
    const relationshipId = relationshipSubjectIdForEdge(edge);
    const directRelationshipClaims = attachedClaims.filter((claim) =>
      claim.subjectEntityType === "Relationship" &&
      (claim.subjectEntityId === relationshipId || claimIds.includes(claim.id))
    );
    const usableRelationshipClaims = directRelationshipClaims.filter(isUsableRelationshipClaim);
    const staleClaims = attachedClaims.filter((claim) => claim.status === "stale" || (getSourceClaimRecencyDays(claim, now) ?? 0) > 3650);
    const rejectedOrConflictingClaims = attachedClaims.filter((claim) => claim.status === "rejected" || claim.status === "conflicting");
    const blockingReasons = [...result.blockingReasons];

    if (claimIds.length === 0 && sourceUrls.length === 0) blockingReasons.push("missing-source-evidence");
    if (staleClaims.length > 0) blockingReasons.push("stale-source-claim");
    if (edge.status === "accepted" && rejectedOrConflictingClaims.length > 0) {
      blockingReasons.push("rejected-or-conflicting-claim-on-accepted-edge");
    }
    if (isHighImpactEdge(edge) && (edge.confidence ?? 0.5) < 0.75) {
      blockingReasons.push("weak-confidence-high-impact-edge");
    }
    if (attachedClaims.length > 0 && directRelationshipClaims.length === 0) {
      blockingReasons.push("endpoint-only-source-claims");
    }

    const referenceCount = claimIds.length + sourceUrls.length;
    const supportedReferenceCount = usableRelationshipClaims.length + sourceUrls.length;
    const sourceClaimCoverage = referenceCount === 0
      ? 0
      : Number((supportedReferenceCount / referenceCount).toFixed(3));
    const evidenceStatus: BulkEdgeEvidenceStatus =
      rejectedOrConflictingClaims.length > 0
        ? "conflicting"
        : blockingReasons.includes("weak-confidence-high-impact-edge")
          ? "weak"
          : sourceClaimCoverage > 0
            ? "supported"
            : "unsupported";
    const confidenceScore = Math.min(1, Number((((edge.confidence ?? 0.5) + sourceClaimCoverage) / 2).toFixed(3)));
    const finalDisposition: BulkEdgeFinalDisposition | undefined =
      evidenceStatus === "supported" && blockingReasons.length === 0
        ? "confirmed-existing-edge"
        : undefined;

    return createBulkEdgeValidationResult({
      ...result,
      evidenceStatus,
      sourceClaimCoverage,
      confidenceScore,
      recommendedAction: finalDisposition ? "confirm" : "auto-investigate",
      finalDisposition,
      blockingReasons,
    });
  });
};
