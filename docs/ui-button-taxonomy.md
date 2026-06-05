# UI Button Taxonomy

This audit classifies visible controls so the UI can keep exploration, source work, and utility actions from overlapping.

Button roles:

- **Navigate**: changes workspace, panel, selected thinker, path step, saved view, or tab.
- **Lens**: changes what the atlas shows without changing data.
- **Mutate**: changes local atlas data, queue state, source claims, relationships, imports, or local storage.
- **Utility**: closes, pins, resizes, resets, exports, restores, or changes display density.

## Global Header

| Control | Role |
| --- | --- |
| Influence Atlas | Navigate |
| Source Studio | Navigate |
| Focus / Presentation | Navigate |
| Actions menu | Navigate |
| Add Thinker | Mutate |
| Open Source Studio | Navigate |
| Trace Path | Navigate |
| Import Review | Navigate |
| Unlinked Imports | Lens |
| Needs Review | Lens |
| High-Confidence Suggestions | Lens |
| Source Gaps | Lens |
| Save View / Collection | Mutate |
| Saved view row | Navigate |
| Delete saved view | Mutate |
| Density buttons | Utility |
| Reset Dataset | Mutate |

## Atlas Toolbar

| Control | Role |
| --- | --- |
| Index open/close | Navigate |
| Search input | Lens |
| Filter drawer | Navigate |
| Timeline / Map / Split lens buttons | Lens |
| Lineage In | Lens |
| Lineage Out | Lens |
| Neighborhood | Lens |
| Find Bridge | Lens |
| Contemporaries | Lens |
| Sync Lenses | Lens |
| Relations | Navigate |

## Atlas Filter Drawer

| Control | Role |
| --- | --- |
| Era shortcut | Lens |
| Year inputs/ranges | Lens |
| Field/domain filter | Lens |
| Topic/lens filter | Lens |
| Era filter | Lens |
| Region filter | Lens |
| Sort index | Lens |
| Fit Results | Lens |
| Epoch Bands | Lens |
| Influence Lines | Lens |
| Edge type filter | Lens |
| Reset Edges | Utility |
| Clear Filters | Utility |

Source status and edge-confidence source filters belong only in Source Studio.

## Network And Timeline

| Control | Role |
| --- | --- |
| Network node | Navigate |
| 1 hop / 2 hop / 3 hop / all | Lens |
| Layout mode | Lens |
| Cluster mode | Lens |
| Label density | Lens |
| Reset graph view | Utility |
| Timeline strip Expand / Collapse | Utility |
| Timeline strip Full | Navigate |
| Timeline pan/zoom | Lens |
| Timeline bookmark | Navigate |
| Save timeline bookmark | Mutate |
| Remove timeline bookmark | Mutate |

## Scholar Dossier

| Control | Role |
| --- | --- |
| Dossier tab | Navigate |
| Predecessor/successor chip | Navigate |
| Context peer chip | Navigate |
| Genealogy node | Navigate |
| Contemporaries | Lens |
| Successors Map | Lens |
| Studio Review | Navigate |
| Close dossier | Utility |
| Resize dossier | Utility |

The dossier should not contain inline relationship-edit or source-claim mutation controls.

## Index Drawer

| Control | Role |
| --- | --- |
| Group expand/collapse | Utility |
| Thinker row | Navigate |
| Focus quick action | Navigate |
| Connect quick action | Navigate |
| Edit tags quick action | Navigate |
| Review sources quick action | Navigate |

Quick actions that imply data mutation should route to Source Studio rather than mutating inline.

## Path Finder

| Control | Role |
| --- | --- |
| Open/close path finder | Navigate |
| Start/end thinker selectors | Navigate |
| Find path | Lens |
| Clear path | Utility |
| Path node | Navigate |

## Source Studio

| Control | Role |
| --- | --- |
| Import tab | Navigate |
| Review tab | Navigate |
| Sources tab | Navigate |
| Export tab | Navigate |
| Panel mode buttons | Utility |
| Close Source Studio | Utility |

### Import Tab

| Control | Role |
| --- | --- |
| Source provider card | Lens |
| Wikidata search | Lens |
| Queue candidate | Mutate |
| Batch search | Lens |
| Queue rows | Mutate |
| Import CSV | Mutate |
| Import draft inputs | Mutate |
| Accept draft | Mutate |
| Clear draft | Utility |

### Review Tab

| Control | Role |
| --- | --- |
| Add relationship | Mutate |
| Queue suggested link | Mutate |
| Reject suggested link | Mutate |
| Accept queued link | Mutate |
| Confidence threshold | Lens |
| Accept imports | Mutate |
| Clear duplicates | Mutate |
| Clear low confidence | Mutate |
| Clear queue | Mutate |
| Edit queued item | Navigate |
| Merge duplicate | Mutate |
| Skip queued item | Mutate |
| Undo review action | Mutate |

### Sources Tab

| Control | Role |
| --- | --- |
| Source status filter | Lens |
| Confidence filter | Lens |
| Source gap row | Navigate |
| Mark/review actions | Mutate |

### Export Tab

| Control | Role |
| --- | --- |
| Export JSON | Utility |
| Restore JSON | Mutate |
| Export CSV | Utility |

## Cleanup Rule

When a visible button cannot be assigned to one of these roles, it should be removed, renamed, moved into Source Studio, or converted into a passive label.

