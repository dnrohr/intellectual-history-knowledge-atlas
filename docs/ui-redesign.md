# UI Redesign: Four Focused Workspaces

> Implemented model: global navigation is `Atlas | Timeline | Sources | Focus`. Timeline is a full-height workspace, not an Atlas strip or split lens. Atlas owns spatial network exploration; Timeline owns chronological exploration; Sources owns evidence operations; Focus owns the selected scholar's network and dossier. Legacy saved timeline views open Timeline and legacy split views normalize to the Atlas network.

This document describes a full interface rethink for the Intellectual History Knowledge Atlas. It responds to the current clutter problem by separating the primary exploration experience from source, import, export, and data-management work.

The core product should feel like two connected experiences:

- **Influence Atlas**: the main user experience for exploring the network of thinkers.
- **Source Studio**: a separate workspace for importing, exporting, connecting, auditing, and repairing data.

The Influence Atlas should be usable without seeing source-management controls. Source Studio should remain available, but it should no longer compete with the graph, timeline, or scholar dossier for screen space.

## Design Goals

1. Make the influence network view the primary canvas.
2. Make the scholar dossier card the primary reading and decision surface.
3. Move imports, exports, source review, duplicate review, and bulk data operations into a separate Source Studio.
4. Keep only the controls required for the current activity visible.
5. Make every visible button have one clear job.
6. Avoid overlapping functionality between graph controls, timeline controls, dossier controls, and curation tools.
7. Preserve mobile intuition: one main surface, one focused sheet, clear back/close controls, and optional tools in drawers.

## Product Model

The app should have three top-level workspaces, not many competing modes.

### 1. Influence Atlas

The default workspace.

Primary purpose:

- Browse intellectual relationships.
- Select a thinker.
- Read the selected scholar dossier.
- Follow influence, mentorship, collaboration, and contextual-neighbor edges.
- Trace paths and threads.

Visible by default:

- Network canvas.
- Search/focus control.
- Compact view switcher for network/timeline/thread.
- Selected scholar dossier card or a collapsed dossier handle.
- A small action button for contextual tools.

Hidden by default:

- Import queue.
- CSV/JSON controls.
- Source provider list.
- Duplicate review.
- Edge source filters unless the user enters source inspection.
- Bulk accept/reject controls.

### 2. Source Studio

Separate workspace for data acquisition and provenance.

Primary purpose:

- Import people and relationship candidates.
- Export or restore atlas data.
- Review source gaps.
- Merge duplicates.
- Audit relationship confidence.
- Manage source providers.

Visible by default:

- Source Studio navigation tabs: `Import`, `Review`, `Sources`, `Export`.
- Current queue or audit list.
- Candidate detail panel.
- Source/provenance metadata.

Hidden from Influence Atlas:

- All batch import controls.
- All file import/export controls.
- Source provider cards.
- Import audit log.
- Duplicate merge controls.

### 3. Presentation / Focus View

Minimal chrome view for reading, teaching, screenshots, and uncluttered exploration.

Primary purpose:

- Explore selected network or timeline without editing tools.
- Show a single thread, person, or neighborhood.

Visible by default:

- Canvas.
- Selected title/focus chip.
- Small close/exit control.
- Optional dossier peek.

Hidden by default:

- Index.
- Filters.
- Workbench.
- Source Studio.
- Manual edit controls.

## Global Navigation

Replace the current activity-heavy header with a simple workspace switcher.

### Top Bar

Always visible on desktop:

- App title or compact logo.
- Search / command input.
- Workspace switcher: `Atlas`, `Sources`, `Focus`.
- Current selection chip when a thinker is selected.
- Overflow menu.

Always visible on mobile:

- Search icon or compact search input.
- Current workspace title.
- Current selection chip when selected.
- Menu button.

### Buttons

