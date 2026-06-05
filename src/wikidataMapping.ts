import { RelationshipEndpointType } from "./types";

export interface WikidataEntityTypeInput {
  description?: string;
  instanceOf?: string[];
  hasBirthDate?: boolean;
}

export const inferWikidataEntityType = ({
  description = "",
  instanceOf = [],
  hasBirthDate = false,
}: WikidataEntityTypeInput): RelationshipEndpointType => {
  const text = [description, ...instanceOf].join(" ").toLowerCase();
  if (hasBirthDate || text.includes("human")) return "Person";
  if (text.includes("book") || text.includes("written work") || text.includes("publication") || text.includes("treatise")) return "Work";
  if (text.includes("university") || text.includes("institute") || text.includes("organization") || text.includes("academy")) return "Institution";
  if (text.includes("movement") || text.includes("school of thought")) return "Movement";
  return "Concept";
};
