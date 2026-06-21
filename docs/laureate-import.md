# Nobel and Fields Medal Import

The laureate import adds Nobel laureates in Physics, Chemistry, and Physiology or Medicine and all Fields Medal recipients listed by the International Mathematical Union. Nobel Peace, Literature, and Economic Sciences awards are excluded.

## Sources and generated artifacts

The importer uses:

- the [official Nobel Prize API](https://api.nobelprize.org/2.1/laureates?limit=2000) for Nobel identity, biographical metadata, award category/year, motivation, official facts URLs, and Wikidata IDs;
- the [IMU Fields Medal roster](https://www.mathunion.org/imu-awards/fields-medal) for medalist names, award years, and declined status;
- Wikidata entity records for stable cross-source identity, Fields Medal birth/death metadata, nationality/field enrichment, and explicit relationship claims.

Generated files are:

- `data/laureates/roster.json`: one record per Wikidata person, with all included award occurrences and field-level provenance;
- `data/laureates/duplicate-resolution.json`: existing-node matches, new-node totals, and repeat-laureate consolidation decisions;
- `data/laureates/relationship-candidates.json`: review-only adviser, student, and documented influence candidates;
- `src/generatedLaureates.ts`: the canonical graph-node projection and typed roster used by the application.

The generated artifacts are checked in so builds do not depend on network access.

## Regeneration

From the repository root, run:

```bash
npm run import:laureates
```

The command fetches current official data, resolves identities, rewrites all four artifacts, and prints record/match/candidate totals. Review the diff whenever an upstream source changes. The generator sorts identities and edges and omits run timestamps, so identical source responses produce identical artifacts.

## Matching and identifiers

Award occurrences are deduplicated by Wikidata QID. This preserves multiple award/category/year entries on a single person record. Existing atlas people are matched before node creation:

1. normalized full name plus compatible birth year;
2. as a conservative fallback, equal birth year and surname plus at least one additional shared name token.

The fallback handles official middle initials and shortened atlas names without merging same-year/same-surname people such as Kenneth G. Wilson and Robert Woodrow Wilson. Every decision is recorded in the duplicate-resolution report.

Unmatched people receive `laureate_q…` IDs derived only from the stable Wikidata QID. Display-name changes therefore do not change canonical identifiers.

## Relationship review workflow

Receiving the same prize is never relationship evidence. The importer considers only explicit Wikidata statements:

- `P184` doctoral adviser;
- `P185` doctoral student;
- `P802` student;
- `P737` influenced by.

Candidates remain `suggested` in the review artifact and are not promoted automatically into canonical edges. Each contains its property, source entity URL, claim summary, confidence, and review note. A curator must inspect the cited statement and preferably confirm it with an institutional or scholarly source before adding an accepted canonical edge.

## Validation and review

Run:

```bash
npm run qa:data
npm run qa:canonical
npm run qa:edges
npm test
npm run lint
npm run build
```

Before committing, inspect the duplicate-resolution report, invalid birth/death ordering, empty official source URLs, unexpected categories, new taxonomy values, and every relationship promoted from the candidate file. The import tests explicitly cover category inclusion/exclusion, Fields ingestion, repeat winners, matching, identifier stability, provenance, and rejection of unsupported co-laureate edges.
