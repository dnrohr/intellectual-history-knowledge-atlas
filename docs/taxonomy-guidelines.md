# Taxonomy Guidelines

The taxonomy gives the atlas its filter structure, topic editor, import labels, and lens inference.

Core taxonomy code lives in `src/taxonomy.ts`.

## Domains And Fields

Top-level fields are grouped into domains:

- Formal Systems
- Natural Inquiry
- Human Systems
- Arts & Interpretation

Use existing fields before adding new ones. A new field should be added only when many thinkers need it and it cannot be represented well as a subfield.

When adding a field:

1. Add it to `TAXONOMY_DOMAINS`.
2. Add controlled topics in `TOPIC_GROUPS`.
3. Check `FIELD_COLOR` in `src/data.ts`.
4. Review import inference in `server.ts` and `App.tsx`.
5. Run tests and the dataset QA report.

## Subfields And Topics

Subfields are topic tags on `Thinker.subfields`.

Prefer controlled topics from `TOPIC_GROUPS`. Local additions are allowed, but repeated local additions are a sign that the controlled taxonomy should be updated.

Good topic tags are:

- reusable across multiple people,
- specific enough to aid filtering,
- broad enough to avoid one-off clutter,
- phrased consistently with neighboring topics.

Avoid turning works, institutions, or full note phrases into topics.

## Lens Tags

Atlas lenses infer broad problem, method, and role tags from fields, topics, works, notes, and movements.

Lens tags are intentionally coarse. They are for discovery and clustering, not formal classification.

When updating lenses:

1. Add match terms that are specific enough to avoid noisy tagging.
2. Prefer lower-case conceptual terms over proper names.
3. Test with people across multiple fields.
4. Watch for unexpected high-level filter counts.

## Import Behavior

Imports infer fields and topics from candidate descriptions, works, movements, and source text. If imports repeatedly misclassify a domain, update inference and taxonomy together.

## Review Checklist

Before committing taxonomy changes:

1. Confirm existing filters still show expected fields and topics.
2. Check topic group expansion in the filter drawer.
3. Run `npm test`, `npm run lint`, `npm run build`, and `npm run qa:data`.
4. Update docs if the field model or topic conventions changed.
