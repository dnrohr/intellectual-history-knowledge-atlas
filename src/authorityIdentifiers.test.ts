import { describe, expect, it } from "vitest";
import { normalizeAuthorityIdentifiers } from "./authorityIdentifiers";

describe("authority identifiers", () => {
  it("normalizes VIAF and Library of Congress identifier captures", () => {
    expect(normalizeAuthorityIdentifiers({
      viaf: ["123", "123", " 456 "],
      loc: ["n79021164", ""],
    })).toEqual({
      viaf: ["123", "456"],
      loc: ["n79021164"],
    });
  });
});
