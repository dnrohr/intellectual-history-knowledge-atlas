# Automated Validation Roadmap

This roadmap describes how the atlas can move from manual import and edge curation toward automated evidence collection, validation, repair, and dataset refresh.

The long-term goal is an atlas where people, works, institutions, concepts, movements, and relationships are added or corrected by automated pipelines. Human review should become an exception path for ambiguous, disputed, or high-impact claims rather than the normal workflow.

## Guiding Principles

- Treat every node, edge, date, work, movement, and tag as a claim that needs evidence.
- Separate evidence gathering from claim acceptance.
- Prefer multiple independent signals over a single source.
- Never promote a direct influence edge from weak contextual similarity alone.
- Keep uncertainty explicit through confidence, source quality, and claim status.
- Make automated decisions reproducible, auditable, and reversible.
- Let the dataset repair itself when quality thresholds or scale limits are crossed.

## Target End State

In the mature system:

- The app no longer depends on a manual import queue as the main way to grow.
- External source adapters continuously discover candidates and claims.
- Entity resolution merges duplicate people, works, institutions, concepts, and movements automatically when confidence is high.
- Relationship candidates are scored by evidence type, chronology, source agreement, and graph context.
- Low-risk facts are added automatically when validation thresholds are met.
- High-impact or ambiguous claims remain provisional until enough evidence accumulates.
- Dataset quality jobs periodically detect sparse neighborhoods, stale sources, weak edges, duplicate entities, and thread gaps.
- The app can refresh or rebuild its canonical data snapshot when the graph reaches a critical scale or quality threshold.

## Milestone 1: Claim-Based Data Model

Goal: make every fact auditable before trying to automate acceptance.

Tasks:

- Add first-class `SourceClaim` records.
- Add claim IDs to people, works, institutions, concepts, movements, and relationships.
- Split raw source observations from accepted atlas records.
- Represent claim status: `observed`, `candidate`, `accepted`, `rejected`, `stale`, `conflicting`.
- Track source type: reference, encyclopedia, bibliographic, primary text, institutional, citation index, curated dataset.
- Track source reliability and recency.
- Store extraction method: API field, parser, text extraction, citation graph, model-generated summary, manual seed.
- Add migration from current `sourceClaims?: string[]` edge URLs into structured claim records.

Acceptance criteria:

- An edge can show exactly which claims support it.
- A person record can distinguish accepted facts from observed source facts.
- Source gaps are computed from claim records, not just missing URLs.

## Milestone 2: Source Adapter Layer

Goal: collect evidence automatically from multiple source families.

Tasks:

- Define a shared adapter interface:
  - search entities
  - fetch entity details
  - fetch relationships
  - fetch works
  - fetch affiliations
  - fetch citations or references
  - normalize source claims
- Expand Wikidata harvesting for people, works, institutions, concepts, movements, advisors, students, employers, fields, and notable works.
- Add OpenAlex for authors, works, institutions, concepts, citations, coauthorship, and topic neighborhoods.
- Add Crossref for works, publication metadata, citations where available, and DOI-level evidence.
- Add VIAF/Library of Congress identifier capture for identity resolution.
- Add Wikipedia/DBpedia summary fallback only as low-confidence descriptive evidence.
- Add encyclopedia/manual-source adapters for stable intellectual-history references where APIs are limited.

Acceptance criteria:

- Source adapters produce normalized claim records without directly mutating canonical atlas data.
- Multiple sources can refer to the same entity through external IDs.
- The app can run source collection as a batch job.

## Milestone 3: Entity Resolution

Goal: automatically identify when source observations refer to the same underlying entity.

Tasks:

- Add canonical entity IDs separate from source-specific IDs.
- Score person matches using:
  - normalized names
  - alternate names
  - birth/death proximity
  - fields and occupations
  - external IDs
  - works
  - institutions
  - movements
- Score work matches using:
  - normalized title
  - author
  - publication date
  - DOI/ISBN/OpenAlex/Wikidata IDs
  - translated titles
- Score institution, movement, and concept matches separately.
- Add automatic merge thresholds:
  - auto-merge
  - provisional merge
  - keep separate
  - conflict
- Preserve conflicting observations instead of discarding them.

Acceptance criteria:

- Duplicate imported people are resolved before they enter the canonical graph.
- High-confidence identity matches merge automatically.
- Ambiguous matches remain provisional with explanations.

## Milestone 4: Automated Relationship Candidate Generation

Goal: generate relationship candidates from evidence, not from manual guessing.

Tasks:

- Generate direct mentorship candidates from advisor/student data.
- Generate collaboration candidates from coauthorship, correspondence, institutional overlap, and jointly authored works.
- Generate influence candidates from:
  - explicit `influenced by` source claims
  - citation/reference paths
  - named mentions in summaries or secondary sources
  - advisor/student lineage
  - work-to-work citation or reception
  - movement membership with chronology
- Generate parallel-development candidates from shared concepts without direct transmission evidence.
- Generate source-context neighbor candidates from source proximity without overclaiming influence.
- Add direction validation using chronology and source wording.
- Add edge type classification with evidence explanations.

Acceptance criteria:

- Candidate edges include evidence type, direction rationale, and confidence explanation.
- Weak contextual similarity does not become a direct influence edge.
- Relationship generation can be rerun without duplicating existing edges.

## Milestone 5: Evidence Scoring And Acceptance Policies

Goal: let the system decide what can be accepted automatically.

Tasks:

- Split confidence into separate dimensions:
  - identity confidence
  - factual confidence
  - relationship confidence
  - source quality
  - extraction confidence
  - graph consistency
- Define acceptance thresholds by claim type.
- Use stricter thresholds for:
  - direct influence
  - canonical-thread edges
  - cross-century jumps
  - high bridge-score nodes
  - disputed or sparse topics
