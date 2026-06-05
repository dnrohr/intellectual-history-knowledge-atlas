# Data Model Overview

The atlas is built around a small set of TypeScript interfaces in `src/types.ts` and seed data in `src/data.ts`.

## Thinkers

`Thinker` records are the main nodes in the atlas.

Required fields:

- `id`: stable lowercase identifier used by edges, threads, and UI state.
- `name`: display name.
- `birth`: numeric birth year, using negative numbers for BCE.
- `death`: numeric death year or `null`.
- `fields`: one or more top-level disciplines.

Optional fields:

- `subfields`: topic tags used by filters and taxonomy grouping.
- `region`, `era`, `movement`: historical context for filtering and layout.
- `bridge_score`: navigation significance from 1 to 5.
- `works`: durable works, discoveries, artifacts, or inventions.
- `influenced`: lightweight metadata for derived edges.
- `notes`: concise significance and provenance context.

## Edges

`InfluenceEdge` records connect thinker IDs.

- `source` and `target` must reference existing thinker IDs.
- `type` should be as specific as the evidence allows.
- `strength` controls visual and curatorial weight.
- `confidence` is a provenance score from 0 to 1.
- `sourceClaims` holds URLs or source identifiers.
- `status` tracks review state: `accepted`, `suggested`, `needs_source`, or `rejected`.

Edges from explicit seed data are preferred for important relationships. Metadata-derived `influenced` edges are useful as scaffolding but should be reviewed before they become canonical.

## Threads

`CanonicalThread` records in `src/threads.ts` describe curated intellectual paths.

Threads include:

- ordered `people`
- important `concepts`
- expected `edgeTypes`
- confidence level
- a short purpose statement

Threads should only reference thinker IDs that exist in the seed data.

## Local State

The browser persists local atlas state in `atlas_state_v8`. That versioned object contains normalized people and edges. Import queues, audit logs, saved views, timeline bookmarks, imported threads, and rejected suggestions use separate localStorage keys.

The app migrates older `atlas_people_v6`, `atlas_edges_v6`, and `atlas_state_v7` storage into `atlas_state_v8` on startup.

## Canonical Dataset Build Inputs

The canonical dataset pipeline starts from the `CanonicalDatasetBuildInputs` contract in `src/canonicalDataset.ts`.

Build inputs include:

- seed data: bundled people and relationship edges
- source adapter outputs: raw observations, normalized claim drafts, and adapter records
- claim records: materialized `SourceClaimEntity` evidence
- acceptance policies: claim-type thresholds and provisional boundaries
- manual overrides: explicit curator accept, reject, merge, restore, or annotation decisions
- repair decisions: accepted or held graph repair diffs
