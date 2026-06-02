# Intellectual History Knowledge Atlas TODO

This roadmap is intentionally ambitious. The goal is to make the atlas easier to extend, easier to trust, and easier to share without requiring the user to personally validate every thinker, topic, or relationship.

Status notation:
- `[x]` Implemented and verified in the current repo.
- `[ ]` Still open.
- `[ ] (partial)` Started or substantially covered, but not complete enough to close.

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

## Edges And Navigable Threads

- Define a `Thread` concept for curated followable chains:
  - title
  - short purpose
  - ordered people
  - key works/concepts carried forward
  - edge types used in the thread
  - confidence/source status
- Add a thread viewer that lets a user step through a chain one relationship at a time.
- Add thread-aware graph highlighting:
  - highlight the full thread
  - dim unrelated graph regions
  - show predecessor/current/successor context
  - snap timeline and graph to each selected step
- Add a "continue this thread" action on any selected person.
- Add a "thread gaps" audit:
  - missing intermediate figures
  - missing edge sources
  - weak or disputed edge claims
  - overlong jumps across centuries
- Add a "parallel thread" view for cases where multiple lineages converge.
- Add a "branch point" marker for thinkers who split a tradition into competing paths.
- Add a "convergence point" marker for thinkers who synthesize multiple threads.
- Add thread labels to edges so a single edge can belong to multiple curated paths.
- Add thread import/export so curated paths can be shared separately from the whole atlas.

### Thread Expansion Tasks By Field

- [x] Philosophy and logic:
  - [x] Build ancient-to-modern metaphysics thread: Plato -> Aristotle -> Aquinas -> Descartes -> Kant -> Hegel.
  - [x] Build logic/formalism thread: Aristotle -> Chrysippus -> Leibniz -> Boole -> Frege -> Russell -> Wittgenstein -> Turing.
  - [x] Build empiricism/pragmatism thread: Bacon -> Locke -> Hume -> Mill -> James -> Dewey -> Rorty.
  - [x] Build existentialism/post-structuralism thread: Kierkegaard -> Nietzsche -> Heidegger -> Sartre -> Beauvoir -> Foucault -> Derrida -> Butler.
  - [x] Add missing or weak edges among Stoicism, Epicureanism, Scholasticism, Rationalism, Empiricism, German Idealism, Analytic Philosophy, Pragmatism, and Postmodernism.
- [x] Mathematics:
  - [x] Build geometry/topology thread: Euclid -> Descartes -> Gauss -> Riemann -> Poincare -> Hilbert -> Noether -> Atiyah -> Thurston -> Perelman.
  - [x] Build calculus/analysis thread: Archimedes -> Newton/Leibniz -> Euler -> Fourier -> Cauchy -> Weierstrass -> Riemann.
  - [x] Build probability/statistics thread: Pascal/Fermat -> Bayes -> Laplace -> Gauss -> Fisher -> Kolmogorov -> Shannon -> Pearl.
  - [x] Build computation foundations thread: Leibniz -> Boole -> Frege -> Hilbert -> Godel -> Church -> Turing -> von Neumann -> Shannon.
  - [x] Add source-backed edges for mentorship, collaboration, and theorem/program inheritance where current edges are only broad influence.
- [x] Physics, astronomy, and cosmology:
  - [x] Build mechanics thread: Archimedes -> Galileo -> Newton -> Lagrange/Hamilton -> Maxwell -> Einstein.
  - [x] Build electromagnetism/information thread: Coulomb -> Ampere -> Faraday -> Maxwell -> Hertz -> Shannon -> Landauer.
  - [x] Build quantum thread: Planck -> Einstein -> Bohr -> Heisenberg/Schrodinger/Dirac -> Feynman -> Dyson -> Weinberg.
  - [x] Build relativity/cosmology thread: Einstein -> Eddington -> Lemaitre -> Gamow -> Peebles -> Guth -> Hawking/Penrose.
  - [x] Build matter/particle thread: Thomson -> Rutherford -> Bohr -> Chadwick -> Fermi -> Gell-Mann -> Weinberg.
