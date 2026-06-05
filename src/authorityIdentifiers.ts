export interface AuthorityIdentifiers {
  viaf?: string[];
  loc?: string[];
}

const normalizeIds = (values: unknown) =>
  Array.isArray(values)
    ? Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())))
    : [];

export const normalizeAuthorityIdentifiers = (value: AuthorityIdentifiers): AuthorityIdentifiers => {
  const viaf = normalizeIds(value.viaf);
  const loc = normalizeIds(value.loc);
  return {
    ...(viaf.length > 0 ? { viaf } : {}),
    ...(loc.length > 0 ? { loc } : {}),
  };
};
