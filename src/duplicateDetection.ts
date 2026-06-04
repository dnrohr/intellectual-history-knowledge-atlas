import { Thinker } from "./types";
import { WikidataCandidate } from "./importQueue";

export const normalizeEntityName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const getNameVariants = (name: string) =>
  Array.from(new Set([
    name,
    name.replace(/\([^)]*\)/g, " "),
    ...Array.from(name.matchAll(/\(([^)]*)\)/g)).map((match) => match[1]),
  ].map(normalizeEntityName).filter(Boolean)));

export const yearsAreClose = (left: number | null, right: number | null, tolerance = 2) =>
  left !== null && right !== null && Math.abs(left - right) <= tolerance;

export const findDuplicateCandidateId = (candidate: WikidataCandidate, people: Thinker[]) => {
  const candidateNames = new Set([
    ...getNameVariants(candidate.name),
    ...(candidate.aliases || []).flatMap(getNameVariants),
  ]);
  const candidateSourceUrls = [candidate.sourceUrl, candidate.wikipediaUrl].filter(Boolean) as string[];
  const candidateWorks = new Set((candidate.works || []).map(normalizeEntityName).filter(Boolean));

  return people.find((person) => {
    const personNames = getNameVariants(person.name);
    const nameMatches = personNames.some((name) => candidateNames.has(name));
    if (nameMatches) return true;

    const notes = person.notes || "";
    if (candidateSourceUrls.some((url) => notes.includes(url))) return true;

    const sameBirth = yearsAreClose(candidate.birth, person.birth);
    const sameDeath = yearsAreClose(candidate.death, person.death);
    const sharedWorks = (person.works || []).filter((work) => candidateWorks.has(normalizeEntityName(work))).length;
    return sameBirth && (sameDeath || sharedWorks > 0);
  })?.id || null;
};
