# Intellectual History Knowledge Atlas TODO

This roadmap is intentionally ambitious. The goal is to make the atlas easier to extend, easier to trust, and easier to share without requiring the user to personally validate every thinker, topic, or relationship.

## Current Priorities

- Improve relationship automation so imported thinkers arrive with auditable, evidence-weighted link suggestions.
- Reduce manual labor in bulk imports through queue-level actions and source-aware autofill.
- Expand the data model beyond person-to-person influence.
- Make navigation scale as the number of thinkers, concepts, works, and institutions grows.
- Prepare a hosted demo path that does not require local install or Codespaces.

## Import And Data Automation

- Add queue-level bulk actions:
  - accept all non-duplicates
  - accept all with top suggested link
  - clear duplicate candidates
  - clear low-confidence candidates
  - clear entire queue
- Add confidence thresholds for import queue actions.
- Add a review status to queued items: `queued`, `edited`, `accepted`, `skipped`, `duplicate`.
- Preserve rejected/skipped import items in a lightweight local audit log.
- Add source-specific import quality labels.
- Add richer duplicate detection:
  - normalized name
  - alternate names
  - birth/death proximity
  - same Wikidata ID/source URL
  - similar works or movement
- Add "merge duplicate" workflow for imported people.
- Add auto-topic suggestions from imported description, occupation, field of work, notable works, and movement.
- Add automatic era inference for manual and edited imports.
- Add automatic bridge score suggestion based on source signals and relationship degree.
- Add batch paste support for `name | birth | death | field | notes`.
- Add CSV import.
- Add CSV export.
- Add JSON export/import for the whole atlas state.
- Add import queue persistence versioning and migration.
- Add "restore from exported state" workflow.

## External Sources

- Expand Wikidata import beyond people:
  - works
  - institutions
  - movements
  - concepts
  - awards
  - academic advisors/students where available
- Add Wikidata relationship harvesting:
  - student/advisor
  - influenced by
  - notable work
  - field of work
  - employer/institution
  - member of movement
- Add OpenAlex adapter for scholarly authors, works, concepts, and citation neighborhoods.
- Add Crossref adapter for works and citations.
- Add Library of Congress/VIAF identifier capture.
- Add Stanford Encyclopedia / Internet Encyclopedia source links manually or semi-automatically.
- Add Wikipedia summary fallback for readable descriptions.
- Add source claim records so every imported fact can carry provenance.
- Add stale-source warnings when imported data has no source URL.

## Relationship Suggestions

- Improve relationship scoring with:
  - direct source claims
  - chronology
  - advisor/student relations
  - citation chains
  - shared works
  - shared concepts
  - shared movement
  - shared institution
  - source text overlap
  - field/topic/lens overlap
- Split relationship suggestions into categories:
  - likely influence
  - direct mentorship
  - collaboration
  - parallel development
  - source-context neighbor
  - needs review
- Add suggested relationship confidence explanations.
- Add "why this link?" detail drawer.
- Add "reject suggested link" so the app learns from curation.
- Add link review queue independent from import queue.
- Add relationship source URLs and claim-level provenance.
- Add relationship status: `suggested`, `accepted`, `rejected`, `needs_source`.
- Add automated detection for isolated people and sparse neighborhoods.
- Add "connect this person" workflow that proposes best candidates by evidence type.

## Data Model Expansion

- Add first-class entities:
  - `Person`
  - `Work`
  - `Concept`
  - `Movement`
  - `Institution`
  - `SourceClaim`
  - `Relationship`
- Replace person-only `InfluenceEdge` with typed relationship records.
- Add works as graph nodes, not just strings.
- Add concepts as graph nodes.
- Add institutions as graph nodes.
- Allow edges like:
  - person authored work
  - work introduced concept
  - person influenced person
  - person participated in movement
  - person affiliated with institution
  - concept shaped movement
  - work influenced work
- Add source claim aggregation per entity and relationship.
- Add schema validation for imported data.
- Add migration path from current localStorage schema to expanded schema.

## UI And Navigation

- Add saved views/collections.
- Add default curated views:
  - Ancient foundations
  - Scientific Revolution
  - Enlightenment political thought
  - German Idealism
  - Evolution and biology
  - Logic to computation
  - Quantum physics
  - AI lineage
  - Critical theory and postmodernism
