import { InfluenceEdge, SourceClaimEntity } from "./types";

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
