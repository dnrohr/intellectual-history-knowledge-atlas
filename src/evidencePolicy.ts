export interface EvidenceConfidenceComponents {
  identity: number;
  factual: number;
  relationship: number;
  sourceQuality: number;
  extraction: number;
  graphConsistency: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const normalizeEvidenceConfidence = (
  components: Partial<EvidenceConfidenceComponents>
): EvidenceConfidenceComponents => ({
  identity: clamp01(components.identity ?? 0.5),
  factual: clamp01(components.factual ?? 0.5),
  relationship: clamp01(components.relationship ?? 0.5),
  sourceQuality: clamp01(components.sourceQuality ?? 0.5),
  extraction: clamp01(components.extraction ?? 0.5),
  graphConsistency: clamp01(components.graphConsistency ?? 0.5),
});

export const composeEvidenceConfidence = (
  components: Partial<EvidenceConfidenceComponents>
) => {
  const normalized = normalizeEvidenceConfidence(components);
  return Number((
    normalized.identity * 0.2 +
    normalized.factual * 0.2 +
    normalized.relationship * 0.2 +
    normalized.sourceQuality * 0.15 +
    normalized.extraction * 0.1 +
    normalized.graphConsistency * 0.15
  ).toFixed(3));
};

export type AcceptanceClaimType =
  | "identity"
  | "basic_metadata"
  | "external_id"
  | "work_metadata"
  | "institution_affiliation"
  | "direct_influence"
  | "relationship";

export interface AcceptanceThreshold {
  accept: number;
  provisional: number;
}

export const ACCEPTANCE_THRESHOLDS_BY_CLAIM_TYPE: Record<AcceptanceClaimType, AcceptanceThreshold> = {
  identity: { accept: 0.9, provisional: 0.7 },
  basic_metadata: { accept: 0.75, provisional: 0.55 },
  external_id: { accept: 0.7, provisional: 0.5 },
  work_metadata: { accept: 0.75, provisional: 0.55 },
  institution_affiliation: { accept: 0.8, provisional: 0.6 },
  direct_influence: { accept: 0.92, provisional: 0.75 },
  relationship: { accept: 0.85, provisional: 0.65 },
};

export const getAcceptanceThreshold = (claimType: AcceptanceClaimType) =>
  ACCEPTANCE_THRESHOLDS_BY_CLAIM_TYPE[claimType];

export interface StrictAcceptanceContext {
  directInfluence?: boolean;
  canonicalThreadEdge?: boolean;
  crossCenturyJump?: boolean;
  highBridgeScoreNode?: boolean;
  disputedOrSparseTopic?: boolean;
}

export const applyStrictAcceptanceModifiers = (
  threshold: AcceptanceThreshold,
  context: StrictAcceptanceContext
): AcceptanceThreshold => {
  const increments = [
    context.directInfluence ? 0.05 : 0,
    context.canonicalThreadEdge ? 0.04 : 0,
    context.crossCenturyJump ? 0.04 : 0,
    context.highBridgeScoreNode ? 0.03 : 0,
    context.disputedOrSparseTopic ? 0.04 : 0,
  ];
  const total = increments.reduce((sum, value) => sum + value, 0);
  return {
    accept: Math.min(0.99, Number((threshold.accept + total).toFixed(3))),
    provisional: Math.min(0.95, Number((threshold.provisional + total / 2).toFixed(3))),
  };
};

export interface LooseAcceptanceContext {
  basicMetadata?: boolean;
  stableExternalId?: boolean;
  workStableIdentifier?: boolean;
  directInstitutionSource?: boolean;
}

export const applyLooseAcceptanceModifiers = (
  threshold: AcceptanceThreshold,
  context: LooseAcceptanceContext
): AcceptanceThreshold => {
  const reductions = [
    context.basicMetadata ? 0.04 : 0,
    context.stableExternalId ? 0.06 : 0,
    context.workStableIdentifier ? 0.05 : 0,
    context.directInstitutionSource ? 0.04 : 0,
  ];
  const total = reductions.reduce((sum, value) => sum + value, 0);
  return {
    accept: Math.max(0.5, Number((threshold.accept - total).toFixed(3))),
    provisional: Math.max(0.35, Number((threshold.provisional - total / 2).toFixed(3))),
  };
};

export interface AutomaticRejectionInput {
  sourceId: string;
  targetId: string;
  relationshipType: string;
  sourceBirth?: number | null;
  targetBirth?: number | null;
  existingOppositeDirection?: boolean;
  evidence: string[];
}

export const getAutomaticRejectionReasons = ({
  sourceId,
  targetId,
  relationshipType,
  sourceBirth,
  targetBirth,
  existingOppositeDirection = false,
  evidence,
}: AutomaticRejectionInput) => {
  const reasons: string[] = [];
  const evidenceText = evidence.join(" ").toLowerCase();
  if (sourceId === targetId) reasons.push("self-link");
  if (sourceBirth !== undefined && sourceBirth !== null && targetBirth !== undefined && targetBirth !== null && sourceBirth > targetBirth + 20) {
    reasons.push("impossible-chronology");
  }
  if (existingOppositeDirection) reasons.push("duplicate-opposite-direction");
  if (
    relationshipType === "person influenced person" &&
    evidence.length > 0 &&
    evidence.every((item) => item.toLowerCase().includes("shared")) &&
    !evidenceText.includes("explicit") &&
    !evidenceText.includes("citation") &&
    !evidenceText.includes("reception")
  ) {
    reasons.push("unsupported-direct-influence-from-shared-tags");
  }
  return reasons;
};
