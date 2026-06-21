# Changelog

## Unreleased

- Added a reproducible, provenance-rich import of Nobel Physics, Chemistry, and Physiology or Medicine laureates and Fields Medal recipients, with existing-person resolution, stable Wikidata-based IDs, repeat-winner deduplication, review-only sourced relationship candidates, canonical seed integration, and validation coverage.
- Added UI and navigation improvements for reduced screen clutter, timeline controls, import review, and relationship curation.
- Added unit coverage for duplicate detection, import confidence, relationship scoring, metadata edge derivation, taxonomy grouping, storage validation, and migrations.
- Added Playwright coverage for import queueing, accepting/editing imports, suggested-link acceptance, filter drawer taxonomy expansion, and timeline dragging.
- Added CI, Render deployment configuration, auto-deploy configuration, public demo mode, and environment documentation.
- Added versioned atlas localStorage state with migration from legacy people/edge keys.
- Added root error boundary and local-data warning.
- Added development seed reset/import/check tooling.
- Added documentation for the data model, import workflow, edge confidence, source provenance, taxonomy, deployment, Codespaces, and screenshots.