- [x] Biology, medicine, and genetics:
  - [x] Build evolution thread: Aristotle -> Linnaeus -> Lamarck -> Darwin -> Mendel -> Fisher/Haldane/Wright -> Gould/Dawkins.
  - [x] Build microbiology/medicine thread: Harvey -> Pasteur -> Koch -> Lister -> Salk/Sabin.
  - [x] Build molecular biology thread: Mendel -> Morgan -> Franklin -> Watson/Crick -> Brenner/Monod/Nirenberg -> Sanger -> Doudna/Venter.
  - [x] Build ecology thread: Humboldt -> Tansley -> Hutchinson -> Odum -> Lovelock -> Wilson -> Carson.
  - [x] Add edges connecting biological ideas to statistical, information-theoretic, and computational threads.
- [x] Computing, AI, and cognitive science:
  - [x] Build symbolic AI thread: Leibniz -> Boole -> Frege -> Russell -> Turing -> Newell/Simon -> McCarthy -> Minsky.
  - [x] Build neural networks thread: McCulloch/Pitts -> Hebb -> Rosenblatt -> Minsky critique -> Rumelhart/Hinton -> LeCun/Bengio.
  - [x] Build language/cognition thread: Saussure -> Chomsky -> Fodor -> Pinker and Chomsky -> Lakoff -> cognitive linguistics.
  - [x] Build human-computer/network thread: Turing -> von Neumann -> Shannon -> Engelbart/Kay -> Berners-Lee.
  - [x] Build causality/ML thread: Bayes -> Laplace -> Fisher -> Kolmogorov -> Pearl -> modern ML causality.
- [x] Political thought, economics, and social theory:
  - [x] Build social contract/liberalism thread: Hobbes -> Locke -> Rousseau -> Mill -> Rawls -> Nozick/Sen/Nussbaum.
  - [x] Build political economy thread: Smith -> Ricardo/Malthus -> Marx -> Keynes/Hayek/Polanyi -> Sen.
  - [x] Build sociology/social science thread: Comte -> Durkheim -> Weber -> Mauss -> Bourdieu -> Latour.
  - [x] Build feminist thought thread: Wollstonecraft -> Harriet Taylor Mill -> Beauvoir -> hooks -> Butler.
  - [x] Build postcolonial/cultural theory thread: Marx -> Gramsci -> Raymond Williams -> Said -> hooks.
- [x] Literature, music, and aesthetics:
  - [x] Build literary modernity thread: Goethe -> Dostoevsky/Kafka -> Borges -> postmodern literary theory.
  - [x] Build aesthetics/romanticism thread: Kant -> Goethe -> Wagner -> Nietzsche -> modern aesthetics.
  - [x] Add edges connecting literary figures to philosophy, psychology, and political thought where they transmit concepts rather than direct mentorship.
- [x] Engineering, communication, and technology:
  - [x] Build mechanical-to-electrical systems thread: Watt -> Faraday -> Maxwell -> Tesla/Edison -> Mead -> modern computing hardware.
  - [x] Build communication networks thread: Gutenberg -> telegraph/telephone figures -> Nyquist -> Shannon -> Cerf/Metcalfe -> Berners-Lee.
  - [x] Build aerospace thread: Tsiolkovsky -> Goddard -> von Braun/Korolev -> Johnson/Rich.
  - [x] Build energy/materials thread: Volta -> Davy -> Faraday -> Goodenough -> contemporary storage technologies.

### Edge Expansion Audit Tasks

- [x] For each field, identify:
  - [x] isolated people with zero incoming and zero outgoing explicit edges
  - [x] people with only metadata-derived edges
  - [x] high bridge-score people with too few explicit edges
  - [x] repeated duplicate edges with conflicting direction/type
  - [x] edges that should be split into mentorship, collaboration, influence, parallel development, or source-context neighbor
- [ ] (partial) Add at least one incoming and one outgoing explicit edge for every high bridge-score thinker where historically defensible.
- [ ] (partial) Add source notes for the top 100 most important thread edges.
- [x] Create a "canonical threads" seed file separate from raw people/edges.
- [x] Build a dataset QA report that lists thread coverage by field and era.

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

