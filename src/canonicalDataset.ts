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
