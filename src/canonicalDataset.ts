import { AcceptanceThreshold } from "./evidencePolicy";
import { GraphRepairDiff } from "./graphQuality";
import { SourceAdapterFetchResult } from "./sourceAdapters";
import { InfluenceEdge, SourceClaimEntity, SourceClaimStatus, Thinker } from "./types";

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
  metadata: CanonicalDatasetMetadata;
  people: Thinker[];
  edges: InfluenceEdge[];
  claims: SourceClaimEntity[];
}

export interface CanonicalDatasetMetadata {
  datasetVersion: "canonical-v1";
  generator: "buildCanonicalDataset";
  inputCounts: {
    people: number;
    edges: number;
    claims: number;
    sourceAdapterOutputs: number;
    manualOverrides: number;
    repairDecisions: number;
  };
  contentFingerprint: string;
}

export type CanonicalClaimChangelogEntryType =
  | "added"
  | "changed"
  | "demoted"
  | "rejected"
  | "conflicting";

export interface CanonicalClaimChangelogEntry {
  type: CanonicalClaimChangelogEntryType;
  claimId: string;
  subjectEntityId: string;
  subjectEntityType: SourceClaimEntity["subjectEntityType"];
  field: string;
  previousStatus?: SourceClaimStatus;
  currentStatus: SourceClaimStatus;
}

export interface CanonicalClaimChangelog {
  added: CanonicalClaimChangelogEntry[];
  changed: CanonicalClaimChangelogEntry[];
  demoted: CanonicalClaimChangelogEntry[];
  rejected: CanonicalClaimChangelogEntry[];
  conflicting: CanonicalClaimChangelogEntry[];
}

const edgeKey = (edge: InfluenceEdge) =>
  edge.id || `${edge.source}->${edge.target}:${edge.type}`;

const sortPeople = (people: Thinker[]) =>
  [...people].sort((left, right) => left.id.localeCompare(right.id));

const sortEdges = (edges: InfluenceEdge[]) =>
  [...edges].sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));

const sortClaims = (claims: SourceClaimEntity[]) =>
  [...claims].sort((left, right) => left.id.localeCompare(right.id));

const stableFingerprint = (value: unknown) => {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const statusRank: Record<SourceClaimStatus, number> = {
  accepted: 5,
  candidate: 4,
  observed: 3,
  stale: 2,
  conflicting: 1,
  rejected: 0,
};

const claimComparisonShape = (claim: SourceClaimEntity) => ({
  sourceName: claim.sourceName,
  sourceUrl: claim.sourceUrl,
  sourceType: claim.sourceType,
  sourceReliability: claim.sourceReliability,
  extractionMethod: claim.extractionMethod,
  subjectEntityId: claim.subjectEntityId,
  subjectEntityType: claim.subjectEntityType,
  field: claim.field,
  value: claim.value,
  confidence: claim.confidence,
  status: claim.status,
});

const createClaimChangelogEntry = (
  type: CanonicalClaimChangelogEntryType,
  current: SourceClaimEntity,
  previous?: SourceClaimEntity
): CanonicalClaimChangelogEntry => ({
  type,
  claimId: current.id,
  subjectEntityId: current.subjectEntityId,
  subjectEntityType: current.subjectEntityType,
  field: current.field,
  previousStatus: previous?.status,
  currentStatus: current.status,
});

const emptyClaimChangelog = (): CanonicalClaimChangelog => ({
  added: [],
  changed: [],
  demoted: [],
  rejected: [],
  conflicting: [],
});

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

export const generateCanonicalClaimChangelog = (
  previousClaims: SourceClaimEntity[],
  currentClaims: SourceClaimEntity[]
): CanonicalClaimChangelog => {
  const changelog = emptyClaimChangelog();
  const previousById = new Map(previousClaims.map((claim) => [claim.id, claim]));

  sortClaims(currentClaims).forEach((current) => {
    const previous = previousById.get(current.id);
    if (!previous) {
      changelog.added.push(createClaimChangelogEntry("added", current));
      return;
    }

    if (current.status === "conflicting" && previous.status !== "conflicting") {
      changelog.conflicting.push(createClaimChangelogEntry("conflicting", current, previous));
      return;
    }

    if (current.status === "rejected" && previous.status !== "rejected") {
      changelog.rejected.push(createClaimChangelogEntry("rejected", current, previous));
      return;
    }

    if (statusRank[current.status] < statusRank[previous.status]) {
      changelog.demoted.push(createClaimChangelogEntry("demoted", current, previous));
      return;
    }

    if (stableFingerprint(claimComparisonShape(current)) !== stableFingerprint(claimComparisonShape(previous))) {
      changelog.changed.push(createClaimChangelogEntry("changed", current, previous));
    }
  });

  return changelog;
};

export const buildCanonicalDataset = (inputs: CanonicalDatasetBuildInputs): CanonicalDatasetOutput => {
  const people = sortPeople(inputs.seedData.people);
  const edges = sortEdges(applyAcceptedRepairDecisions(inputs.seedData.edges, inputs.repairDecisions));
  const claims = sortClaims(inputs.claimRecords);
  return {
    version: 1,
    metadata: {
      datasetVersion: "canonical-v1",
      generator: "buildCanonicalDataset",
      inputCounts: {
        people: inputs.seedData.people.length,
        edges: inputs.seedData.edges.length,
        claims: inputs.claimRecords.length,
        sourceAdapterOutputs: inputs.sourceAdapterOutputs.length,
        manualOverrides: inputs.manualOverrides.length,
        repairDecisions: inputs.repairDecisions.length,
      },
      contentFingerprint: stableFingerprint({ people, edges, claims }),
    },
    people,
    edges,
    claims,
  };
};
