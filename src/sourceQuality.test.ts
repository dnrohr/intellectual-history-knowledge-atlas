import { describe, expect, it } from "vitest";
import { createSourceClaimEntity } from "./knowledgeModel";
import { getStaleSourceWarnings } from "./sourceQuality";

describe("source quality warnings", () => {
  it("warns when claims or observations have no usable source URL", () => {
    const warnings = getStaleSourceWarnings([
      createSourceClaimEntity({
        id: "claim:missing-url",
        sourceName: "Manual",
        subjectEntityId: "person:arendt",
        subjectEntityType: "Person",
        field: "birth",
        value: "1906",
      }),
      createSourceClaimEntity({
        id: "claim:ok",
        sourceName: "SEP",
        sourceUrl: "https://plato.stanford.edu/entries/arendt/",
        subjectEntityId: "person:arendt",
        subjectEntityType: "Person",
        field: "birth",
        value: "1906",
      }),
    ], [{
      id: "observation:bad",
      sourceName: "Import",
      sourceUrl: "not-a-url",
      observedAt: "2026-06-05T00:00:00.000Z",
      raw: {},
      normalizedClaims: [],
    }]);

    expect(warnings).toEqual([
      {
        id: "claim:missing-url",
        kind: "claim",
        message: "Source claim claim:missing-url has no usable source URL.",
      },
      {
        id: "observation:bad",
        kind: "observation",
        message: "Source observation observation:bad has no usable source URL.",
      },
    ]);
  });
});
