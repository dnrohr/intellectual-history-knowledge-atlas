# Bulk Edge Validation

Bulk edge validation is the automated path for keeping the canonical relationship graph clean and growing.

## Acceptance Criteria

Every existing edge must end with one final disposition:

- `confirmed-existing-edge`
- `removed-existing-edge`

Every discovered candidate must end with one final disposition:

- `added-confirmed-edge`
- `discarded-candidate`

There is no manual review lane. Missing sources, weak evidence, and conflicts are automated work states that must trigger source acquisition, rule refinement, conflict resolution, or removal.

## Validation Layers

Structural validation fails edges for:

- missing source or target IDs
- self-links
- impossible chronology
- duplicate same-direction edges
- duplicate opposite-direction conflicts
- invalid relationship types

Evidence validation checks:

- missing claim IDs or source URLs
- stale source claims
- rejected or conflicting claims attached to accepted edges
- weak confidence on high-impact edges
- claims that support only endpoint existence rather than the relationship

Relationship-type rules require the right kind of evidence for each edge type. Direct influence needs transmission evidence. Mentorship needs advisor/student evidence. Collaboration needs shared-work or correspondence evidence. Source-context and parallel-development edges must avoid overclaiming direct transmission.

## Discovery

Missing edge candidates can be generated from:

- relationship source claims
- explicit `influenced` metadata
- advisor/student claims
- coauthor, correspondent, or collaboration claims
- chronology-constrained shared movement or region context
- canonical thread gaps

Candidates are deduplicated against existing edges and against each other before validation.

## CI And Source Studio

`npm run qa:edges` runs structural validation over the bundled canonical seed graph and fails on structural blockers.

Source Studio shows bulk edge validation status, dry-run repair counts, and a JSON report export. Repair decisions remain dry-run until a pipeline step applies them.
