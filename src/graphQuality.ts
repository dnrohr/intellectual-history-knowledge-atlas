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

export interface GraphQualityAuditFinding {
  code:
    | "isolated-node"
    | "sparse-high-bridge-node"
    | "unsupported-edge"
    | "stale-source-claim"
    | "duplicate-entity-risk"
    | "dangling-reference"
    | "impossible-dates"
    | "missing-works"
    | "missing-institutions"
    | "over-broad-tag";
  severity: "info" | "warning" | "critical";
  targetId: string;
  message: string;
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

export const auditGraphQuality = (
  people: Thinker[],
  edges: InfluenceEdge[],
  claims: SourceClaimEntity[] = [],
  now: Date = new Date()
): GraphQualityAuditFinding[] => {
  const findings: GraphQualityAuditFinding[] = [];
  const peopleIds = new Set(people.map((person) => person.id));
  const edgeCounts = new Map<string, number>();
  edges.forEach((edge) => {
    edgeCounts.set(edge.source, (edgeCounts.get(edge.source) || 0) + 1);
    edgeCounts.set(edge.target, (edgeCounts.get(edge.target) || 0) + 1);
    if (!peopleIds.has(edge.source) || !peopleIds.has(edge.target)) {
      findings.push({
        code: "dangling-reference",
        severity: "critical",
        targetId: `${edge.source}->${edge.target}`,
        message: "Edge references a missing person.",
      });
    }
    if ((edge.sourceClaims || edge.claimIds || []).length === 0) {
      findings.push({
        code: "unsupported-edge",
        severity: "warning",
        targetId: `${edge.source}->${edge.target}`,
        message: "Edge has no source claims.",
      });
    }
  });

  const normalizedNames = new Map<string, string[]>();
  people.forEach((person) => {
    const key = normalizedName(person.name);
    normalizedNames.set(key, [...(normalizedNames.get(key) || []), person.id]);
    if ((edgeCounts.get(person.id) || 0) === 0) {
      findings.push({ code: "isolated-node", severity: "warning", targetId: person.id, message: "Person has no graph edges." });
    }
    if ((person.bridge_score || 0) >= 4 && (edgeCounts.get(person.id) || 0) <= 1) {
      findings.push({ code: "sparse-high-bridge-node", severity: "warning", targetId: person.id, message: "High bridge-score person has sparse connectivity." });
    }
    if (person.death !== null && person.death < person.birth) {
      findings.push({ code: "impossible-dates", severity: "critical", targetId: person.id, message: "Death year is earlier than birth year." });
    }
    if (!person.works || person.works.length === 0) {
      findings.push({ code: "missing-works", severity: "info", targetId: person.id, message: "Person has no works listed." });
    }
    if (!person.region && !person.movement) {
      findings.push({ code: "missing-institutions", severity: "info", targetId: person.id, message: "Person has no institution or movement context." });
    }
    if ((person.fields || []).some((field) => ["Other", "Unclassified", "Philosophy"].includes(field)) && (!person.subfields || person.subfields.length === 0)) {
      findings.push({ code: "over-broad-tag", severity: "info", targetId: person.id, message: "Person has broad tags without narrower topics." });
    }
  });

  normalizedNames.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => findings.push({ code: "duplicate-entity-risk", severity: "warning", targetId: id, message: "Entity has a duplicate name risk." }));
    }
  });

  claims.forEach((claim) => {
    const recency = getSourceClaimRecencyDays(claim, now);
    if (claim.status === "stale" || (recency !== null && recency > 3650)) {
      findings.push({ code: "stale-source-claim", severity: "warning", targetId: claim.id, message: "Source claim is stale." });
    }
  });

  return findings;
};