| Button | Location | Behavior |
| --- | --- | --- |
| `Atlas` | Workspace switcher | Opens the network-first exploration workspace. Does not show import/export/source controls. |
| `Sources` | Workspace switcher | Opens Source Studio. Remembers the last Source Studio tab. |
| `Focus` | Workspace switcher | Opens minimal presentation/focus view around the current selected thinker or visible network. |
| Search | Top bar | Finds thinkers, works, movements, concepts, fields, and saved views. Selecting a result focuses the Atlas workspace. |
| Selection chip | Top bar | Opens or restores the scholar dossier card. |
| Overflow menu | Top bar | Contains lower-frequency actions: saved views, reset local data, keyboard shortcuts, help/docs, public demo status. |

## Influence Atlas Layout

Implemented composition: the network is the dominant surface. A single compact context toolbar exposes neighborhood, inbound/outbound lineage, bridge/path, filters, and an on-demand `Context` panel. The selected-scholar band and permanently expanded Connection Radar have been removed; the dossier remains optional and recovers without losing selection.

The Atlas should treat the network canvas as the primary surface.

### Desktop Layout

Default:

- Main area: full-height network canvas.
- Right side: scholar dossier drawer, closed until a thinker is selected.
- Bottom or lower-left: compact timeline strip, collapsed by default.
- Left side: hidden index drawer, opened by search results or an index button.
- Floating toolbar: network lens controls.

When a thinker is selected:

- Network centers on the thinker.
- Dossier opens to a readable width.
- Timeline strip shows the selected thinker's lifespan, immediate predecessors, and successors.
- Quick actions appear near the dossier header, not scattered across the whole UI.

### Tablet Layout

- One main canvas at a time.
- Dossier appears as a right slide-over.
- Timeline appears as a bottom drawer.
- Filters and index appear as temporary overlays.

### Mobile Layout

- One primary view fills the screen.
- Dossier is a bottom sheet.
- Search opens a full-screen command sheet.
- Source Studio is a separate tab, not a drawer over the Atlas.
- Timeline, network, and thread views use segmented navigation.

## Atlas Panels

### Network Canvas

Primary job:

- Show relationships around the current focus.

Visible controls:

- `1 hop`, `2 hop`, `3 hop`, `All`.
- Layout menu.
- Label density menu.
- Edge type menu.
- Reset view.
- Timeline strip toggle.

Default state:

- If no thinker is selected, show a curated overview with search prompt and default view chips.
- If a thinker is selected, show the ego network at `1 hop`.
- Suggested or weak edges appear visually distinct, but source-management actions are not shown.

Button behavior:

| Button | Behavior |
| --- | --- |
| `1 hop` | Show immediate predecessors and successors. Animate selected node and immediate edges. |
| `2 hop` | Show two-hop neighborhood. Animate newly revealed edges at a dimmer intensity than one-hop edges. |
| `3 hop` | Show three-hop neighborhood. Animate newly revealed edges at the dimmest intensity that remains legible. |
| `All` | Show the filtered graph without neighborhood limiting. Turns off hop-edge animation after entry transition. |
| Layout menu | Switch between force, timeline-projected, ego network, lineage tree, and concept neighborhood. |
| Label density | Controls labels only, never node visibility. Options: focus, key, more, all. |
| Edge type menu | Filters relationship types for exploration. Source status stays in Source Studio unless source inspection is active. |
| Reset view | Recenters and restores default zoom for the current focus. |
| Timeline toggle | Shows or hides the compact timeline strip. |

Do not show:

- Import queue actions.
- CSV/JSON controls.
- Source provider controls.
- Duplicate merge controls.
- Bulk review buttons.

### Scholar Dossier Card

Primary job:

- Help the user understand one thinker and decide where to go next.

The dossier should be the second-most important surface after the network.

Default sections:

1. **Header**
   - Name.
   - Lifespan.
   - Field/domain color.
   - Region/era.
   - Close, pin, expand.

