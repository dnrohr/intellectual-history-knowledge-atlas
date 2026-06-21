# Workspace Redesign Handoff

This is the implementation handoff for simplifying the Atlas, Timeline, Sources, and Focus workspaces. It is intentionally self-contained so another agent can continue without reading the prior conversation.

This document supersedes the timeline-strip recommendation in `docs/ui-redesign.md`. Keep that document for broader design context, but implement the four-workspace model below.

## Product Decision

Use four top-level workspaces:

1. **Atlas**: spatial network exploration.
2. **Timeline**: chronological exploration.
3. **Sources**: evidence, review, import, repair, and recovery work.
4. **Focus**: a selected scholar's network plus dossier.

Focus is currently the strongest workspace. Preserve its basic composition. Atlas and Sources currently show too many competing surfaces at once. Do not solve that primarily with page-level scrolling.

## Current State

- The application is a React/Vite app centered in `src/App.tsx`.
- `Workspace` is currently `"atlas" | "sources" | "focus"` near the top of `src/App.tsx`.
- `viewMode` currently carries `"timeline" | "network" | "split"`.
- Atlas currently combines a relationship toolbar, selected-person context, connection radar, network, timeline strip, path finder, and dossier.
- Sources currently combines Source Studio, connection radar, network, path finder, and dossier.
- Focus currently combines the network and dossier and should remain substantially intact.
- Closing the dossier preserves the selected scholar and exposes a reopen control.
- `NetworkGraph` observes its container and resizes when the dossier opens or closes.
- Network labels are always enabled; the label-density toolbar has been removed.
- The graph's hop, clustering, and layout controls are left-aligned.
- The development server normally runs at `http://127.0.0.1:3000`.

Important files:

- `src/App.tsx`: workspace state, navigation, layout, Source Studio, timeline composition, and dossier.
- `src/components/NetworkGraph.tsx`: network canvas and controls.
- `src/components/Timeline.tsx`: timeline canvas and controls.
- `src/components/DetailPanel.tsx`: scholar dossier content.
- `tests/e2e/network-controls.spec.ts`
- `tests/e2e/timeline.spec.ts`
- `tests/e2e/source-studio-modes.spec.ts`
- `tests/e2e/dossier-recovery.spec.ts`
- `docs/ui-redesign.md`: earlier design context.

## Repository Safety

The shared worktree currently contains unrelated local work. At the time of this handoff it includes changes such as:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.expo/`
- local QA reports and scratch scripts

Do not stage, revert, delete, or rewrite those files unless the user explicitly asks. Always stage explicit paths. Never use `git add .`.

Before each feature:

```powershell
git switch main
git fetch origin
git status --short
git log -3 --oneline
```

If `origin/main` advanced, integrate it without discarding local work. Avoid destructive reset or checkout commands.

## Required Delivery Loop

Treat every phase below as a separate major feature. Complete the entire loop before beginning the next phase:

1. Implement only that phase.
2. Update this document with decisions, deviations, and completed acceptance criteria.
3. Update any affected product documentation, especially `docs/ui-redesign.md`.
4. Add or update focused unit and Playwright coverage.
5. Run the required validation commands.
6. Inspect desktop and narrow screenshots.
7. Stage only the files belonging to the feature.
8. Commit the feature with a focused message.
9. Push the commit directly to `main`.
10. Confirm local `HEAD` and `origin/main` match before starting the next phase.

Suggested verification after each push:

```powershell
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Do not combine multiple phases into one large commit. Do not leave completed work only on a feature branch.

## Feature 1: Promote Timeline

### Goal

Make Timeline a top-level workspace beside Atlas, Sources, and Focus. Remove duplicated timeline surfaces from Atlas.

### Implementation

