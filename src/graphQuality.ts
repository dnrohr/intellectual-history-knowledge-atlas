import { CanonicalThread, InfluenceEdge, SourceClaimEntity, Thinker } from "./types";
import { getSourceClaimRecencyDays } from "./knowledgeModel";

export interface GraphQualityMetrics {
  sourcedEdgePercentage: number;
  acceptedEdgePercentage: number;
  averageEdgeConfidence: number;
  isolatedNodeCount: number;
  duplicateRiskCount: number;
  averageSourceFreshnessDays: number | null;
  canonicalThreadCoverage: number;
}

const percent = (count: number, total: number) =>
  total === 0 ? 0 : Number((count / total).toFixed(3));

const normalizedName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const computeGraphQualityMetrics = (
  people: Thinker[],
  edges: InfluenceEdge[],
  claims: SourceClaimEntity[] = [],
  threads: CanonicalThread[] = [],
  now: Date = new Date()
): GraphQualityMetrics => {
  const connectedIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const sourcedEdges = edges.filter((edge) => (edge.sourceClaims || edge.claimIds || []).length > 0);
  const acceptedEdges = edges.filter((edge) => edge.status === "accepted");
  const confidenceValues = edges.map((edge) => edge.confidence ?? 0.5);
  const nameCounts = people.reduce<Record<string, number>>((acc, person) => {
    const key = normalizedName(person.name);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const freshnessValues = claims
    .map((claim) => getSourceClaimRecencyDays(claim, now))
    .filter((value): value is number => value !== null);
  const threadPeople = new Set(threads.flatMap((thread) => thread.people));

  return {
    sourcedEdgePercentage: percent(sourcedEdges.length, edges.length),
    acceptedEdgePercentage: percent(acceptedEdges.length, edges.length),
    averageEdgeConfidence: confidenceValues.length === 0
      ? 0
      : Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3)),
    isolatedNodeCount: people.filter((person) => !connectedIds.has(person.id)).length,
    duplicateRiskCount: Object.values(nameCounts).filter((count) => count > 1).reduce((sum, count) => sum + count, 0),
    averageSourceFreshnessDays: freshnessValues.length === 0
      ? null
      : Number((freshnessValues.reduce((sum, value) => sum + value, 0) / freshnessValues.length).toFixed(1)),
    canonicalThreadCoverage: percent(threadPeople.size, people.length),
  };
};
