# Intellectual History Knowledge Atlas

An interactive atlas for exploring thinkers, timelines, influence relationships, topics, curated intellectual threads, and externally sourced import candidates.

The app is designed for iterative curation. It starts from the bundled dataset in `src/data.ts`, lets you add or review local changes in the browser, and stores those browser-side changes in `localStorage`.

## What You Can Do

- Explore thinkers by timeline, graph neighborhood, field, era, region, topic, and search.
- Select a thinker to inspect works, notes, tags, relationships, and related people.
- Follow curated intellectual threads one step at a time.
- Find directed relationship paths between two thinkers.
- Add thinkers and relationships manually.
- Import people from Wikidata through the local Express backend.
- Review import candidates, duplicates, suggested links, and sparse graph neighborhoods.
- Run a dataset QA report for field/era coverage, isolated people, sparse high-bridge thinkers, and conflicting explicit edges.

## Requirements

- Node.js 20 or newer.
- npm.
- Network access for Wikidata import lookup.

No credentials are required for the current local app and Wikidata search flow.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dev server runs the Express backend and Vite frontend from `server.ts`.

## Run In GitHub Codespaces

1. Open the repository on GitHub.
2. Choose **Code** -> **Codespaces** -> **Create codespace on main**.
3. Wait for dependencies to install.
4. Run:

```bash
npm run dev
```

Codespaces will forward port `3000`. Open the forwarded URL to use the app.

## Production Build

```bash
npm run build
npm run start
```

`npm run build` produces:

- `dist/` Vite frontend assets.
- `dist/server.cjs` bundled Express server.

The build currently emits a Vite chunk-size warning because the main frontend bundle is large. This is a warning, not a failed build.

## Useful Commands

```bash
npm run dev       # Start local development server
npm run lint      # TypeScript check
npm run build     # Build frontend and server
npm run start     # Serve the production build
npm run qa:data   # Print dataset QA report
npm run clean     # Remove generated build outputs
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
```

## Data Persistence

The app persists local browser edits in `localStorage`.

Important keys include:

- `atlas_people_v6`: current local thinker records.
- `atlas_edges_v6`: current local relationship edges.
- `atlas_import_queue_v2`: staged import review queue.
- `atlas_import_audit_log_v1`: import review history.
- `atlas_link_review_queue_v1`: queued relationship suggestions.
- `atlas_rejected_link_suggestions_v1`: rejected link suggestions.

Use the app's reset control if you want to restore the bundled seed dataset. Resetting clears local people, edges, import queues, audit logs, rejected suggestions, and link review queues.

## Main Interface

The app has three primary exploration surfaces:

- **Timeline**: shows people by date, era bands, works, movements, and relationship arcs.
- **Network graph**: shows the selected person and nearby relationship neighborhood.
- **Detail panel**: shows the selected person's metadata, works, tags, and relationships.

Select a thinker from the timeline, graph, index, search results, thread stepper, path finder, or review lists to focus the app.

## Search And Filters

Use the top search input to filter people by name, works, notes, field, region, era, and tags.

The filter drawer supports:

- Field/domain filters.
- Subfield/topic filters.
- Lens tags inferred from fields, notes, works, and imported source text.
- Era filters.
- Region filters.
- Year range filters.

Filtering affects the visible people in the main timeline and graph surfaces.

## Timeline

The timeline is useful for historical placement and lineage inspection.

Common controls include:

- Toggle movements, relationship edges, works, labels, and events.
- Use linear or log-style scaling.
- Pan and zoom through the historical range.
- Select a person to highlight incoming and outgoing relationship arcs.
- Follow highlighted relationship paths from Path Finder or curated threads.

## Network Graph

The graph focuses on relationship neighborhoods. It highlights:

- The selected thinker.
- Incoming and outgoing explicit edges.
- Highlighted path or thread steps.
- Important bridge figures.

The focus depth control changes how much of the selected thinker's surrounding network is visible.

## Detail Panel

The detail panel is the main curation surface for a selected thinker. It shows:

- Core biographical metadata.
- Field, subfield, era, region, movement, and bridge score.
- Works and notes.
- Relationship lists.
- Topic and lens tags.
- Source/review information where available.

From the detail panel and surrounding controls you can add relationships, edit tags, inspect sparse neighborhoods, and jump to related people.

## Path Finder

Open Path Finder to search for a directed relationship path between two thinkers.

Paths follow explicit directed relationship edges from source to target. When a path is found, the timeline and graph highlight each step.

## Curated Threads

Curated threads live in `src/threads.ts` as `CANONICAL_THREADS`.

Each thread contains:

- `id`
- `title`
- `field`
- `purpose`
- ordered `people`
- carried-forward `concepts`
- expected `edgeTypes`
- confidence level

