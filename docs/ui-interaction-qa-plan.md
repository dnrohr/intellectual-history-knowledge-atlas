# UI Interaction QA Plan

This plan targets failures that are easy to miss in a canvas-heavy interface: controls that appear active but do not change state, overlays that intercept drag/click events, and graph content that drifts outside the usable viewport.

## Regression Areas

1. **Control state**
   - Every segmented control should expose a stable `data-testid`.
   - Tests should click every option and assert the active state changes.
   - Controls whose options alter visible data should also assert a behavioral result, not only a CSS class.

2. **Overlay hit boxes**
   - Floating toolbars should have bounded widths.
   - Test toolbar bounding boxes against viewport size.
   - Avoid full-width invisible overlay bands unless the whole band is intentionally interactive.

3. **Canvas usability**
   - Canvas should remain visible and interactive after mode changes.
   - Dragging nodes should not pin them behind toolbars or outside the viewport.
   - Recenter/reset controls should return the graph to a usable view.

4. **Responsive layouts**
   - Run key interaction tests at desktop, tablet, and mobile widths.
   - Mobile command sheets and bottom sheets should not trap or hide primary controls.
   - One primary workspace should remain usable at all breakpoints.

## Automated Coverage To Maintain

- `tests/e2e/network-controls.spec.ts`
  - hop depth buttons
  - graph layout buttons
  - label-density buttons
  - compact layout-toolbar width

- Existing timeline tests
  - panning the visible timeline surface
  - full timeline lens behavior after the Atlas timeline strip opens

- Existing import tests
  - Source Studio workspace navigation
  - Import tab queueing and acceptance flows

## Manual Smoke Pass

Run after any major UI layout change:

1. Open the app at desktop width.
2. Confirm Atlas opens to the network canvas.
3. Click `1 hop`, `2 hop`, `3 hop`, and `All`; verify the node count and visible neighborhood update.
4. Click `Force`, `Timeline`, `Ego`, and `Lineage`; verify each layout visibly changes the graph.
5. Click `Focus`, `Key`, `More`, and `All`; verify label density changes.
6. Drag a node toward each edge of the canvas; verify it remains selectable and visible.
7. Pan and zoom the background; verify no toolbar-sized dead area blocks canvas interaction.
8. Open Source Studio; verify import/export/review controls are not visible in Atlas.
9. Repeat at a narrow mobile viewport; verify the command menu opens as a sheet and the dossier as a bottom sheet.

## Implementation Rules

- New controls get `data-testid` values when they are stateful or user-critical.
- Overlay containers should be content-sized by default.
- Canvas nodes should be clamped to a padded viewport when simulation ticks or drag pins update positions.
- E2E tests should prefer behavior assertions over snapshots, but use screenshots when checking layout overlap.
- If a visual control changes only CSS state, add a minimal DOM state hook or label that tests can observe.