### Major UI Direction: Reduce Screen Clutter And Prioritize The Current Activity

- [x] Reframe the app around an activity-first workspace:
  - exploration
  - focused thinker inspection
  - relationship/path tracing
  - dataset curation
  - import/review work
  - source/provenance auditing
- [x] Make each activity own most of the available screen while keeping secondary tools available through drawers, menus, floating panels, or temporary overlays.
- [x] Move persistent controls into contextual surfaces:
  - top-level mode switcher for major activities
  - compact command/action menu for less frequent actions
  - right or bottom drawer for detail/curation tools
  - floating quick actions for the current selection
  - collapsible filter and lens controls
  - transient inspector panels that can be closed or pinned
- [x] Distinguish always-visible navigation from optional modification tools:
  - keep search, current focus, and primary mode visible
  - hide advanced filters until requested
  - hide Workbench/review tools outside curation mode
  - hide relationship editing controls behind selected-person actions
  - make source/provenance tools available from edge/person inspectors rather than permanently visible
- [x] Design the layout with mobile-app intuition even on desktop:
  - bottom sheets for details and filters on narrow screens
  - swipe/segmented navigation between timeline, graph, dossier, and workbench
  - single-primary-pane mode for small screens
  - tap-to-expand cards for dense thinker information
  - floating action button or command palette for add/connect/review actions
  - persistent back/close affordances for overlays and drawers
- [x] Add responsive workspace modes:
  - desktop: split panes with collapsible sidebars and resizable drawers
  - tablet: one main view plus slide-over tools
  - mobile: one main view plus bottom sheets and stacked activity tabs
  - presentation/demo: minimal chrome with focused timeline or graph
  - curation: denser controls, queues, and edit actions visible
- Add user-controlled chrome density:
  - compact
  - comfortable
  - focus mode
  - curation mode
  - demo mode
- Add a panel/pane state model:
  - closed
  - floating
  - docked
  - pinned
  - full-screen
  - remembered per activity where useful
- Make the timeline usable at large scale:
  - keep year/axis context sticky and always visible
  - add timeline density modes for sparse, balanced, and compressed views
  - collapse non-focused thinkers into clusters, bands, or heat/rug marks
  - expand only selected neighborhoods, searched results, thread steps, or high-relevance clusters
  - add semantic zoom levels that change what is shown as the user zooms
  - support field/domain lanes that can be toggled or collapsed
  - let users hide low-bridge, unrelated, or unselected-field people while preserving context markers
  - show labels only for selected, hovered, path/thread, high-bridge, or search-match people
  - provide a "show nearby context" control instead of rendering everyone equally
- Add timeline navigation aids:
  - sticky BCE/CE year ruler
  - mini overview/range scrubber
  - jump-to-selected control
  - bookmarks for eras, threads, and saved views
  - visible "current window" date range indicator
  - quick reset to full range or selected-person lifespan
- Improve filtering as a primary interaction, not just a drawer:
  - saved filter presets
  - current-activity filter chips
  - quick toggles for selected field, selected era, selected thread, and selected neighborhood
  - relevance ranking for visible people
  - "only show connected to current focus"
  - "only show this thread"
  - "only show review gaps"
- Treat graph and timeline as coordinated lenses:
  - timeline can show compressed context while graph shows active neighborhood detail
  - graph can show relationship structure while timeline shows chronology for selected nodes
  - selection, path, thread, and filter state should move cleanly between views
- Add clear overlay behavior:
  - only one major drawer open by default
  - overlays should be dismissible, pinnable, and not trap critical controls
  - floating panels should avoid covering the selected node/timeline axis when possible
  - panels should remember whether the user prefers them docked or floating
- Add a UI audit pass for every major screen:
  - what is the user's current activity?
  - what must remain visible?
  - what can be hidden until requested?
  - what should be one tap/click away?
  - what can move into a drawer, menu, command palette, or bottom sheet?

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
