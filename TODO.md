# Intellectual History Knowledge Atlas TODO

This roadmap is intentionally ambitious. The goal is to make the atlas easier to extend, easier to trust, and easier to share without requiring a user to personally validate every thinker, topic, work, source, or relationship.

Status notation:
- `[x]` Implemented and verified in the current repo.
- `[ ]` Still open.
- `[ ] (partial)` Started or substantially covered, but not complete enough to close.
- `[~]` Older milestone merged into a newer milestone or reframed as support work.

## Current Priorities

- Build a validated knowledge model where every entity, relationship, and source-backed fact can carry provenance.
- Move from manual import/review toward automated source collection, claim validation, graph repair, and dry-run acceptance policies.
- Keep the Influence Atlas and scholar dossier as the primary exploration experience.
- Reframe Source Studio as an automation, evidence, conflict, and override console rather than the main growth path for the dataset.
- Make threads, paths, and lineages evidence-aware once typed relationships and claim records exist.

Reference documents:
- `docs/automated-validation-roadmap.md`
- `docs/ui-redesign.md`
- `docs/ui-button-taxonomy.md`
- `docs/ui-interaction-qa-plan.md`
- `docs/data-model.md`
- `docs/source-provenance.md`
- `docs/edge-confidence.md`

## Active Roadmap

### 1. Validated Knowledge Model

Goal: expand the atlas from person-to-person influence into a typed, source-backed knowledge graph.

- [x] Add first-class entity types:
  - `Person`
  - `Work`
  - `Concept`
  - `Movement`
  - `Institution`
  - `SourceClaim`
  - `Relationship`
- [x] Replace person-only `InfluenceEdge` records with typed relationship records.
- [x] Add works as graph nodes, not just strings on person records.
- [x] Add concepts as graph nodes.
- [x] Add movements as graph nodes.
- [x] Add institutions as graph nodes.
- [x] Allow typed edges such as:
  - person authored work
  - work introduced concept
  - person influenced person
  - person mentored person
  - person collaborated with person
  - person participated in movement
  - person affiliated with institution
  - concept shaped movement
  - work influenced work
- [x] Add source claim aggregation per entity and relationship.
- [x] Add schema validation for imported and generated data.
- [x] Add migration path from the current localStorage schema to the expanded schema.

### 2. Claim-Based Data Model

Goal: make every fact auditable before automating acceptance.

- [x] Add structured `SourceClaim` records.
- [x] Add claim IDs to people, works, institutions, concepts, movements, and relationships.
- [x] Split raw source observations from accepted atlas records.
- [x] Represent claim status: `observed`, `candidate`, `accepted`, `rejected`, `stale`, `conflicting`.
- [x] Track source type: reference, encyclopedia, bibliographic, primary text, institutional, citation index, curated dataset.
- [x] Track source reliability and recency.
- [x] Store extraction method: API field, parser, text extraction, citation graph, model-generated summary, manual seed.
- [x] Migrate current edge `sourceClaims?: string[]` URLs into structured claim records.
- [x] Compute source gaps from claim records instead of missing URLs alone.

### 3. Source Adapter Layer

Goal: collect normalized evidence automatically without directly mutating canonical atlas data.

- [x] Define a shared adapter interface for:
  - entity search
  - entity detail fetch
  - relationship fetch
  - work fetch
  - affiliation fetch
  - citation/reference fetch
  - source claim normalization
- [x] Expand Wikidata harvesting beyond people:
  - works
  - institutions
  - movements
  - concepts
  - awards
  - academic advisors/students where available
  - fields, employers, notable works, and movement membership
- [x] Add OpenAlex adapter for scholarly authors, works, concepts, institutions, citations, coauthorship, and topic neighborhoods.
- [x] Add Crossref adapter for works, publication metadata, DOI-level evidence, and citations where available.
- [x] Add VIAF and Library of Congress identifier capture.
- [x] Add Wikipedia/DBpedia summary fallback as low-confidence descriptive evidence.
- [x] Add encyclopedia/manual-source adapters for stable intellectual-history references where APIs are limited.
- [x] Add stale-source warnings when imported or generated data has no usable source URL.

### 4. Entity Resolution

Goal: automatically identify when source observations refer to the same underlying entity.

