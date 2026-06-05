import { CanonicalThread, InfluenceEdge, KnownRelationshipType, SourceClaimEntity, Thinker } from "./types";
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

export interface BulkEdgeValidationReport {
  confirmedExistingEdges: BulkEdgeValidationResult[];
  addedConfirmedEdges: BulkEdgeValidationResult[];
  removedExistingEdges: BulkEdgeValidationResult[];
  discardedCandidates: BulkEdgeValidationResult[];
  autoInvestigatingMissingSources: BulkEdgeValidationResult[];
  autoResolvingConflicts: BulkEdgeValidationResult[];
  summary: {
    confirmedExistingEdges: number;
    addedConfirmedEdges: number;
    removedExistingEdges: number;
    discardedCandidates: number;
    autoInvestigatingMissingSources: number;
    autoResolvingConflicts: number;
    total: number;
  };
}

export type BulkEdgeRepairDecisionAction =
  | "add-edge"
  | "remove-edge"
  | "discard-candidate"
  | "auto-investigate-source"
  | "auto-resolve-conflict";

export interface BulkEdgeRepairDecision {
  id: string;
  dryRun: true;
  action: BulkEdgeRepairDecisionAction;
  resultId: string;
  edgeId: string;
  reason: string;
  edge?: InfluenceEdge;
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

const claimEvidenceText = (claim: SourceClaimEntity) =>
  [claim.field, claim.value, claim.sourceName].filter(Boolean).join(" ");

const edgeEvidenceText = (edge: InfluenceEdge, claimsById: Map<string, SourceClaimEntity>) =>
  [
    edge.note || "",
    ...(edge.sourceClaims || []),
    ...(edge.claimIds || []).map((claimId) => {
      const claim = claimsById.get(claimId);
      return claim ? claimEvidenceText(claim) : "";
    }),
  ].join(" ").toLowerCase();

const relationshipRuleReasons = (
  edge: InfluenceEdge,
  claimsById: Map<string, SourceClaimEntity>
) => {
  const type = String(edge.type);
  const text = edgeEvidenceText(edge, claimsById);
  const reasons: string[] = [];

  if ((type === "Influence" || type === "person influenced person") &&
    !/(explicit|influence|influenced|citation|reception|named mention|mentor|advisor|student)/.test(text)) {
    reasons.push("direct-influence-needs-transmission-evidence");
  }
  if (type === "Indirect influence" && !/(indirect|precursor|reception|transmission|revived|anticipated|citation|influence)/.test(text)) {
    reasons.push("indirect-influence-needs-mediated-evidence");
  }
  if ((type === "Mentorship" || type === "person mentored person") && !/(mentor|mentored|advisor|student|supervisor|tutor)/.test(text)) {
    reasons.push("mentorship-needs-advisor-student-evidence");
  }
  if ((type === "Collaboration" || type === "person collaborated with person") && !/(collaborat|coauthor|co-author|correspondence|jointly|worked with)/.test(text)) {
    reasons.push("collaboration-needs-shared-work-evidence");
  }
  if (type === "Source-context neighbor" && !/(source-context|source proximity|context|same source|neighbor|co-mentioned)/.test(text)) {
    reasons.push("source-context-neighbor-needs-proximity-evidence");
  }
  if ((type === "Parallel" || type === "Parallel development") && !/(parallel|independent|shared concept|concurrent|rival school)/.test(text)) {
    reasons.push("parallel-development-needs-non-transmission-evidence");
  }
  if ((edge.threadIds || []).length > 0 && ((edge.confidence ?? 0.5) < 0.85 || (edge.claimIds || edge.sourceClaims || []).length === 0)) {
    reasons.push("canonical-thread-edge-needs-high-confidence-source-support");
  }

  return reasons;
};

const candidateKey = (source: string, target: string, type: string) =>
  `${source}->${target}:${type}`;

const canonicalCandidateKey = (source: string, target: string, type: string) =>
  NON_DIRECTIONAL_RELATIONSHIP_TYPES.has(type)
    ? `${[source, target].sort().join("<->")}:${type}`
    : candidateKey(source, target, type);

const existingEdgeKeys = (edges: InfluenceEdge[]) =>
  new Set(edges.map((edge) => canonicalCandidateKey(edge.source, edge.target, String(edge.type))));

const addMissingCandidate = (
  candidates: Map<string, InfluenceEdge>,
  existingKeys: Set<string>,
  edge: InfluenceEdge
) => {
  const key = canonicalCandidateKey(edge.source, edge.target, String(edge.type));
  if (existingKeys.has(key)) return;
  const existing = candidates.get(key);
  if (!existing) {
    candidates.set(key, edge);
    return;
  }
    candidates.set(key, {
      ...existing,
      confidence: Number(Math.min(0.98, Math.max(existing.confidence ?? 0.5, edge.confidence ?? 0.5) + 0.03).toFixed(3)),
    claimIds: Array.from(new Set([...(existing.claimIds || []), ...(edge.claimIds || [])])),
    sourceClaims: Array.from(new Set([...(existing.sourceClaims || []), ...(edge.sourceClaims || [])])),
    note: Array.from(new Set([existing.note, edge.note].filter(Boolean))).join("; "),
  });
};

export const deduplicateMissingEdgeCandidates = (
  candidates: InfluenceEdge[],
  existingEdges: InfluenceEdge[] = []
): InfluenceEdge[] => {
  const existingKeys = existingEdgeKeys(existingEdges);
  const deduped = new Map<string, InfluenceEdge>();
  candidates.forEach((candidate) => {
    const key = canonicalCandidateKey(candidate.source, candidate.target, String(candidate.type));
    if (existingKeys.has(key)) return;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      return;
    }
    deduped.set(key, {
      ...existing,
      confidence: Number(Math.min(0.98, Math.max(existing.confidence ?? 0.5, candidate.confidence ?? 0.5) + 0.03).toFixed(3)),
      claimIds: Array.from(new Set([...(existing.claimIds || []), ...(candidate.claimIds || [])])),
      sourceClaims: Array.from(new Set([...(existing.sourceClaims || []), ...(candidate.sourceClaims || [])])),
      threadIds: Array.from(new Set([...(existing.threadIds || []), ...(candidate.threadIds || [])])),
      note: Array.from(new Set([existing.note, candidate.note].filter(Boolean))).join("; "),
    });
  });

