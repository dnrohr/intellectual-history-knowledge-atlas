import { SourceClaimEntity, SourceObservation } from "./types";

export interface StaleSourceWarning {
  id: string;
  kind: "claim" | "observation";
  message: string;
}

const hasUsableUrl = (value: unknown) => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const getStaleSourceWarnings = (
  claims: SourceClaimEntity[],
  observations: SourceObservation[] = []
): StaleSourceWarning[] => [
  ...claims
    .filter((claim) => !hasUsableUrl(claim.sourceUrl))
    .map((claim) => ({
      id: claim.id,
      kind: "claim" as const,
      message: `Source claim ${claim.id} has no usable source URL.`,
    })),
  ...observations
    .filter((observation) => !hasUsableUrl(observation.sourceUrl))
    .map((observation) => ({
      id: observation.id,
      kind: "observation" as const,
      message: `Source observation ${observation.id} has no usable source URL.`,
    })),
];
