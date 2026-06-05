# Source Provenance Guidelines

Source provenance explains why a record or edge exists and how a future reviewer can verify it.

## What To Source

Prioritize sources for:

- high-confidence or canonical-thread edges,
- imported people promoted into seed data,
- dates, works, institutions, and movements that affect filters,
- mentorship, collaboration, or direct influence claims,
- surprising cross-field or cross-era relationships.

Low-risk descriptive notes can remain unsourced temporarily, but review queues should surface source gaps.

## Good Source Claims

Good `sourceClaims` are stable and directly relevant:

- encyclopedia or reference entries for basic biographical facts,
- primary texts or editions for works and intellectual claims,
- institutional pages for affiliations,
- scholarly articles or books for influence relationships,
- open bibliographic pages when primary sources are not practical.

A source claim should support the specific field it is attached to. For edges, it should support the relationship, not merely the existence of both endpoint people.

## Source Notes

Use `note` to summarize the claim in plain language. Notes should be short but explanatory enough that the edge is understandable without opening every source.

Good:

```text
Arabic Aristotle commentaries transmitted Peripatetic logic into Latin scholasticism.
```

Weak:

```text
Important influence.
```

## Imported Data

Imported records should preserve source context in `notes` or `sourceClaims` where available. Wikidata and Wikipedia URLs are useful provenance anchors, but they are not substitutes for reviewing the actual relationship before marking an edge as accepted.

## Review States

Use `needs_source` when an edge is useful for navigation but lacks direct support. Use `suggested` for generated or imported links. Move to `accepted` only after reviewing direction, relationship type, note, and source support.

## Avoiding Overclaims

Do not turn shared field, era, movement, or topic into direct influence unless a source supports transmission. Use `Source-context neighbor` or `Parallel` for contextual relationships where direct influence is uncertain.
