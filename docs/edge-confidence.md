# Edge Confidence Guidelines

Edge confidence describes provenance quality. It is separate from `strength`, which describes visual and curatorial importance.

## Confidence Bands

- `0.8` to `1.0`: direct, sourced, and reviewed. Suitable for canonical threads and prominent graph paths.
- `0.5` to `0.79`: plausible and partly sourced. Good for navigation, but notes should explain mediation or uncertainty.
- `0.35` to `0.49`: provisional, imported, or generated from contextual signals. Review before relying on it.
- below `0.35`: weak evidence. Prefer `needs_source`, queue for review, or omit from the active graph.

## Strength Versus Confidence

Use `strength` for significance:

- high strength: central relationship, major transmission, important bridge, or canonical path edge.
- medium strength: useful relationship with clear context.
- low strength: weak or peripheral navigation aid.

Use `confidence` for evidence:

- high confidence: strong source support or direct documented relationship.
- medium confidence: reasonable source support, indirect lineage, or well-known contextual relationship.
- low confidence: generated suggestion, source gap, or broad contextual neighbor.

A relationship can be strong but low confidence if it is important but under-sourced. A relationship can also be high confidence but low strength if it is documented yet peripheral.

## Status Values

- `accepted`: reviewed and suitable for normal navigation.
- `suggested`: generated or imported, useful but provisional.
- `needs_source`: keep visible for curation, but do not treat as settled.
- `rejected`: keep only when preserving review history.

## Source Claims

Use `sourceClaims` for URLs or source identifiers that justify the edge. Prefer stable references such as encyclopedia entries, primary texts, institutional pages, open bibliographic pages, or scholarly references.

Source claims should support the relationship itself, not merely prove that both people existed.

## Notes

Write short notes that explain why the edge exists:

- good: "Arabic Aristotle commentaries transmitted Peripatetic logic into Latin scholasticism."
- weak: "Both were philosophers."

For generated links, keep the provisional language visible until reviewed.

## Review Heuristics

Before increasing confidence:

1. Confirm both endpoint IDs are correct.
2. Check whether a more specific relationship type applies.
3. Verify the source claim supports the relationship.
4. Make sure directionality is historically defensible.
5. Avoid turning broad topical similarity into direct influence.
