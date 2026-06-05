import { AcceptanceThreshold } from "./evidencePolicy";
import { GraphRepairDiff } from "./graphQuality";
import { SourceAdapterFetchResult } from "./sourceAdapters";
import { InfluenceEdge, SourceClaimEntity, Thinker } from "./types";

export interface CanonicalSeedDataInput {
  people: Thinker[];
  edges: InfluenceEdge[];
}

export interface CanonicalManualOverride {
  id: string;
  targetId: string;
  targetType: "Person" | "Relationship" | "Thread";
  action: "accept" | "reject" | "merge" | "restore" | "annotate";
  reason: string;
}

export interface CanonicalRepairDecision {
  id: string;
  accepted: boolean;
  decidedAt: string;
  diffs: GraphRepairDiff[];
  reason: string;
}

export interface CanonicalDatasetBuildInputs {
  seedData: CanonicalSeedDataInput;
  sourceAdapterOutputs: SourceAdapterFetchResult<unknown>[];
  claimRecords: SourceClaimEntity[];
  acceptancePolicies: Record<string, AcceptanceThreshold>;
  manualOverrides: CanonicalManualOverride[];
  repairDecisions: CanonicalRepairDecision[];
}

export interface CanonicalDatasetOutput {
  version: 1;
  people: Thinker[];
  edges: InfluenceEdge[];
  claims: SourceClaimEntity[];
}

const edgeKey = (edge: InfluenceEdge) =>
  edge.id || `${edge.source}->${edge.target}:${edge.type}`;

const sortPeople = (people: Thinker[]) =>
  [...people].sort((left, right) => left.id.localeCompare(right.id));

const sortEdges = (edges: InfluenceEdge[]) =>
  [...edges].sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));

const sortClaims = (claims: SourceClaimEntity[]) =>
  [...claims].sort((left, right) => left.id.localeCompare(right.id));

const applyAcceptedRepairDecisions = (
  edges: InfluenceEdge[],
  decisions: CanonicalRepairDecision[]
) => {
  const nextEdges = [...edges];
  decisions
    .filter((decision) => decision.accepted)
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((decision) => {
      decision.diffs.forEach((diff) => {
        const index = nextEdges.findIndex((edge) => edgeKey(edge) === edgeKey(diff.edge));
        if (diff.action === "add-edge" && index === -1) {
          nextEdges.push(diff.edge);
        }
        if (diff.action === "update-edge" && index >= 0) {
          nextEdges[index] = { ...nextEdges[index], ...diff.edge };
        }
      });
    });
  return nextEdges;
};

export const createCanonicalDatasetBuildInputs = (
  inputs: CanonicalDatasetBuildInputs
): CanonicalDatasetBuildInputs => ({
  seedData: {
    people: [...inputs.seedData.people],
    edges: [...inputs.seedData.edges],
  },
  sourceAdapterOutputs: [...inputs.sourceAdapterOutputs],
  claimRecords: [...inputs.claimRecords],
  acceptancePolicies: { ...inputs.acceptancePolicies },
  manualOverrides: [...inputs.manualOverrides],
  repairDecisions: [...inputs.repairDecisions],
});

export const buildCanonicalDataset = (inputs: CanonicalDatasetBuildInputs): CanonicalDatasetOutput => ({
  version: 1,
  people: sortPeople(inputs.seedData.people),
  edges: sortEdges(applyAcceptedRepairDecisions(inputs.seedData.edges, inputs.repairDecisions)),
  claims: sortClaims(inputs.claimRecords),
});