The thread viewer lets you step through a chain one relationship at a time. Thread cards also report:

- missing people
- edge gaps
- weak edges

Use this to audit whether an intellectual lineage is well-supported or still needs intermediate figures and better source claims.

## Workbench

The Workbench groups review and curation tasks into tabs.

### Links

Use link review to inspect suggested relationships. Suggestions may be categorized as:

- likely influence
- direct mentorship
- collaboration
- parallel development
- source-context neighbor
- needs review

You can accept or reject suggestions. Rejected pairs are stored so they are not immediately suggested again.

### Tags

Use tag review to inspect inferred topics and lens tags for a selected thinker.

Tags are derived from fields, subfields, works, notes, and imported source descriptions. They help filtering and topic grouping.

### Imports

Use import review to stage, edit, accept, merge, skip, or clear imported people.

Queued import items can have statuses:

- `queued`
- `edited`
- `accepted`
- `skipped`
- `duplicate`

The queue also uses confidence thresholds and quality labels to identify ready, duplicate, sparse, or source-gap candidates.

### Duplicates

Duplicate detection compares candidates and existing thinkers by:

- normalized name
- alternate names
- birth/death proximity
- Wikidata/source URL
- works
- movement

Duplicate candidates can be inspected and merged into the existing thinker record.

## Wikidata Import

The local backend exposes:

```text
GET /api/import/wikidata/search?q=<query>
```

The app uses this endpoint to search Wikidata and normalize candidate people into local import drafts.

Imported candidates can include:

- name
- birth/death years
- description
- fields and occupations
- region
- notable works
- movement
- Wikidata entity URL
- Wikipedia URL when available
- influenced by
- advisors/students
- employers and education
- member-of movement or organization signals

Wikidata candidates are not automatically authoritative. Review them before accepting.

## Manual Imports

Manual import supports adding a thinker with:

- name
- birth/death
- field
- region
- movement
- works
- notes
- source URL
- topic tags

Manual and edited imports infer era from birth year when possible.

## Batch Paste

The import workbench supports batch paste in this format:

```text
name | birth | death | field | notes
```

Each valid line becomes an import review item. Use this for quick queueing before reviewing links and tags.

## Adding Relationships

Relationships are stored as `InfluenceEdge` records:

```ts
{
  source: string;
  target: string;
  type: string;
  strength: number;
  note?: string | null;
  confidence?: number;
  sourceClaims?: string[];
  status?: "suggested" | "accepted" | "rejected" | "needs_source";
}
```

Common relationship types include:

- `Influence`
- `Indirect influence`
- `Mentorship`
- `Collaboration`
- `Parallel`
- `Rivalry`
- `Suggested relationship`

Use specific types where possible. Broad influence edges are useful, but mentorship, collaboration, parallel development, and source-context neighbor edges are easier to audit.

## Dataset QA Report

Run:

```bash
npm run qa:data
```

The report prints:

- total people
- explicit edge count
- canonical thread count
- field-by-field isolated people
- people with only metadata-derived edges
- high bridge-score people with too few explicit edges
- duplicate or conflicting explicit edges
- thread coverage by field
- thread coverage by era
- missing people referenced by canonical threads

This is the best current tool for deciding the next dataset cleanup batch.

## Source And Review Status

Some edges carry `sourceClaims`, usually source URLs. Edges can also carry a status:

- `suggested`
- `accepted`
- `rejected`
- `needs_source`

Thread gap audits treat edges with missing source claims as weak. This does not mean the relationship is false; it means the atlas needs better provenance before treating it as high confidence.

## Data Files

Primary data and model files:

- `src/data.ts`: bundled thinkers, explicit edges, movements, institutions, and derived metadata edges.
- `src/threads.ts`: canonical thread seed file.
- `src/types.ts`: TypeScript interfaces.
- `src/taxonomy.ts`: domains, topic groups, and lens-tag inference.
- `src/externalSources.ts`: external source definitions.
- `scripts/datasetQaReport.ts`: dataset audit report.

## Development Notes

- Keep data changes small and reviewable.
- Run `npm run lint` and `npm run build` before committing.
- Run `npm run qa:data` after dataset or thread changes.
- Prefer adding explicit edges with meaningful notes over relying only on `influenced` metadata.
- If a thread references a person ID, make sure that person exists in `src/data.ts`.
- Use `TODO.md` status markers to keep roadmap progress visible.

## Known Gaps

- The expanded first-class data model for works, concepts, institutions, source claims, and typed relationships is still in progress.
- Many accepted or seed relationships still need source claims.
- The main frontend bundle is large and needs code splitting.
- Full automated browser tests are not configured yet.
- Production deployment is not configured yet.
