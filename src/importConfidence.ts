import { WikidataCandidate } from "./importQueue";
import { normalizeEntityName } from "./duplicateDetection";

export const scoreCandidateConfidence = (query: string, candidate: WikidataCandidate | null) => {
  if (!candidate) return 0;
  let score = 0;
  if (normalizeEntityName(query) === normalizeEntityName(candidate.name)) score += 55;
  if (candidate.birth !== null) score += 15;
  if (candidate.description) score += 10;
  if ((candidate.fields || []).length > 0) score += 8;
  if ((candidate.topics || []).length > 0) score += 6;
  if (candidate.wikipediaUrl) score += 6;
  return Math.min(100, score);
};