- [x] Add canonical entity IDs separate from source-specific IDs.
- [x] Score person matches using normalized names, alternate names, dates, fields, occupations, external IDs, works, institutions, and movements.
- [x] Score work matches using title, author, date, DOI, ISBN, OpenAlex ID, Wikidata ID, and translated titles.
- [x] Score institution, movement, and concept matches with type-specific rules.
- [ ] Add automatic merge thresholds:
  - auto-merge
  - provisional merge
  - keep separate
  - conflict
- [ ] Preserve conflicting observations instead of discarding them.
- [ ] Keep manual merge and duplicate review as override/recovery tools, not the default import path.

### 5. Relationship Evidence Engine

Goal: generate, classify, and explain relationship candidates from evidence.

- [ ] Generate direct mentorship candidates from advisor/student evidence.
- [ ] Generate collaboration candidates from coauthorship, correspondence, institutional overlap, and jointly authored works.
- [ ] Generate influence candidates from explicit source claims, citation paths, named mentions, advisor/student lineage, work-to-work reception, and movement membership with chronology.
- [ ] Generate parallel-development candidates from shared concepts without direct transmission evidence.
- [ ] Generate source-context neighbor candidates from source proximity without overclaiming influence.
- [ ] Validate direction using chronology, source wording, and relationship type.
- [ ] Split relationship suggestions into categories:
  - likely influence
  - direct mentorship
  - collaboration
  - parallel development
  - source-context neighbor
  - needs review
- [ ] Add candidate records separate from accepted relationships.
- [ ] Add relationship source URLs and claim-level provenance.
- [ ] Add relationship status: `suggested`, `accepted`, `rejected`, `needs_source`.
- [ ] Add "why this link?" evidence explanations.
- [ ] Keep the link review queue as a low-confidence exception path.

### 6. Evidence Scoring And Acceptance Policies

Goal: decide what can be accepted automatically, what should remain provisional, and what should be rejected.

- [ ] Split confidence into:
  - identity confidence
  - factual confidence
  - relationship confidence
  - source quality
  - extraction confidence
  - graph consistency
- [ ] Define testable acceptance thresholds by claim type.
- [ ] Use stricter thresholds for direct influence, canonical-thread edges, cross-century jumps, high bridge-score nodes, and disputed or sparse topics.
- [ ] Use looser thresholds for basic metadata, stable external IDs, works with stable identifiers, and institution affiliations with direct source support.
- [ ] Add automatic rejection for self-links, impossible chronology, duplicate opposite-direction edges, and unsupported direct influence from shared tags alone.
- [ ] Add "accepted by policy" metadata to automatically accepted claims.
- [ ] Add dry-run mode for automated acceptance.
- [ ] Add tests for evidence scoring and acceptance/rejection policy boundaries.

### 7. Graph Quality Audits And Repair

Goal: detect quality problems and repair common issues when confidence is high enough.

- [ ] Add graph-level quality metrics:
  - sourced edge percentage
  - accepted edge percentage
  - average edge confidence
  - isolated node count
  - duplicate risk count
  - source freshness
  - canonical thread coverage
- [ ] Add automated audits for isolated nodes, sparse high-bridge nodes, unsupported edges, stale source claims, duplicate entities, dangling references, impossible dates, missing works, missing institutions, and over-broad fields or movements.
- [ ] Add critical thresholds that trigger dry-run repair jobs.
- [ ] Auto-connect isolated high-confidence nodes through validated relationship candidates.
- [ ] Auto-demote weak unsupported edges to provisional status.
- [ ] Auto-add missing source claims for accepted edges when reliable sources are found.
- [ ] Produce repair-job diffs before mutating canonical data.
- [ ] Add graph health reporting to the UI and dataset QA output.

### 8. Source Studio As Automation Console

Goal: make Source Studio the place to inspect automation state, not the main way the graph grows.

- [ ] Replace manual-import emphasis with automation status, evidence coverage, conflicts, and repair previews.
- [ ] Add tabs or modes for:
  - Source health
  - Claim conflicts
  - Candidate relationships
  - Repair jobs
  - Manual overrides
  - Export/recovery