  return Array.from(deduped.values()).sort((left, right) =>
    canonicalCandidateKey(left.source, left.target, String(left.type)).localeCompare(
      canonicalCandidateKey(right.source, right.target, String(right.type))
    )
  );
};

const candidateFromClaim = (claim: SourceClaimEntity): InfluenceEdge | null => {
  if (claim.subjectEntityType !== "Relationship" || ["rejected", "stale", "conflicting"].includes(claim.status)) return null;
  const relationshipMatch = claim.subjectEntityId.match(/^relationship:person:([^:]+):(.+):person:([^:]+)$/);
  if (relationshipMatch) {
    return {
      id: `candidate:${claim.id}`,
      source: relationshipMatch[1],
      target: relationshipMatch[3],
      type: relationshipMatch[2],
      strength: Math.max(1, Math.round(claim.confidence * 5)),
      confidence: claim.confidence,
      status: "suggested",
      claimIds: [claim.id],
      sourceClaims: claim.sourceUrl ? [claim.sourceUrl] : [],
      note: `Relationship claim from ${claim.sourceName}: ${claim.value}`,
    };
  }

  const value = claim.value.toLowerCase();
  const parts = claim.value.split(/->|=>| influenced | mentored | collaborated with /i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const relationshipType = value.includes("mentor")
    ? "Mentorship"
    : value.includes("collaborat") || value.includes("coauthor")
      ? "Collaboration"
      : "Influence";
  return {
    id: `candidate:${claim.id}`,
    source: parts[0],
    target: parts[1],
    type: relationshipType,
    strength: Math.max(1, Math.round(claim.confidence * 5)),
    confidence: claim.confidence,
    status: "suggested",
    claimIds: [claim.id],
    sourceClaims: claim.sourceUrl ? [claim.sourceUrl] : [],
    note: `Relationship claim from ${claim.sourceName}: ${claim.value}`,
  };
};

export const generateMissingEdgeCandidates = (
  people: Thinker[],
  edges: InfluenceEdge[],
  claims: SourceClaimEntity[] = [],
  threads: CanonicalThread[] = []
): InfluenceEdge[] => {
  const candidates = new Map<string, InfluenceEdge>();
  const existingKeys = existingEdgeKeys(edges);
  const peopleById = new Map(people.map((person) => [person.id, person]));

  people.forEach((person) => {
    (person.influenced || []).forEach((targetId) => {
      if (!peopleById.has(targetId)) return;
      addMissingCandidate(candidates, existingKeys, {
        id: `candidate:metadata:${person.id}:influence:${targetId}`,
        source: person.id,
        target: targetId,
        type: "Influence",
        strength: 3,
        confidence: 0.68,
        status: "suggested",
        note: "Metadata explicit influence signal.",
      });
    });
  });

  claims.forEach((claim) => {
    const fromClaim = candidateFromClaim(claim);
    if (fromClaim) {
      addMissingCandidate(candidates, existingKeys, fromClaim);
    }
    if (claim.subjectEntityType !== "Person" || ["rejected", "stale", "conflicting"].includes(claim.status)) return;
    const subjectId = claim.subjectEntityId.replace(/^person:/, "");
    const targetId = claim.value.replace(/^person:/, "");
    if (!peopleById.has(subjectId) || !peopleById.has(targetId) || subjectId === targetId) return;
    if (/advisor|mentor|student/i.test(claim.field)) {
      const source = /advisor|mentor/i.test(claim.field) ? targetId : subjectId;
      const target = source === targetId ? subjectId : targetId;
      addMissingCandidate(candidates, existingKeys, {
        id: `candidate:${claim.id}`,
        source,
        target,
        type: "Mentorship",
        strength: Math.max(1, Math.round(claim.confidence * 5)),
        confidence: claim.confidence,
        status: "suggested",
        claimIds: [claim.id],
        sourceClaims: claim.sourceUrl ? [claim.sourceUrl] : [],
        note: `Advisor/student lineage claim from ${claim.sourceName}.`,
      });
    }
    if (/coauthor|correspondent|collabor/i.test(claim.field)) {
      addMissingCandidate(candidates, existingKeys, {
        id: `candidate:${claim.id}`,
        source: subjectId,
        target: targetId,
        type: "Collaboration",
        strength: Math.max(1, Math.round(claim.confidence * 5)),
        confidence: claim.confidence,
        status: "suggested",
        claimIds: [claim.id],
        sourceClaims: claim.sourceUrl ? [claim.sourceUrl] : [],
        note: `Collaboration claim from ${claim.sourceName}.`,
      });
    }
  });

  people.forEach((person, index) => {
    people.slice(index + 1).forEach((other) => {
      const sharedMovement = person.movement && person.movement === other.movement ? person.movement : null;
      const sharedRegion = person.region && person.region === other.region ? person.region : null;
      if (!sharedMovement && !sharedRegion) return;
      const source = person.birth <= other.birth ? person : other;
      const target = source.id === person.id ? other : person;
      if (target.birth - source.birth > 125) return;
      addMissingCandidate(candidates, existingKeys, {
        id: `candidate:context:${source.id}:${target.id}`,
        source: source.id,
        target: target.id,
        type: "Source-context neighbor",
        strength: 2,
        confidence: 0.42,
        status: "suggested",
        note: `Chronology-constrained shared ${sharedMovement ? `movement: ${sharedMovement}` : `region: ${sharedRegion}`}.`,
      });
    });
  });

  threads.forEach((thread) => {
    thread.people.slice(0, -1).forEach((sourceId, index) => {
      const targetId = thread.people[index + 1];
      if (!peopleById.has(sourceId) || !peopleById.has(targetId)) return;
      addMissingCandidate(candidates, existingKeys, {
        id: `candidate:thread:${thread.id}:${sourceId}:${targetId}`,
        source: sourceId,
        target: targetId,
        type: thread.edgeTypes[0] || "Source-context neighbor",
        strength: 3,
        confidence: thread.confidence === "high" ? 0.82 : 0.64,
        status: "suggested",
        threadIds: [thread.id],
        note: `Canonical thread gap candidate: ${thread.title}.`,
      });
    });
  });

  return deduplicateMissingEdgeCandidates(Array.from(candidates.values()), edges);
};

export const validateBulkEdgeRelationshipRules = (
  people: Thinker[],
  edges: InfluenceEdge[],
  claims: SourceClaimEntity[] = [],
  now: Date = new Date()
): BulkEdgeValidationResult[] => {
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  return validateBulkEdgeEvidence(people, edges, claims, now).map((result) => {
    const edge = result.subject.edge;
    if (!edge || result.structuralStatus === "invalid") return result;
    const reasons = relationshipRuleReasons(edge, claimsById);
    if (reasons.length === 0) return result;
    return createBulkEdgeValidationResult({
      ...result,
      evidenceStatus: result.evidenceStatus === "conflicting" ? "conflicting" : "weak",
      recommendedAction: "auto-investigate",
      finalDisposition: undefined,
      blockingReasons: [...result.blockingReasons, ...reasons],
    });
  });
};

export const validateDiscoveredEdgeCandidates = (
  people: Thinker[],
  candidates: InfluenceEdge[],
  claims: SourceClaimEntity[] = [],
  now: Date = new Date()
): BulkEdgeValidationResult[] =>
  validateBulkEdgeRelationshipRules(people, candidates, claims, now).map((result) => {
    const finalDisposition: BulkEdgeFinalDisposition | undefined =
      result.finalDisposition === "confirmed-existing-edge"
        ? "added-confirmed-edge"
        : result.finalDisposition === "removed-existing-edge"
          ? "discarded-candidate"
          : undefined;
    const recommendedAction: BulkEdgeRecommendedAction =
      finalDisposition === "added-confirmed-edge"
        ? "add"
        : finalDisposition === "discarded-candidate"
          ? "discard"
          : result.recommendedAction;
    return createBulkEdgeValidationResult({
      ...result,
      id: result.id.replace("validation:structure:", "validation:candidate:"),
      origin: "discovered-candidate",
      recommendedAction,
      finalDisposition,
    });
  });

export const addConfirmedMissingEdgesToCanonicalGraph = (
  edges: InfluenceEdge[],
  candidateResults: BulkEdgeValidationResult[]
): InfluenceEdge[] => {
  const existingKeys = existingEdgeKeys(edges);
  const additions = candidateResults
    .filter((result) => result.origin === "discovered-candidate" && result.finalDisposition === "added-confirmed-edge")
    .map((result) => result.subject.edge)
    .filter((edge): edge is InfluenceEdge => Boolean(edge))
    .filter((edge) => !existingKeys.has(canonicalCandidateKey(edge.source, edge.target, String(edge.type))))
    .map((edge) => ({
      ...edge,
      id: edge.id?.replace(/^candidate:/, "edge:"),
      status: "accepted" as const,
      confidence: edge.confidence ?? 0.85,
      note: [edge.note, "Added by bulk edge validation."].filter(Boolean).join(" "),
    }));

  return [...edges, ...additions].sort((left, right) =>
    canonicalCandidateKey(left.source, left.target, String(left.type)).localeCompare(
      canonicalCandidateKey(right.source, right.target, String(right.type))
    )
  );
};

export const buildBulkEdgeValidationReport = (
  results: BulkEdgeValidationResult[]
): BulkEdgeValidationReport => {
  const confirmedExistingEdges = results.filter((result) => result.finalDisposition === "confirmed-existing-edge");
  const addedConfirmedEdges = results.filter((result) => result.finalDisposition === "added-confirmed-edge");
  const removedExistingEdges = results.filter((result) => result.finalDisposition === "removed-existing-edge");
  const discardedCandidates = results.filter((result) => result.finalDisposition === "discarded-candidate");
  const autoResolvingConflicts = results.filter((result) =>
    !result.finalDisposition &&
    (result.evidenceStatus === "conflicting" || result.blockingReasons.some((reason) => reason.includes("conflict")))
  );
  const autoInvestigatingMissingSources = results.filter((result) =>
    !result.finalDisposition &&
    !autoResolvingConflicts.includes(result) &&
    result.recommendedAction === "auto-investigate"
  );

  return {
    confirmedExistingEdges,
    addedConfirmedEdges,
    removedExistingEdges,
    discardedCandidates,
    autoInvestigatingMissingSources,
    autoResolvingConflicts,
    summary: {
      confirmedExistingEdges: confirmedExistingEdges.length,
      addedConfirmedEdges: addedConfirmedEdges.length,
      removedExistingEdges: removedExistingEdges.length,
      discardedCandidates: discardedCandidates.length,
      autoInvestigatingMissingSources: autoInvestigatingMissingSources.length,
      autoResolvingConflicts: autoResolvingConflicts.length,
      total: results.length,
    },
  };
};

export const createBulkEdgeRepairDecisions = (
  report: BulkEdgeValidationReport
): BulkEdgeRepairDecision[] => {
  const decisions: BulkEdgeRepairDecision[] = [];
  report.addedConfirmedEdges.forEach((result) => {
    decisions.push({
      id: `repair:add:${result.subject.id}`,
      dryRun: true,
      action: "add-edge",
      resultId: result.id,
      edgeId: result.subject.id,
      reason: "Add automatically confirmed missing edge.",
      edge: result.subject.edge,
    });
  });
  report.removedExistingEdges.forEach((result) => {
    decisions.push({
      id: `repair:remove:${result.subject.id}`,
      dryRun: true,
      action: "remove-edge",
      resultId: result.id,
      edgeId: result.subject.id,
      reason: result.blockingReasons.join("; ") || "Remove invalid or unsupported existing edge.",
      edge: result.subject.edge,
    });
  });
  report.discardedCandidates.forEach((result) => {
    decisions.push({
      id: `repair:discard:${result.subject.id}`,
      dryRun: true,
      action: "discard-candidate",
      resultId: result.id,
      edgeId: result.subject.id,
      reason: result.blockingReasons.join("; ") || "Discard invalid discovered candidate.",
      edge: result.subject.edge,
    });
  });
  report.autoInvestigatingMissingSources.forEach((result) => {
    decisions.push({
      id: `repair:investigate:${result.subject.id}`,
      dryRun: true,
      action: "auto-investigate-source",
      resultId: result.id,
      edgeId: result.subject.id,
      reason: result.blockingReasons.join("; ") || "Acquire stronger source evidence before final disposition.",
      edge: result.subject.edge,
    });
  });
  report.autoResolvingConflicts.forEach((result) => {
    decisions.push({
      id: `repair:conflict:${result.subject.id}`,
      dryRun: true,
      action: "auto-resolve-conflict",
      resultId: result.id,
      edgeId: result.subject.id,
      reason: result.blockingReasons.join("; ") || "Resolve conflicting evidence before final disposition.",
      edge: result.subject.edge,
    });
  });
  return decisions;
};