- Use looser thresholds for:
  - basic biographical metadata
  - external IDs
  - works with stable identifiers
  - institution affiliation with direct source support
- Add automatic rejection for impossible or suspicious claims:
  - self-links
  - impossible chronology
  - duplicate opposite-direction edges without explanation
  - unsupported direct influence from shared tags alone
- Add "accepted by policy" metadata to every automatically accepted claim.

Acceptance criteria:

- The system can explain why a claim was accepted, held, or rejected.
- Acceptance thresholds are configurable and testable.
- Automatic acceptance can be run in dry-run mode.

## Milestone 6: Graph Quality Audits

Goal: detect when the graph needs automated repair.

Tasks:

- Add scheduled QA jobs for:
  - isolated nodes
  - sparse high-bridge nodes
  - unsupported edges
  - stale source claims
  - duplicate entities
  - dangling references
  - impossible dates
  - missing works
  - missing institutions
  - over-broad fields or movements
  - unbalanced thread coverage
- Add graph-level quality metrics:
  - sourced edge percentage
  - accepted edge percentage
  - average edge confidence
  - isolated node count
  - duplicate risk count
  - source freshness
  - canonical thread coverage
- Define critical thresholds that trigger automated repair jobs.

Acceptance criteria:

- Dataset QA reports identify repair targets automatically.
- Repair jobs can be triggered by quality thresholds, not manual TODO scanning.
- The app can show "graph health" without requiring a curator to inspect every node.

## Milestone 7: Automated Repair Pipelines

Goal: fix common data problems when quality thresholds are crossed.

Tasks:

- Auto-connect isolated high-confidence nodes through validated relationship candidates.
- Auto-demote weak unsupported edges to provisional status.
- Auto-add missing source claims for accepted edges when reliable sources are found.
- Auto-merge duplicate entities above threshold.
- Auto-reclassify edge types when evidence is stronger for mentorship, collaboration, parallel development, or context neighbor.
- Auto-refresh stale source records.
- Auto-fill missing works, fields, institutions, and movements when source agreement is high.
- Keep a repair log with before/after diffs.

Acceptance criteria:

- Repair jobs produce deterministic diffs.
- Every automated repair is reversible.
- The system can improve graph health metrics without human review.

## Milestone 8: Canonical Dataset Build Pipeline

Goal: move canonical data generation out of the browser and into repeatable build jobs.

Tasks:

- Create a source-observation store outside localStorage.
- Create a canonical dataset generator.
- Add pipeline steps:
  - collect source observations
  - resolve entities
  - score claims
  - accept/reject/provision claims
  - generate canonical people/works/concepts/institutions/movements
  - generate canonical relationships
  - run QA audits
  - emit dataset snapshot
- Add deterministic snapshot output for `src/data.ts` or a generated data bundle.
- Add CI checks that fail on severe data regressions.
- Add changelog generation for data changes.

Acceptance criteria:

- The canonical dataset can be regenerated from source observations.
- Browser-local import becomes optional rather than central.
- Data updates can be reviewed as generated diffs.

## Milestone 9: Autonomous Discovery

Goal: grow the graph without manual search queries.

Tasks:

- Seed discovery from:
  - sparse graph neighborhoods
  - canonical thread gaps
  - high-impact works
  - citation neighborhoods
  - missing advisors/students
  - movement/institution rosters
  - concept clusters
- Add expansion policies:
  - breadth-limited field expansion
  - era-balanced expansion
  - source-quality-first expansion
  - thread-gap expansion
  - bridge-score expansion
- Add stopping conditions:
  - no reliable source agreement
  - duplicate risk too high
  - low relevance to atlas scope
  - graph quality regression
- Add queued automated discovery jobs with dry-run summaries.

Acceptance criteria:

- The system can propose and validate new nodes without a user entering names.
- Expansion is bounded by policy and graph-health metrics.
- New additions arrive with sources and relationship context.

## Milestone 10: Retire Manual Import As The Default

Goal: replace the import workbench with monitoring, audit, and override tools.

Tasks:

- Convert Source Studio from import/review UI into automation monitoring.
- Replace manual candidate import with:
  - pipeline status
  - source adapter health
  - graph health
  - repair log
  - accepted/rejected claim stream
  - override tools for unusual cases
- Keep manual entry only as an expert escape hatch.
- Add "why is this here?" explanations for every generated node and edge.
- Add "challenge this claim" workflows for users to flag bad automated decisions.

Acceptance criteria:

- Routine graph growth no longer requires manual import.
- Users inspect automation outcomes rather than hand-curating every candidate.
- The app remains trustworthy because every automated decision is explainable.

## Near-Term Task Sequence

1. Add structured `SourceClaim` types.
2. Migrate current edge `sourceClaims` URLs into structured claims.
3. Add adapter result normalization for Wikidata.
4. Add identity-resolution scoring for people.
5. Add relationship candidate records separate from accepted edges.
6. Add evidence scoring tests.
7. Add dry-run automated edge validation report.
8. Add graph health metrics to the QA report.
9. Add repair-job diff output.
10. Move Source Studio toward automation status and override controls.

## Risks

- Source APIs may disagree or omit intellectual-history relationships.
- Citation proximity can overstate influence.
- Model-generated summaries can hallucinate unless constrained by source claims.
- Automated merging can erase meaningful historical ambiguity.
- Over-automation can make the graph look more certain than the evidence supports.

Mitigations:

- Keep raw observations separate from accepted data.
- Require claim-level provenance.
- Use conservative thresholds for direct influence.
- Store conflicts explicitly.
- Keep every automated mutation reversible.
- Add tests for chronology, source support, duplicate risk, and edge-type overclaiming.