- Extend `Workspace` to include `"timeline"`.
- Add Timeline to desktop and mobile workspace navigation.
- Give Timeline the full workspace height beneath global navigation.
- Reuse the existing `Timeline` component and its controls.
- Preserve selected scholar, filters, date range, bookmarks, and coordinated selection when switching workspaces.
- Selecting a scholar in Timeline should update the global selection and make the dossier available.
- Remove the Atlas timeline strip and its expand/collapse state.
- Remove `split` as an Atlas view.
- Remove the timeline option from the Atlas lens switcher and graph layout controls where it duplicates the dedicated workspace. Keep a graph-projected timeline layout only if it is clearly labeled as a network layout and demonstrably useful.
- Migrate saved views safely. Old saved `timeline` views should open the Timeline workspace. Old `split` views should open Atlas or be normalized to a supported workspace.

### Acceptance Criteria

- Top navigation reads `Atlas | Timeline | Sources | Focus`.
- Timeline has a full-height usable canvas at desktop and narrow widths.
- Atlas no longer contains a timeline strip or split view.
- Timeline selection and dossier recovery work.
- Existing saved local views do not crash the app.
- No horizontal document overflow at 820px.

### Tests

- Update `tests/e2e/timeline.spec.ts` to enter the top-level Timeline workspace.
- Add coverage for selection persistence while moving between Atlas, Timeline, and Focus.
- Add migration coverage for old `viewMode` values if saved-view parsing changes.

### Documentation And Commit

- Update the workspace and state-model sections of `docs/ui-redesign.md`.
- Mark Feature 1 complete in the progress log below.
- Suggested commit: `Promote timeline to a dedicated workspace`.
- Push to `origin/main` before Feature 2.

## Feature 2: Make Sources Standalone

### Goal

Make Source Studio the sole primary surface in Sources. Remove exploration surfaces that compete with the administrative workflow.

### Implementation

- In Sources, render Source Studio as the full-height workspace.
- Remove the full network, path finder, scholar dossier, and connection radar from the default Sources composition.
- Preserve the selected scholar as a compact context row when relevant.
- Add a clear `View in Focus` or `Open in Atlas` command from source, candidate, conflict, and edge contexts.
- Keep Source Studio tabs sticky while their content scrolls internally.
- Use internal panel scrolling for long queues, conflict feeds, repair previews, and canonical threads.
- Retain existing mutation behavior, undo behavior, audit logging, and local persistence.
- Do not turn Sources into a marketing dashboard. It should remain dense, quiet, and operational.

### Acceptance Criteria

- No graph or dossier is visible underneath Source Studio.
- The entire viewport is available to Source Studio.
- Long feeds are reachable through internal scrolling.
- Selected-person context can navigate back to Atlas or Focus.
- Existing candidate acceptance, source review, conflict, repair, and export flows still work.
- No horizontal document overflow at 820px.

### Tests

- Update `tests/e2e/source-studio-modes.spec.ts` for the standalone layout.
- Assert the network canvas and dossier are absent in Sources.
- Exercise every Source Studio tab at desktop and narrow widths.
- Preserve existing batch-import coverage.

### Documentation And Commit

- Update the Source Studio layout section of `docs/ui-redesign.md`.
- Mark Feature 2 complete in the progress log.
- Suggested commit: `Make Source Studio a standalone workspace`.
- Push to `origin/main` before Feature 3.

## Feature 3: Simplify Atlas

### Goal

Make Atlas a clear network exploration workspace rather than a stack of network, relationship, recommendation, timeline, path, and dossier surfaces.

### Implementation

- Give the network the full available workspace height.
- Replace the large relationship toolbar and selected-scholar context bands with one compact contextual toolbar.
- Keep high-frequency exploration commands visible: neighborhood depth, lineage, bridge/path entry, and filters.
- Move lower-frequency relationship tools into a menu, drawer, or dossier context tab.
- Move Connection Radar into a collapsible contextual panel or the dossier's Context tab.
- Keep Path Finder closed until explicitly invoked.
- Keep the dossier optional and preserve the current close/reopen behavior.
- Keep the network responsive when drawers open or close.
- Avoid adding page-level scrolling to compensate for stacked fixed panels.

### Acceptance Criteria

