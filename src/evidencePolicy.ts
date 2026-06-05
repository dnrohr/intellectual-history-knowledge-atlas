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
