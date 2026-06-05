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