- Network is the unmistakable primary surface.
- Atlas has no timeline, Source Studio, or permanently expanded recommendation surface.
- Dossier can open, close, and reopen without losing selection or graph dimensions.
- Primary exploration commands remain reachable without overflowing at 820px.
- The default Atlas view has substantially less vertical chrome than the current version.

### Tests

- Extend `tests/e2e/network-controls.spec.ts` for the simplified toolbar.
- Keep and extend `tests/e2e/dossier-recovery.spec.ts`.
- Add an assertion that the Atlas network receives most of the workspace height.
- Add path-finder open/close coverage if its trigger moves.

### Documentation And Commit

- Update the Influence Atlas layout and panel sections of `docs/ui-redesign.md`.
- Mark Feature 3 complete in the progress log.
- Suggested commit: `Simplify the Atlas exploration workspace`.
- Push to `origin/main` before Feature 4.

## Feature 4: Responsive Workspace Behavior

### Goal

Ensure each workspace has one primary surface at narrow widths and that secondary content appears as intentional drawers or sheets.

### Implementation

- Atlas and Timeline remain viewport-bound rather than relying on whole-page scrolling.
- Sources uses an internally scrolling workspace.
- Focus preserves its current two-column desktop composition.
- At narrow widths, dossiers become dismissible bottom sheets with stable open and close controls.
- Filters and index become temporary overlays.
- Secondary toolbars collapse into menus before the primary canvas loses usable space.
- Ensure fixed footers and bottom sheets do not cover required controls.

### Acceptance Criteria

- Desktop: verify at 1440x900.
- Tablet/narrow: verify at 820x844.
- Mobile: verify at 390x844.
- No incoherent overlap, inaccessible controls, or document-level horizontal overflow.
- Text remains inside buttons and panels.
- Canvas and timeline remain nonblank and correctly sized after panel transitions.

### Tests

- Add viewport coverage for all four workspaces.
- Test dossier open/closed states on desktop and mobile.
- Test source scrolling and timeline interaction at narrow widths.
- Use screenshots for visual QA; inspect them rather than only checking test exit codes.

### Documentation And Commit

- Update responsive behavior in `docs/ui-redesign.md`.
- Mark Feature 4 complete in the progress log.
- Suggested commit: `Refine responsive workspace layouts`.
- Push to `origin/main`.

## Validation Commands

Run after every major feature:

```powershell
npm run lint
npm test
npm run qa:canonical
npm run qa:edges
npm run build
npm run test:e2e
```

If the full Playwright suite experiences a resource timeout, rerun the failed test with `--workers=1`. Fix genuine selector or behavior regressions; do not simply increase timeouts without understanding the cause.

The canonical dataset currently has 689 thinkers and 753 edges. Treat unexpected count changes as a reason to inspect the diff.

## Visual Review Checklist

For every workspace at 1440x900, 820x844, and 390x844:

- Is there one obvious primary task and surface?
- Does global navigation stay stable?
- Are workspace-specific controls grouped together?
- Does any secondary panel cover required controls?
- Does closing a panel return space to the primary visualization?
- Is scrolling contained within the surface that owns the long content?
- Is there document-level horizontal overflow?
- Can the selected scholar always be recovered in Focus or the dossier?

## Progress Log

Update this section in the same commit as each feature.

- [x] Feature 1: Promote Timeline
  - Timeline is now a full-height top-level workspace. Atlas no longer exposes timeline or split lens controls, and legacy saved timeline views route to Timeline while split views render as Atlas network views.
- [ ] Feature 2: Make Sources standalone
- [ ] Feature 3: Simplify Atlas
- [ ] Feature 4: Responsive workspace behavior

Record material deviations beneath the relevant item, including the reason and any follow-up work.

## Final Product Shape

- **Atlas** answers: “How are these people and ideas connected?”
- **Timeline** answers: “When did these people, works, and movements overlap?”
- **Sources** answers: “What evidence supports the data, and what needs review?”
- **Focus** answers: “Who is this scholar, and what is their immediate intellectual neighborhood?”

Do not let one workspace absorb another workspace's primary job. That separation is the central design constraint for this redesign.