- [ ] Keep batch paste, CSV import/export, JSON restore, and duplicate merge as fallback/admin tools.
- [ ] Show why an automated claim was accepted, held, rejected, or marked conflicting.
- [ ] Add undo/revert for automated repair batches.
- [ ] Add source adapter run history and error summaries.

### 9. Threads And Guided Lineages

Goal: make curated threads evidence-aware and reusable after typed relationships exist.

- [ ] Define a `Thread` concept for curated followable chains:
  - title
  - short purpose
  - ordered entities
  - key works/concepts carried forward
  - edge types used in the thread
  - confidence/source status
- [ ] Add thread labels to relationships so a single relationship can belong to multiple curated paths.
- [ ] Add a thread viewer that steps through a chain one relationship at a time.
- [ ] Add thread-aware graph highlighting:
  - highlight the full thread
  - dim unrelated graph regions
  - show predecessor/current/successor context
  - sync timeline and graph to each selected step
- [ ] Add a "continue this thread" action on a selected entity.
- [ ] Add a "thread gaps" audit for missing intermediate figures, missing edge sources, weak claims, and overlong chronology jumps.
- [ ] Add branch point and convergence point markers.
- [ ] Add parallel-thread view for converging lineages.
- [ ] Add thread import/export so curated paths can be shared separately from the whole atlas.

### 10. Exploration UI Follow-Through

Goal: keep the UI aligned with the network-first, dossier-centered product direction.

- [x] Separate Atlas exploration from Source Studio.
- [x] Make Influence Atlas the default network-first experience.
- [x] Rebuild the scholar dossier as the primary selected-thinker card.
- [x] Move importing, exporting, source providers, source audit, duplicate review, and bulk review actions out of the Atlas workspace.
- [x] Convert index, filters, path tools, and saved views into drawers, sheets, or command-menu surfaces.
- [x] Add mobile-first panel behavior.
- [x] Fix hop controls, label density controls, oversized toolbar behavior, and graph clamping issues.
- [ ] Continue interaction QA for layout overflow, unreachable controls, hidden scroll regions, overlay collisions, and non-working buttons.
- [ ] Add regression coverage whenever a visual control bug is found.
- [ ] Revisit minimap/overview behavior for dense graph states after typed entities expand the graph.

### 11. Canonical Dataset Pipeline

Goal: make the bundled dataset reproducible from source observations, validation policy, and repair jobs.

- [ ] Define canonical dataset build inputs:
  - seed data
  - source adapter outputs
  - claim records
  - acceptance policies
  - manual overrides
  - repair decisions
- [ ] Add deterministic dataset generation.
- [ ] Add dataset version metadata.
- [ ] Add changelog generation for added, changed, demoted, rejected, and conflicting claims.
- [ ] Add snapshot tests for canonical data output.
- [ ] Add CI checks that fail on impossible dates, invalid references, self-links, and schema errors.

### 12. Hosted Demo And Sharing

Goal: keep the app easy to share while making data provenance clear.

- [x] Add production deployment target.
- [x] Add GitHub Actions workflow for build verification.
- [x] Add auto-deploy from `main`.
- [x] Add environment variable documentation.
- [x] Add public demo mode with sample data.
- [x] Add private local data warning where appropriate.
- [x] Add import/export so users can carry data between local, Codespaces, and hosted instances.
- [ ] Revisit hosted demo persistence once automated validation and canonical dataset generation are in place.

## Completed Milestones

These milestones are complete enough to keep as historical summaries rather than active implementation checklists.

### UI Rethink And Navigation

- [x] Reframed the app around activity-first workspaces.
- [x] Separated Influence Atlas, Source Studio, and Focus/Presentation.
- [x] Made the network canvas the dominant Atlas surface.
- [x] Added a compact expandable timeline strip.
- [x] Added mobile-first panel behavior, bottom-sheet dossier behavior, and full-screen command/search affordances.
- [x] Added saved views, curated views, unlinked imports, needs review, high-confidence suggestions, and source gaps views.
- [x] Added compact relationship inspector, graph clustering, layout modes, edge filters, label density controls, and overview navigation.
- [x] Documented the panel/button contract in `docs/ui-redesign.md` and `docs/ui-button-taxonomy.md`.
- [x] Added the interaction QA plan in `docs/ui-interaction-qa-plan.md`.