2. **Why They Matter**
   - Short summary.
   - Bridge score.
   - Major domains.

3. **Key Works / Ideas**
   - Works.
   - Concepts or topics.
   - Movement tags.

4. **Influence Neighborhood**
   - Predecessors.
   - Successors.
   - Collaborators/parallel/contextual neighbors.

5. **Explore Next**
   - Contemporaries.
   - Same field.
   - Same movement.
   - Thread entry points.

Hidden subpanels:

- Source claims.
- Raw import metadata.
- Duplicate details.
- Relationship edit form.

Button behavior:

| Button | Behavior |
| --- | --- |
| Close | Closes the dossier and keeps current network view. |
| Pin | Keeps dossier open while selecting other nodes. |
| Expand | Makes dossier full height or full screen on mobile. |
| Predecessor chip | Selects that thinker and updates the network. |
| Successor chip | Selects that thinker and updates the network. |
| `Trace from here` | Opens path/thread tools within Atlas, seeded with selected thinker. |
| `Show contemporaries` | Applies a temporary timeline/network lens. Does not open Source Studio. |
| `Review sources` | Switches to Source Studio with this thinker selected. |
| `Edit relationships` | Switches to Source Studio review/edit tab with this thinker selected. |

### Timeline Strip

Primary job:

- Provide chronological context without taking over the screen.

Default:

- Collapsed strip under the network.
- Shows selected thinker lifespan and immediate neighborhood.
- Sticky year ruler.
- No global dense timeline unless explicitly expanded.

Expanded timeline:

- Opens as a bottom panel on desktop/tablet.
- Opens as its own view on mobile.
- Supports era bookmarks, domain lanes, and density modes.

Button behavior:

| Button | Behavior |
| --- | --- |
| Expand timeline | Turns the strip into a larger panel or full timeline view. |
| Collapse timeline | Returns to strip. |
| Selected lifespan | Frames the selected thinker's life and neighbors. |
| Full range | Shows entire filtered historical range. |
| Domain lanes | Toggles lanes for the current filtered fields. |
| Bookmarks | Opens era/thread/saved-view jump list. |

Do not show:

- Import controls.
- Workbench tabs.
- Source audit filters unless Source Studio requests a source-gap timeline view.

### Index Drawer

Primary job:

- Help the user find a thinker without becoming permanent clutter.

Default:

- Closed.
- Opened through search, an index icon, or empty-state prompt.

Visible content:

- Search results.
- Recent selections.
- Saved views.
- Field/movement groups.

Button behavior:

| Button | Behavior |
| --- | --- |
| Focus | Selects thinker and closes drawer on mobile/tablet. |
| Pin drawer | Keeps index visible on desktop only. |
| Filter by group | Applies a visible Atlas filter chip. |
| More actions | Opens contextual menu with `Review sources`, `Edit tags`, and `Connect` routed to Source Studio. |

### Filter Drawer

Primary job:

- Shape the Atlas view.

Default:

- Closed.
- Active filters appear as chips near the canvas.

Visible content:

- Field/domain.
- Era.
- Movement.
- Relationship type.
- Thread/saved view.
- Relevance options.

Source-only filters:

- Source status.
- Confidence threshold.
- Duplicate state.
- Import status.

These should live in Source Studio, not in the Atlas filter drawer.

Button behavior:

| Button | Behavior |
| --- | --- |
| Apply | Applies selected filters and closes drawer on mobile. |
| Clear | Clears Atlas filters only. |
| Save view | Saves current Atlas lens. |
| Current focus only | Shows nodes connected to selected thinker. |
| Current thread only | Shows selected thread path. |

### Path And Thread Panel

Primary job:

- Trace relationships without becoming a second workbench.

Default:

- Closed.
- Opens from `Trace from here`, thread chips, or command menu.

Visible content:

- Start thinker.
- End thinker.
- Path result.
- Thread steps.
- Step navigation.

Button behavior:

