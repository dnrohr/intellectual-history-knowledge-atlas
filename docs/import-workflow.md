# Import Workflow Guide

Use the Import workbench to stage external people before they become atlas nodes. The queue is intentionally review-first: candidates can be searched, pasted, edited, linked, skipped, or merged.

## Single Candidate Search

1. Open the **Import** activity.
2. Search Wikidata by name.
3. Review the top candidates, dates, fields, works, descriptions, and source links.
4. Select a candidate to fill the draft form.
5. Edit sparse or misleading metadata.
6. Accept the draft when the name and birth year are valid.

Wikidata candidates are suggestions, not authoritative records.

## Batch Search

Paste names separated by commas or new lines, then use **Find**. The app searches each name and lists the top candidate with confidence labels.

Use **Queue Ready** only after checking duplicate and confidence labels. Lower-confidence rows should usually be edited before acceptance.

## Batch Paste Rows

Use this format for quick manual queueing:

```text
name | birth | death | field | notes
```

Rules:

- `name` and `birth` are required.
- `death` may be blank.
- `field` should match an existing taxonomy field when possible.
- `notes` should include provenance or a short reason the person belongs in the atlas.

Each valid row becomes an import review item.

## Review Queue

Queue items show confidence, duplicate state, source gaps, and suggested relationship links.

Recommended review order:

1. Clear or merge duplicates.
2. Edit sparse records.
3. Accept high-confidence candidates without over-linking.
4. Use **Accept + Link** only when the suggested relationship makes sense.
5. Review newly created suggested edges later in the curation workbench.

## Duplicate Handling

If a queue item matches an existing thinker, prefer **Merge metadata** over creating a new person. Merging preserves useful fields, topics, works, and notes while keeping the atlas graph cleaner.

## Suggested Links

Suggested links are generated from chronology, shared fields, topics, works, movements, and external relationship signals. They are navigation aids until reviewed.

Use **Accept + Link** when:

- the suggested person is historically plausible,
- the relationship type is not overstated,
- the note explains the link clearly,
- the edge can be reviewed later for sources.

## Export And Restore

Use **Export JSON** before major import sessions or before moving between local, Codespaces, and hosted environments. Use **Restore JSON** to load that state elsewhere.

JSON restore replaces local atlas state, import queues, audit logs, link review queues, confidence threshold, and rejected suggestion keys.

## Promoting Imports Into Seed Data

Local accepted imports live in browser storage. To make a durable repository change:

1. Add the reviewed thinker to `src/data.ts`.
2. Add important explicit edges with notes and source claims.
3. Update canonical threads when the person belongs in a curated path.
4. Run `npm run qa:data`, `npm test`, `npm run lint`, and `npm run build`.

## Nobel and Fields Medal Batch

The Nobel/Fields pipeline is a reproducible repository import, not a browser queue operation. Run `npm run import:laureates` to rebuild the checked-in roster, duplicate report, relationship candidates, and canonical person projection from the official Nobel Prize and IMU sources.

Review `data/laureates/duplicate-resolution.json` before accepting identity changes. Relationship candidates remain outside canonical edges until a curator verifies the explicit adviser, student, or influence claim. Shared award status and co-laureate status are never sufficient evidence. Full details are in [Nobel and Fields Medal Import](laureate-import.md).