### Thinkers Index

- [x] Added search ranking, grouping by movement/institution/source/review status, recently added/reviewed groups, orphan/high-bridge/needs-source groups, row badges, and quick actions.

### Timeline

- [x] Added named historical ranges, bookmarks, neighborhood overlays, density lanes, selected/focused edge arcs, clearer BCE/CE treatment, confidence styling, and movement/institution bands.

### Quality And Engineering

- [x] Split `src/App.tsx` into focused modules/components.
- [x] Extracted import queue logic into a hook or reducer.
- [x] Extracted relationship scoring and taxonomy helpers into testable utilities.
- [x] Added unit tests for duplicate detection, candidate confidence scoring, relationship suggestion scoring, edge derivation, taxonomy grouping, and import queue persistence.
- [x] Added Playwright tests for batch import queueing, candidate acceptance/editing, suggested-link acceptance, filter drawer expansion, timeline drag behavior, and network controls.
- [x] Added CI, bundle splitting, error boundaries, runtime schema checks, localStorage migrations, seed reset/import tools, and documentation for data conventions and edge confidence levels.

### Documentation

- [x] Wrote data model overview.
- [x] Wrote import workflow guide.
- [x] Wrote edge confidence guidelines.
- [x] Wrote source provenance guidelines.
- [x] Wrote taxonomy guidelines.
- [x] Wrote deployment guide.
- [x] Wrote Codespaces guide with update steps.
- [x] Added screenshots/GIFs once UI stabilized.
- [x] Added changelog.
- [x] Added automated validation roadmap.

## Merged Or Reframed Older Milestones

### Import And Data Automation

- `[~]` Older manual-import items now belong under Source Studio fallback/admin tooling, Claim-Based Data Model, Source Adapter Layer, Entity Resolution, and Evidence Scoring.
- `[~]` Queue-level bulk actions, batch paste, CSV import/export, JSON import/export, restore, duplicate review, and manual merge should remain available as recovery tools rather than the primary dataset growth path.
- `[~]` Auto-topic, era, bridge-score, duplicate-detection, and source-quality logic should be moved toward claim normalization, entity resolution, and validation policy.

### External Sources

- `[~]` External source work now belongs under Source Adapter Layer, Claim-Based Data Model, Entity Resolution, and Canonical Dataset Pipeline.
- `[~]` Wikidata, OpenAlex, Crossref, VIAF/LOC, Wikipedia/DBpedia, SEP/IEP, and manual-source references should produce normalized claims before affecting canonical data.

### Relationship Suggestions

- `[~]` Relationship suggestions now belong under Relationship Evidence Engine, Evidence Scoring, and Graph Quality Audits.
- `[~]` The link review queue should be retained for ambiguous, low-confidence, disputed, or high-impact candidates.

### Edges And Navigable Threads

- `[~]` Thread work is still important, but it should follow the typed relationship and source-claim model so threads can carry evidence, edge types, and confidence state.

## Tasks Codex Can Do Autonomously With Proper Privileges

- Create feature branches and pull requests.
- Run full lint/build/test suites.
- Add GitHub Actions CI.
- Add Playwright and implement browser tests.
- Install and configure testing dependencies.
- Refactor modules and components while preserving existing app patterns.
- Build claim, relationship, entity-resolution, and validation-policy utilities with focused test coverage.
- Extend backend source adapters where public APIs are available.
- Add OpenAlex/Crossref adapters if API/network access is approved.
- Audit the dataset for duplicate explicit edges, self-links, missing fields, missing topics, missing eras, missing sources, and sparse high-bridge nodes.
- Generate candidate relationship batches from existing metadata and source signals.
- Keep documentation synchronized with implemented behavior.

## Open Product Questions

- Should suggested relationships be shown in the main graph by default, or only after acceptance?
- Which claim types can be accepted automatically without human review?
- Should source claims be required for every accepted relationship?
- Should confidence mean historical certainty, data-source quality, review confidence, or a composed score?
- Should the atlas support multiple user-created datasets or one canonical dataset?
- Should the hosted demo persist user edits, reset per session, or expose only canonical data?
- When should manual Source Studio overrides supersede automated validation policy?