| Button | Behavior |
| --- | --- |
| Set start | Uses selected thinker as path start. |
| Set end | Uses selected thinker as path end. |
| Find path | Finds directed relationship path. |
| Clear path | Clears highlighted path. |
| Step previous/next | Moves through thread/path and updates graph plus dossier. |
| Save as view | Saves path/thread lens, not source data. |

Do not show:

- Add relationship form.
- Source audit controls.
- Import suggestion acceptance.

## Source Studio Layout

Source Studio should be an explicit workspace with its own information architecture.

Implemented composition: Source Studio is the sole primary Sources surface and fills the space below global navigation. Its operational content scrolls internally beneath sticky mode tabs. A compact selected-scholar row provides `Open in Atlas` and `View in Focus`; no graph, path finder, radar, index, or dossier is mounted in this workspace.

### Source Studio Tabs

| Tab | Purpose |
| --- | --- |
| Import | Search providers, batch paste, CSV import, candidate staging. |
| Review | Accept/reject/merge candidates and suggested links. |
| Sources | Audit provenance, source gaps, confidence, relationship status. |
| Export | JSON export/restore, CSV export, local storage reset, seed tooling notes. |

### Import Tab

Visible controls:

- Provider selector.
- Search/batch input.
- Candidate results.
- Queue button.
- Candidate preview.

Button behavior:

| Button | Behavior |
| --- | --- |
| Provider card | Selects import source. Disabled or marked when credentials are required. |
| Search | Queries selected source. |
| Queue candidate | Adds candidate to review queue. |
| Batch paste | Parses rows into queue items. |
| CSV import | Opens file picker and queues rows. |

### Review Tab

Visible controls:

- Review queue.
- Confidence threshold.
- Candidate detail.
- Duplicate warning.
- Suggested links.

Button behavior:

| Button | Behavior |
| --- | --- |
| Accept | Creates a local thinker without adding a link. |
| Accept with top link | Creates thinker and accepted/suggested edge from the top recommendation. |
| Edit | Opens candidate editor. |
| Merge duplicate | Merges metadata into selected duplicate. |
| Skip | Preserves audit log entry and removes from active queue. |
| Reject link | Removes suggestion and stores rejected suggestion key. |
| Undo | Restores previous review snapshot. |

### Sources Tab

Visible controls:

- Source gaps.
- Weak relationships.
- Relationship status.
- Claim URLs.
- Selected thinker or edge detail.

Button behavior:

| Button | Behavior |
| --- | --- |
| Review edge | Opens edge provenance detail. |
| Mark accepted | Sets reviewed relationship status after source details are sufficient. |
| Mark needs source | Keeps relationship visible but flagged for audit. |
| Add source claim | Adds source URL or identifier. |
| Open in Atlas | Returns to the Atlas with the relevant thinker/edge highlighted. |

### Export Tab

Visible controls:

- Export JSON.
- Restore JSON.
- Export CSV.
- Local storage/reset controls.
- Demo/private data explanation.

Button behavior:

| Button | Behavior |
| --- | --- |
| Export JSON | Downloads full atlas state, including queues and audit data. |
| Restore JSON | Opens file picker and replaces local atlas state after confirmation. |
| Export CSV | Downloads people/relationship export for spreadsheet review. |
| Reset local data | Clears local browser state after confirmation. |

## What Should Be Visible Together

### Atlas Default

Visible:

- Top bar.
- Network canvas.
- Current filter chips.
- Floating network toolbar.

Optional:

- Dossier if selected.
- Timeline strip if enabled.
- Index/search drawer if opened.

Not visible:

- Import, export, sources, duplicate review, workbench tabs.

### Atlas With Selected Thinker

Visible:

- Network canvas centered on selected thinker.
- Dossier card.
- Hop controls.
- Relationship type/label controls.
- Timeline strip.

Optional:

- Path/thread panel.
- Filter drawer.

Not visible:

