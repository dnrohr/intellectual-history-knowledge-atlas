import { describe, expect, it } from "vitest";
import {
  buildDisciplineGroups,
  buildSubfieldsByField,
  buildTopicGroupsByField,
} from "./taxonomy";
import { Thinker } from "./types";

const thinker = (overrides: Partial<Thinker>): Thinker => ({
  id: "person",
  name: "Person",
  birth: 0,
  death: null,
  fields: ["Philosophy"],
  ...overrides,
});

describe("taxonomy grouping helpers", () => {
  it("groups known fields by taxonomy domain and preserves unknown fields", () => {
    const groups = buildDisciplineGroups(["Mathematics", "Philosophy", "Alchemy"]);

    expect(groups.find((group) => group.name === "Formal Systems")?.fields).toEqual(["Mathematics"]);
    expect(groups.find((group) => group.name === "Human Systems")?.fields).toEqual(["Philosophy"]);
    expect(groups.find((group) => group.name === "Other Domains")?.fields).toEqual(["Alchemy"]);
  });

  it("keeps empty known domain groups when no selected fields belong to them", () => {
    const groups = buildDisciplineGroups(["Philosophy"]);

    expect(groups.find((group) => group.name === "Formal Systems")?.fields).toEqual([]);
    expect(groups.find((group) => group.name === "Human Systems")?.fields).toEqual(["Philosophy"]);
  });

  it("combines controlled and observed subfields per field", () => {
    const subfields = buildSubfieldsByField(["Philosophy"], [
      thinker({ fields: ["Philosophy"], subfields: ["Hermeneutics", "Ethics"] }),
      thinker({ fields: ["Mathematics"], subfields: ["Topology"] }),
    ]);

    expect(subfields.Philosophy).toContain("Ethics");
    expect(subfields.Philosophy).toContain("Hermeneutics");
    expect(subfields.Philosophy).not.toContain("Topology");
  });

  it("adds observed topics outside the controlled taxonomy as local additions", () => {
    const groupsByField = buildTopicGroupsByField(["Philosophy"], {
      Philosophy: ["Ethics", "Hermeneutics"],
    });

    expect(groupsByField.Philosophy.find((group) => group.name === "Value & Action")?.topics).toContain("Ethics");
    expect(groupsByField.Philosophy.find((group) => group.name === "Local Additions")?.topics).toEqual(["Hermeneutics"]);
  });
});