- Add "unlinked imports" view.
- Add "needs review" view.
- Add "high-confidence suggestions" view.
- Add "source gaps" view.
- Add compact relationship inspector.
- Add graph clustering by domain, movement, era, and institution.
- Add graph layout modes:
  - timeline-projected
  - force-directed
  - ego network
  - lineage tree
  - concept neighborhood
- Add better empty states and review guidance.
- Add keyboard shortcuts for review workflows.
- Add undo for accepting imports and relationships.
- Add visual distinction between confirmed and suggested edges.
- Add edge filters by type, confidence, and source status.
- Add label density controls for large graphs.
- Add minimap or overview navigator for large graph/timeline views.

## Thinkers Index

- Add search result ranking instead of raw filtering only.
- Add index grouping by movement.
- Add index grouping by institution.
- Add index grouping by source/review status.
- Add "recently added" group.
- Add "recently reviewed" group.
- Add "orphans" group.
- Add "high bridge score" group.
- Add "needs source" group.
- Add row badges for edge count, source count, and review status.
- Add quick actions on index rows:
  - focus
  - connect
  - edit tags
  - review sources

## Timeline

- Add richer range controls with named historical periods.
- Add timeline bookmarks.
- Add selected-person neighborhood overlay.
- Add density lanes by domain.
- Add edge arcs only for selected/focused neighborhoods by default.
- Add clearer BCE/CE axis treatment.
- Add confidence styling for timeline edges.
- Add movement/institution bands that can be toggled independently.

## Quality And Engineering

- Split `src/App.tsx` into focused modules/components.
- Extract import queue logic into a hook or reducer.
- Extract relationship scoring into a testable utility.
- Extract taxonomy helpers into testable utilities.
- Add unit tests for:
  - duplicate detection
  - candidate confidence scoring
  - relationship suggestion scoring
  - edge derivation from thinker metadata
  - taxonomy grouping
  - import queue persistence
- Add Playwright tests for:
  - batch import queueing
  - accepting queued candidate
  - editing queued candidate
  - accepting candidate with suggested link
  - filter drawer taxonomy expansion
  - timeline drag behavior
- Add CI with lint/build/test.
- Add bundle splitting to reduce main JS size.
- Add error boundaries.
- Add runtime schema checks for localStorage data.
- Add localStorage migration system.
- Add development seed reset/import tools.
- Add documentation for data conventions and edge confidence levels.

## Deployment And Sharing

- Add production deployment target.
- Evaluate:
  - Render
  - Railway
  - Fly.io
  - Vercel plus serverless API
  - Netlify plus serverless API
- Add GitHub Actions workflow for build verification.
- Add auto-deploy from `main`.
- Add environment variable documentation.
- Add public demo mode with sample data.
- Add "private local data" warning where appropriate.
- Add import/export so users can carry data between local, Codespaces, and hosted instances.

## Documentation

- Write a data model overview.
- Write an import workflow guide.
- Write edge confidence guidelines.
- Write source provenance guidelines.
- Write taxonomy guidelines.
- Write deployment guide.
- Write Codespaces guide with update steps.
- Add screenshots/GIFs once UI stabilizes.
- Add changelog.

## Tasks Codex Can Do Autonomously With Proper Privileges

- Create feature branches and pull requests.
- Run full lint/build/test suites.
- Add GitHub Actions CI.
- Add Playwright and implement browser tests.
- Install and configure testing dependencies.
- Refactor `App.tsx` into smaller components.
- Build the relationship scoring utility and test suite.
- Build the import queue reducer and test suite.
- Add bulk queue actions.
- Add CSV/JSON import-export.
- Add schema validation and localStorage migrations.
- Add source claim data structures.
- Extend the Wikidata backend endpoint to collect more relationship properties.
- Add OpenAlex/Crossref adapters if API/network access is approved.
- Add deployment config for Render/Railway/Fly/Vercel.
- Configure auto-deploy from GitHub.
- Audit the dataset for duplicate explicit edges.
- Audit the dataset for self-links.
- Audit people with missing fields, topics, eras, or sources.
- Generate candidate relationship batches from existing metadata and source signals.
- Add documentation and keep it synchronized with implemented behavior.

## Open Product Questions

- Should suggested relationships be shown in the main graph by default, or only after acceptance?
- Should imported people become local immediately, or remain staged until all links/tags are reviewed?
- Should source claims be required for every accepted relationship?
- Should confidence mean historical certainty, data-source quality, or review confidence?
- Should the atlas support multiple user-created datasets or one canonical dataset?
- Should the hosted demo persist user edits, or reset per session?