- Import queue.
- Provider list.
- CSV/JSON controls.
- Batch actions.

### Source Studio Import Session

Visible:

- Source Studio tabs.
- Import provider/search controls.
- Candidate results/queue.
- Candidate detail.

Optional:

- Mini Atlas preview for selected candidate's likely neighborhood.

Not visible:

- Full Atlas filter drawer.
- Full timeline controls.
- Dossier unless previewing an existing duplicate.

### Source Studio Source Audit

Visible:

- Source gap list.
- Edge/person detail.
- Source claim editor.
- Confidence/status controls.

Optional:

- Mini network preview.
- Open in Atlas button.

Not visible:

- Import search unless switching to Import tab.
- Bulk queue actions unless switching to Review tab.

## Button Cleanup Rules

Every button should satisfy at least one of these categories:

- **Navigate**: change workspace, panel, selected thinker, path step, or saved view.
- **Lens**: change what the Atlas shows without mutating data.
- **Mutate**: change local data, queue state, source claims, relationships, or local storage.
- **Utility**: reset view, close panel, pin panel, export file, restore file.

Rules:

1. Mutating buttons should not appear in the Atlas unless the user explicitly enters edit/source mode.
2. Lens buttons should not mutate data.
3. Source buttons should live in Source Studio.
4. Dossier navigation buttons should select thinkers or open tracing, not perform review actions inline.
5. Button labels should describe the result, not the implementation.
6. Icon-only buttons need titles/tooltips and predictable placement.

## State Model

Recommended high-level state:

```ts
type Workspace = "atlas" | "timeline" | "sources" | "focus";
type AtlasView = "network" | "timeline" | "thread";
type SourceStudioTab = "import" | "review" | "sources" | "export";
type PanelState = "closed" | "peek" | "open" | "pinned" | "fullscreen";
```

State ownership:

- Workspace owns which top-level experience is visible.
- Atlas owns exploration filters, selected thinker, graph layout, timeline range, and path/thread highlight.
- Source Studio owns queue filters, source filters, import drafts, review tabs, and export/restore flows.
- Dossier owns only its local tab, pin state, and size.

## Migration Plan

### Phase 1: Information Architecture

- Replace activity switcher with `Atlas`, `Sources`, `Focus`.
- Move Workbench tabs into Source Studio.
- Move export/import buttons into Source Studio Export and Import tabs.
- Remove source/status filters from Atlas controls unless source inspection is active.

### Phase 2: Atlas Simplification

- Make network the default primary surface.
- Convert timeline to a strip that can expand.
- Convert index and filters to drawers.
- Keep dossier open only when selection exists, with pin/expand behavior.
- Move relationship edit/review actions out of dossier into Source Studio.

### Phase 3: Source Studio Completion

- Split Import, Review, Sources, Export tabs into focused components.
- Give Source Studio its own candidate detail and source detail surfaces.
- Add "Open in Atlas" links from source/review items.
- Keep mutation-heavy controls inside Source Studio.

### Phase 4: Mobile Restructure

- Use one primary view at a time.
- Make dossier a bottom sheet.
- Make search and command menu full-screen sheets.
- Treat Source Studio as a separate mobile tab.

### Phase 5: Button Audit

- Inventory every visible button.
- Assign each to navigate/lens/mutate/utility.
- Remove duplicates.
- Move misplaced mutating/source buttons into Source Studio.
- Add missing disabled states and labels.

## Open Design Questions

- Should Source Studio require an explicit "editing mode" confirmation before mutating canonical local state?
- Should the Atlas ever show suggested edges by default, or only reviewed/accepted edges with an optional suggestion lens?
- Should the dossier show source status badges in read-only form, or hide provenance entirely until Source Studio?
- Should timeline be a secondary strip by default, or should users be able to set timeline as their preferred Atlas default?
- Should saved views be Atlas-only, or should Source Studio also have saved audit queues?
