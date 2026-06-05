import { AuthorityIdentifiers } from "./authorityIdentifiers";

export interface PersonMatchProfile {
  id: string;
  name: string;
  alternateNames?: string[];
  birth?: number | null;
  death?: number | null;
  fields?: string[];
  occupations?: string[];
  externalIds?: AuthorityIdentifiers & Record<string, string[] | undefined>;
  works?: string[];
  institutions?: string[];
  movements?: string[];
}

export interface EntityMatchScore {
  score: number;
  reasons: string[];
}

export interface WorkMatchProfile {
  id: string;
  title: string;
  translatedTitles?: string[];
  authorIds?: string[];
  authorNames?: string[];
  date?: number | null;
  identifiers?: {
    doi?: string;
    isbn?: string;
    openalex?: string;
    wikidata?: string;
  };
}

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const textSet = (values: string[] = []) => new Set(values.map(normalizeText).filter(Boolean));

const overlapCount = (a: string[] = [], b: string[] = []) => {
  const bSet = textSet(b);
  return Array.from(textSet(a)).filter((value) => bSet.has(value)).length;
};

const externalIdOverlap = (a?: PersonMatchProfile["externalIds"], b?: PersonMatchProfile["externalIds"]) => {
  if (!a || !b) return 0;
  return Object.keys(a).reduce((count, key) => count + overlapCount(a[key], b[key]), 0);
};

export const scorePersonEntityMatch = (
  candidate: PersonMatchProfile,
  existing: PersonMatchProfile
): EntityMatchScore => {
  let score = 0;
  const reasons: string[] = [];
  const candidateNames = [candidate.name, ...(candidate.alternateNames || [])].map(normalizeText);
  const existingNames = [existing.name, ...(existing.alternateNames || [])].map(normalizeText);

  if (candidateNames.some((name) => existingNames.includes(name))) {
    score += 0.35;
    reasons.push("name");
  }

  if (candidate.birth !== undefined && candidate.birth !== null && existing.birth !== undefined && existing.birth !== null) {
    const distance = Math.abs(candidate.birth - existing.birth);
    if (distance === 0) {
      score += 0.18;
      reasons.push("birth");
    } else if (distance <= 2) {
      score += 0.08;
      reasons.push("near-birth");
    }
  }

  if (candidate.death !== undefined && candidate.death !== null && existing.death !== undefined && existing.death !== null && candidate.death === existing.death) {
    score += 0.08;
    reasons.push("death");
  }

  const externalMatches = externalIdOverlap(candidate.externalIds, existing.externalIds);
  if (externalMatches > 0) {
    score += Math.min(0.3, externalMatches * 0.15);
    reasons.push("external-id");
  }

  const contextChecks: Array<[string, number]> = [
    ["field", overlapCount(candidate.fields, existing.fields)],
    ["occupation", overlapCount(candidate.occupations, existing.occupations)],
    ["work", overlapCount(candidate.works, existing.works)],
    ["institution", overlapCount(candidate.institutions, existing.institutions)],
    ["movement", overlapCount(candidate.movements, existing.movements)],
  ];

  contextChecks.forEach(([reason, count]) => {
    if (count > 0) {
      score += Math.min(0.08, count * 0.04);
      reasons.push(reason);
    }
  });

  return {
    score: Math.min(1, Number(score.toFixed(3))),
    reasons,
  };
};

const normalizeIdentifier = (value?: string) =>
  value?.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();

export const scoreWorkEntityMatch = (
  candidate: WorkMatchProfile,
  existing: WorkMatchProfile
): EntityMatchScore => {
  let score = 0;
  const reasons: string[] = [];
  const stableIdentifierKeys: Array<keyof NonNullable<WorkMatchProfile["identifiers"]>> = ["doi", "isbn", "openalex", "wikidata"];

  stableIdentifierKeys.forEach((key) => {
    const candidateId = normalizeIdentifier(candidate.identifiers?.[key]);
    const existingId = normalizeIdentifier(existing.identifiers?.[key]);
    if (candidateId && existingId && candidateId === existingId) {
      score += key === "doi" ? 0.35 : 0.25;
      reasons.push(key);
    }
  });

  const candidateTitles = [candidate.title, ...(candidate.translatedTitles || [])].map(normalizeText);
  const existingTitles = [existing.title, ...(existing.translatedTitles || [])].map(normalizeText);
  if (candidateTitles.some((title) => existingTitles.includes(title))) {
    score += 0.25;
    reasons.push("title");
  }

  if (overlapCount(candidate.authorIds, existing.authorIds) > 0 || overlapCount(candidate.authorNames, existing.authorNames) > 0) {
    score += 0.15;
    reasons.push("author");
  }

  if (candidate.date !== undefined && candidate.date !== null && existing.date !== undefined && existing.date !== null) {
    const distance = Math.abs(candidate.date - existing.date);
    if (distance === 0) {
      score += 0.1;
      reasons.push("date");
    } else if (distance <= 2) {
      score += 0.04;
      reasons.push("near-date");
    }
  }

  return {
    score: Math.min(1, Number(score.toFixed(3))),
    reasons,
  };
};
