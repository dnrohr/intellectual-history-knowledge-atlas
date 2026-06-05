import React, { useState, useEffect, useRef } from "react";
import { Thinker, InfluenceEdge } from "./types";
import {
  INITIAL_PEOPLE_DATA,
  INITIAL_EDGES_DATA,
  FIELD_COLOR,
  ERA_BANDS,
  INITIAL_INSTITUTIONS_DATA,
} from "./data";
import Timeline from "./components/Timeline";
import NetworkGraph from "./components/NetworkGraph";
import DetailPanel from "./components/DetailPanel";
import AddThinkerModal from "./components/AddThinkerModal";
import PathFinder from "./components/PathFinder";
import EmptyState from "./components/EmptyState";
import { CONTROLLED_TOPICS, ATLAS_LENSES, inferLensTags, getLensOptionLabel, getDomainForField, buildDisciplineGroups, buildSubfieldsByField, buildTopicGroupsByField } from "./taxonomy";
import { EXTERNAL_SOURCES } from "./externalSources";
import { auditThreadGaps, CANONICAL_THREADS, getThreadJunctionMarkers, tagRelationshipsWithThreads } from "./threads";
import { SourceAdapterRunRecord, summarizeSourceAdapterRuns } from "./sourceAdapters";
import {
  IMPORT_QUEUE_SCHEMA_VERSION,
  IMPORT_QUEUE_STORAGE_KEY,
  LEGACY_IMPORT_QUEUE_STORAGE_KEY,
  ImportReviewItem,
  ImportReviewStatus,
  WikidataCandidate,
  normalizeStoredImportReviewQueue,
  parseStoredImportReviewQueue,
  persistImportReviewQueueToStorage,
} from "./importQueue";
import { scoreCandidateRelationship } from "./relationshipScoring";
import { findDuplicateCandidateId, normalizeEntityName } from "./duplicateDetection";
import { scoreCandidateConfidence } from "./importConfidence";
import {
  buildGraphHealthReport,
  createGraphRepairPreview,
  getDryRunRepairJobTriggers,
  planWeakUnsupportedEdgeDemotions,
} from "./graphQuality";
import { loadAtlasStateFromStorage, persistAtlasStateToStorage } from "./storageMigrations";
import { PUBLIC_DEMO_MODE } from "./runtimeConfig";
import { 
  Plus, 
  RefreshCcw, 
  Search, 
  Share2, 
  Filter, 
  SlidersHorizontal, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Globe, 
  List, 
  Eye, 
  X,
  Info,
  MoreHorizontal,
  Bookmark,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ImportAuditLogItem = {
  id: string;
  candidateId: string;
  candidateName: string;
  confidence: number;
  status: ImportReviewStatus;
  reason: string;
  sourceUrl: string;
  reviewedAt: string;
};

type ImportQualityLabel = {
  label: string;
  tone: "strong" | "medium" | "weak" | "warning";
};

type LinkReviewItem = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  reason: string;
  score: number;
  createdAt: string;
};

type WorkbenchTab =
  | "sourceHealth"
  | "claimConflicts"
  | "candidateRelationships"
  | "repairJobs"
  | "manualOverrides"
  | "exportRecovery";

type AutomatedClaimDecisionStatus = "accepted" | "held" | "rejected" | "conflicting";

type AutomatedClaimDecision = {
  id: string;
  label: string;
  status: AutomatedClaimDecisionStatus;
  reason: string;
};

type ReviewUndoSnapshot = {
  label: string;
  createdAt: string;
  people: Thinker[];
  edges: InfluenceEdge[];
  importReviewQueue: ImportReviewItem[];
  importAuditLog: ImportAuditLogItem[];
  linkReviewQueue: LinkReviewItem[];
  selectedId: string | null;
  highlightPath: string[] | null;
  workbenchTab: WorkbenchTab;
};

type Workspace = "atlas" | "sources" | "focus";
type WorkspaceActivity = "explore" | "inspect" | "trace" | "curate" | "import" | "sources";
type ChromeDensity = "compact" | "comfortable" | "focus" | "curation" | "demo";
type PanelMode = "closed" | "floating" | "docked" | "pinned" | "fullscreen";
type SortMode = "birth" | "field" | "bridge" | "name" | "relevance";

type SavedAtlasView = {
  id: string;
  name: string;
  createdAt: string;
  activity: WorkspaceActivity;
  viewMode: "timeline" | "network" | "split";
  chromeDensity: ChromeDensity;
  selectedId: string | null;
  selectedFields: string[];
  selectedSubfields: string[];
  selectedLensTags: string[];
  selectedEras: string[];
  selectedRegions: string[];
  selectedThreadId: string | null;
  minYear: number;
  maxYear: number;
  searchQuery: string;
  sortMode: SortMode;
  onlyConnectedToFocus: boolean;
  onlyCurrentThread: boolean;
  onlyReviewGaps: boolean;
  collectionIds: string[];
};

type TimelineBookmarkItem = {
  id: string;
  label: string;
  year: number;
  kind: "thread" | "saved" | "custom";
};

type DefaultCuratedAtlasViewDefinition = {
  id: string;
  name: string;
  minYear: number;
  maxYear: number;
  selectedFields?: string[];
  selectedEras?: string[];
  searchQuery?: string;
  match: (person: Thinker) => boolean;
};

const REJECTED_LINK_SUGGESTIONS_STORAGE_KEY = "atlas_rejected_link_suggestions_v1";
const LINK_REVIEW_QUEUE_STORAGE_KEY = "atlas_link_review_queue_v1";
const WORKBENCH_PANEL_MODE_STORAGE_KEY = "atlas_workbench_panel_mode_v1";
const SAVED_ATLAS_VIEWS_STORAGE_KEY = "atlas_saved_views_v1";
const TIMELINE_BOOKMARKS_STORAGE_KEY = "atlas_timeline_bookmarks_v1";
const WORKBENCH_PANEL_MODES: Array<Exclude<PanelMode, "closed">> = ["floating", "docked", "pinned", "fullscreen"];

const personSearchText = (person: Thinker) =>
  [
    person.name,
    person.era,
    person.movement,
    person.region,
    ...(person.fields || []),
    ...(person.subfields || []),
    ...(person.works || []),
    person.notes,
  ].filter(Boolean).join(" ").toLowerCase();

const DEFAULT_CURATED_ATLAS_VIEW_DEFINITIONS: DefaultCuratedAtlasViewDefinition[] = [
  {
    id: "ancient-foundations",
    name: "Ancient foundations",
    minYear: -650,
    maxYear: 500,
    selectedEras: ["Ancient"],
    match: (person) => person.era === "Ancient",
  },
  {
    id: "scientific-revolution",
    name: "Scientific Revolution",
    minYear: 1450,
    maxYear: 1700,
    selectedFields: ["Physics", "Astronomy", "Mathematics", "Biology", "Chemistry", "Philosophy"],
    selectedEras: ["Renaissance", "Scientific Revolution"],
    searchQuery: "scientific",
    match: (person) => {
      const text = personSearchText(person);
      return person.movement === "Scientific Revolution" || person.era === "Scientific Revolution" || text.includes("scientific revolution");
    },
  },
  {
    id: "enlightenment-political-thought",
    name: "Enlightenment political thought",
    minYear: 1630,
    maxYear: 1800,
    selectedFields: ["Political Thought", "Economics", "Philosophy"],
    selectedEras: ["Enlightenment"],
    match: (person) =>
      person.era === "Enlightenment" &&
      person.fields.some((field) => ["Political Thought", "Economics", "Philosophy"].includes(field)),
  },
  {
    id: "german-idealism",
    name: "German Idealism",
    minYear: 1720,
    maxYear: 1860,
    selectedFields: ["Philosophy"],
    selectedEras: ["Enlightenment", "19th Century"],
    searchQuery: "idealism",
    match: (person) => {
      const text = personSearchText(person);
      return person.movement === "German Idealism" || text.includes("idealism") || ["kant", "hegel"].includes(person.id);
    },
  },
  {
    id: "evolution-and-biology",
    name: "Evolution and biology",
    minYear: 1750,
    maxYear: 1950,
    selectedFields: ["Biology"],
    searchQuery: "evolution",
    match: (person) => {
      const text = personSearchText(person);
      return person.fields.includes("Biology") && /evolution|darwin|genetic|selection|taxonomy|anatomy|naturalist/.test(text);
    },
  },
  {
    id: "logic-to-computation",
    name: "Logic to computation",
    minYear: 1600,
    maxYear: 2026,
    selectedFields: ["Logic", "Computing", "Mathematics"],
    searchQuery: "comput",
    match: (person) => {
      const text = personSearchText(person);
      return person.fields.some((field) => ["Logic", "Computing"].includes(field)) || /comput|lambda|formal system|algorithm|turing|program/.test(text);
    },
  },
  {
    id: "quantum-physics",
    name: "Quantum physics",
    minYear: 1850,
    maxYear: 2026,
    selectedFields: ["Physics", "Cosmology"],
    searchQuery: "quantum",
    match: (person) => /quantum|relativity|qed|uncertainty|atomic|field symmetries/.test(personSearchText(person)),
  },
  {
    id: "ai-lineage",
    name: "AI lineage",
    minYear: 1900,
    maxYear: 2026,
    selectedFields: ["Computing", "Mathematics", "Logic", "Psychology", "Linguistics"],
    searchQuery: "AI",
    match: (person) => /artificial intelligence|\bai\b|symbolic ai|lisp|transformer|machine learning|neural|cognitive/.test(personSearchText(person)),
  },
  {
    id: "critical-theory-postmodernism",
    name: "Critical theory and postmodernism",
    minYear: 1850,
    maxYear: 2026,
    selectedFields: ["Philosophy", "Political Thought", "Literature"],
    selectedEras: ["Modernism", "Postwar", "Contemporary"],
    searchQuery: "critical",
    match: (person) => /critical|postmodern|structural|power-knowledge|gender|genealogical|ideology|alienation/.test(personSearchText(person)),
  },
];

const isWorkbenchPanelMode = (mode: unknown): mode is Exclude<PanelMode, "closed"> =>
  typeof mode === "string" && WORKBENCH_PANEL_MODES.includes(mode as Exclude<PanelMode, "closed">);

const normalizeLinkReviewQueue = (items: unknown): LinkReviewItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Partial<LinkReviewItem> => Boolean(item))
    .filter((item) => item.id && item.sourceId && item.targetId)
    .map((item) => ({
      id: String(item.id),
      sourceId: String(item.sourceId),
      targetId: String(item.targetId),
      sourceName: String(item.sourceName || item.sourceId),
      targetName: String(item.targetName || item.targetId),
      reason: String(item.reason || "Queued suggested relationship."),
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : 1,
      createdAt: String(item.createdAt || new Date().toISOString()),
    }));
};

const normalizeSavedAtlasViews = (items: unknown): SavedAtlasView[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Partial<SavedAtlasView> => Boolean(item))
    .filter((item) => item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      createdAt: String(item.createdAt || new Date().toISOString()),
      activity: (["explore", "inspect", "trace", "curate", "import", "sources"] as WorkspaceActivity[]).includes(item.activity as WorkspaceActivity)
        ? item.activity as WorkspaceActivity
        : "explore",
      viewMode: (["timeline", "network", "split"] as const).includes(item.viewMode as "timeline" | "network" | "split")
        ? item.viewMode as "timeline" | "network" | "split"
        : "split",
      chromeDensity: (["compact", "comfortable", "focus", "curation", "demo"] as ChromeDensity[]).includes(item.chromeDensity as ChromeDensity)
        ? item.chromeDensity as ChromeDensity
        : "comfortable",
      selectedId: typeof item.selectedId === "string" ? item.selectedId : null,
      selectedFields: Array.isArray(item.selectedFields) ? item.selectedFields.filter((value): value is string => typeof value === "string") : [],
      selectedSubfields: Array.isArray(item.selectedSubfields) ? item.selectedSubfields.filter((value): value is string => typeof value === "string") : [],
      selectedLensTags: Array.isArray(item.selectedLensTags) ? item.selectedLensTags.filter((value): value is string => typeof value === "string") : [],
      selectedEras: Array.isArray(item.selectedEras) ? item.selectedEras.filter((value): value is string => typeof value === "string") : [],
      selectedRegions: Array.isArray(item.selectedRegions) ? item.selectedRegions.filter((value): value is string => typeof value === "string") : [],
      selectedThreadId: typeof item.selectedThreadId === "string" ? item.selectedThreadId : null,
      minYear: Number.isFinite(Number(item.minYear)) ? Number(item.minYear) : -650,
      maxYear: Number.isFinite(Number(item.maxYear)) ? Number(item.maxYear) : 2030,
      searchQuery: typeof item.searchQuery === "string" ? item.searchQuery : "",
      sortMode: (["birth", "field", "bridge", "name", "relevance"] as SortMode[]).includes(item.sortMode as SortMode)
        ? item.sortMode as SortMode
        : "birth",
      onlyConnectedToFocus: Boolean(item.onlyConnectedToFocus),
      onlyCurrentThread: Boolean(item.onlyCurrentThread),
      onlyReviewGaps: Boolean(item.onlyReviewGaps),
      collectionIds: Array.isArray(item.collectionIds) ? item.collectionIds.filter((value): value is string => typeof value === "string") : [],
    }))
    .slice(0, 20);
};

const buildDefaultCuratedAtlasViews = (people: Thinker[]): SavedAtlasView[] =>
  DEFAULT_CURATED_ATLAS_VIEW_DEFINITIONS.map((definition) => {
    const collectionIds = people.filter(definition.match).map((person) => person.id);
    const view: SavedAtlasView = {
      id: `default-${definition.id}`,
      name: definition.name,
      createdAt: "default",
      activity: "explore",
      viewMode: "network",
      chromeDensity: "comfortable",
      selectedId: collectionIds[0] || null,
      selectedFields: definition.selectedFields || [],
      selectedSubfields: [],
      selectedLensTags: [],
      selectedEras: definition.selectedEras || [],
      selectedRegions: [],
      selectedThreadId: null,
      minYear: definition.minYear,
      maxYear: definition.maxYear,
      searchQuery: "",
      sortMode: "relevance",
      onlyConnectedToFocus: false,
      onlyCurrentThread: false,
      onlyReviewGaps: false,
      collectionIds,
    };
    return view;
  }).filter((view) => view.collectionIds.length > 0);

const getInitialSavedAtlasViews = (): SavedAtlasView[] => {
  const defaults = buildDefaultCuratedAtlasViews(INITIAL_PEOPLE_DATA);
  try {
    const savedViews = normalizeSavedAtlasViews(JSON.parse(localStorage.getItem(SAVED_ATLAS_VIEWS_STORAGE_KEY) || "[]"));
    const missingDefaults = defaults.filter((defaultView) => !savedViews.some((view) => view.id === defaultView.id));
    return [...savedViews, ...missingDefaults].slice(0, 20);
  } catch {
    return defaults;
  }
};

const normalizeTimelineBookmarks = (items: unknown): TimelineBookmarkItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is Partial<TimelineBookmarkItem> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : `timeline-bookmark-${crypto.randomUUID()}`,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "Timeline Bookmark",
      year: typeof item.year === "number" && Number.isFinite(item.year) ? Math.round(item.year) : -650,
      kind: item.kind === "thread" || item.kind === "saved" || item.kind === "custom" ? item.kind : "custom",
    }))
    .slice(0, 12);
};

const getInitialTimelineBookmarks = (): TimelineBookmarkItem[] => {
  try {
    return normalizeTimelineBookmarks(JSON.parse(localStorage.getItem(TIMELINE_BOOKMARKS_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
};

export default function App() {
  const [people, setPeople] = useState<Thinker[]>([]);
  const [edges, setEdges] = useState<InfluenceEdge[]>([]);
  const persistAtlasState = (nextPeople = people, nextEdges = edges) =>
    persistAtlasStateToStorage(nextPeople, nextEdges);
  const csvImportInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  // Layout Controls
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>("atlas");
  const [activeActivity, setActiveActivity] = useState<WorkspaceActivity>("explore");
  const [viewMode, setViewMode] = useState<"timeline" | "network" | "split">("network");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [extensionWorkbenchOpen, setExtensionWorkbenchOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [chromeDensity, setChromeDensity] = useState<ChromeDensity>("comfortable");
  const [workbenchPanelMode, setWorkbenchPanelMode] = useState<Exclude<PanelMode, "closed">>(() => {
    const savedMode = localStorage.getItem(WORKBENCH_PANEL_MODE_STORAGE_KEY);
    return isWorkbenchPanelMode(savedMode) ? savedMode : "docked";
  });
  const [coordinatedLenses, setCoordinatedLenses] = useState(true);
  const [relationshipInspectorOpen, setRelationshipInspectorOpen] = useState(false);

  // Panel Resizer states
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [detailWidth, setDetailWidth] = useState(380);
  const [splitHeightRatio, setSplitHeightRatio] = useState(50);
  const [timelineStripExpanded, setTimelineStripExpanded] = useState(false);

  // Selection & Advanced Year range filters
  const [selectedId, setSelectedId] = useState<string | null>("plato");
  const [minYear, setMinYear] = useState<number>(-650);
  const [maxYear, setMaxYear] = useState<number>(2030);

  // Simplified toggle-based multi-tag fields and subfields
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedSubfields, setSelectedSubfields] = useState<string[]>([]);
  const [selectedLensTags, setSelectedLensTags] = useState<string[]>([]);
  const [selectedEras, setSelectedEras] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [expandedDisciplineGroups, setExpandedDisciplineGroups] = useState<string[]>(["Natural Inquiry", "Formal Systems"]);
  const [expandedFacetFields, setExpandedFacetFields] = useState<string[]>([]);
  const [indexMode, setIndexMode] = useState<"context" | "cluster" | "era" | "field" | "movement" | "institution" | "review">("context");
  const [expandedIndexGroups, setExpandedIndexGroups] = useState<string[]>([
    "Selected",
    "Connected",
    "Likely Links",
    "Current Matches",
    "Natural Inquiry",
    "Human Systems",
  ]);
  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>("candidateRelationships");
  const [relationshipDraft, setRelationshipDraft] = useState({
    targetName: "",
    direction: "out" as "out" | "in",
    type: "Influence",
    strength: 3,
    confidence: 0.55,
    note: "",
  });
  const [importDraft, setImportDraft] = useState({
    source: "wikidata",
    name: "",
    birth: "",
    death: "",
    field: "Philosophy",
    region: "",
    era: "",
    movement: "",
    topics: "",
    sourceUrl: "",
    notes: "",
  });
  const [draftQueueItemId, setDraftQueueItemId] = useState<string | null>(null);
  const [wikidataQuery, setWikidataQuery] = useState("");
  const [wikidataCandidates, setWikidataCandidates] = useState<WikidataCandidate[]>([]);
  const [wikidataBatchText, setWikidataBatchText] = useState("");
  const [wikidataBatchCandidates, setWikidataBatchCandidates] = useState<Array<{
    query: string;
    confidence: number;
    duplicateId: string | null;
    candidate: WikidataCandidate | null;
  }>>([]);
  const [importReviewQueue, setImportReviewQueue] = useState<ImportReviewItem[]>([]);
  const [importAuditLog, setImportAuditLog] = useState<ImportAuditLogItem[]>([]);
  const [linkReviewQueue, setLinkReviewQueue] = useState<LinkReviewItem[]>(() => {
    try {
      return normalizeLinkReviewQueue(JSON.parse(localStorage.getItem(LINK_REVIEW_QUEUE_STORAGE_KEY) || "[]"));
    } catch {
      return [];
    }
  });
  const [importConfidenceThreshold, setImportConfidenceThreshold] = useState(() => {
    const savedThreshold = localStorage.getItem("atlas_import_confidence_threshold_v1");
    const parsedThreshold = savedThreshold ? Number(savedThreshold) : 80;
    return Number.isFinite(parsedThreshold) ? Math.max(0, Math.min(100, parsedThreshold)) : 80;
  });
  const [rejectedLinkSuggestionKeys, setRejectedLinkSuggestionKeys] = useState<Set<string>>(() => {
    try {
      const savedKeys = JSON.parse(localStorage.getItem(REJECTED_LINK_SUGGESTIONS_STORAGE_KEY) || "[]");
      return new Set(Array.isArray(savedKeys) ? savedKeys.filter((key) => typeof key === "string") : []);
    } catch {
      return new Set();
    }
  });
  const [savedAtlasViews, setSavedAtlasViews] = useState<SavedAtlasView[]>(getInitialSavedAtlasViews);
  const [customTimelineBookmarks, setCustomTimelineBookmarks] = useState<TimelineBookmarkItem[]>(getInitialTimelineBookmarks);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [openSuggestionDetailKey, setOpenSuggestionDetailKey] = useState<string | null>(null);
  const [wikidataLoading, setWikidataLoading] = useState(false);
  const [reviewUndoSnapshot, setReviewUndoSnapshot] = useState<ReviewUndoSnapshot | null>(null);

  const [sortMode, setSortMode] = useState<SortMode>("birth");
  const [onlyConnectedToFocus, setOnlyConnectedToFocus] = useState(false);
  const [onlyCurrentThread, setOnlyCurrentThread] = useState(false);
  const [onlyReviewGaps, setOnlyReviewGaps] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Layer toggles
  const [showMov, setShowMov] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showWorks, setShowWorks] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [edgeTypeFilter, setEdgeTypeFilter] = useState("all");
  const [edgeSourceFilter, setEdgeSourceFilter] = useState<"all" | "sourced" | "needs_source">("all");
  const [edgeConfidenceFilter, setEdgeConfidenceFilter] = useState(0);
  const [logScale, setLogScale] = useState(true);
  const [zoom, setZoom] = useState(1.4);

  // Overlays
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pathFinderOpen, setPathFinderOpen] = useState(false);
  const [highlightPath, setHighlightPath] = useState<string[] | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadStep, setSelectedThreadStep] = useState(0);

  // Extra details rendering (from detail action modifiers)
  const [overlapContemps, setOverlapContemps] = useState<Thinker[]>([]);
  const [bfsMapNodes, setBfsMapNodes] = useState<{ depth: number; nodes: Thinker[] }[]>([]);

  // ── PANEL RESIZING HANDLERS ──
  const handleLeftResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startWidth = sidebarWidth;
    const startX = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = Math.max(160, Math.min(450, startWidth + deltaX));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleRightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startWidth = detailWidth;
    const startX = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Subtracting because dragging leftward should widen the right dossier
      const nextWidth = Math.max(280, Math.min(650, startWidth - deltaX));
      setDetailWidth(nextWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleSplitResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const splitContainer = e.currentTarget.parentElement;
    if (!splitContainer) return;
    const containerHeight = splitContainer.clientHeight;
    const startY = e.clientY;
    const startRatio = splitHeightRatio;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaRatio = (deltaY / containerHeight) * 100;
      const nextRatio = Math.max(20, Math.min(80, startRatio + deltaRatio));
      setSplitHeightRatio(nextRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // ── AUTO-FOCUS TIMELINE BOUNDS ON FILTER INSTANTIATION ──
  // 1. Load initial client state
  useEffect(() => {
    const savedImportQueue =
      localStorage.getItem(IMPORT_QUEUE_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_IMPORT_QUEUE_STORAGE_KEY);
    const savedImportAuditLog = localStorage.getItem("atlas_import_audit_log_v1");

    if (PUBLIC_DEMO_MODE) {
      setPeople(INITIAL_PEOPLE_DATA);
      setEdges(INITIAL_EDGES_DATA);
      setImportReviewQueue([]);
      setImportAuditLog([]);
      return;
    }

    try {
      const savedAtlasState = loadAtlasStateFromStorage();
      if (savedAtlasState) {
        setPeople(savedAtlasState.people);
        setEdges(savedAtlasState.edges);
      } else {
        setPeople(INITIAL_PEOPLE_DATA);
        setEdges(INITIAL_EDGES_DATA);
        persistAtlasStateToStorage(INITIAL_PEOPLE_DATA, INITIAL_EDGES_DATA);
      }
    } catch {
      setPeople(INITIAL_PEOPLE_DATA);
      setEdges(INITIAL_EDGES_DATA);
      persistAtlasStateToStorage(INITIAL_PEOPLE_DATA, INITIAL_EDGES_DATA);
    }

    if (savedImportQueue) {
      try {
        const normalizedQueue = parseStoredImportReviewQueue(savedImportQueue);
        setImportReviewQueue(normalizedQueue);
        persistImportReviewQueueToStorage(normalizedQueue);
      } catch {
        setImportReviewQueue([]);
      }
    }

    if (savedImportAuditLog) {
      try {
        const parsedImportAuditLog = JSON.parse(savedImportAuditLog);
        if (Array.isArray(parsedImportAuditLog)) {
          setImportAuditLog(parsedImportAuditLog.filter(Boolean).slice(0, 100));
        }
      } catch {
        setImportAuditLog([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(WORKBENCH_PANEL_MODE_STORAGE_KEY, workbenchPanelMode);
  }, [workbenchPanelMode]);

  useEffect(() => {
    localStorage.setItem(SAVED_ATLAS_VIEWS_STORAGE_KEY, JSON.stringify(savedAtlasViews));
  }, [savedAtlasViews]);

  useEffect(() => {
    localStorage.setItem(TIMELINE_BOOKMARKS_STORAGE_KEY, JSON.stringify(customTimelineBookmarks));
  }, [customTimelineBookmarks]);

  // Database additions
  const handleAddThinker = (newThinker: Thinker) => {
    const updated = [...people, newThinker];
    setPeople(updated);
    setOverlapContemps([]);
    setBfsMapNodes([]);
    persistAtlasState(updated, edges);
    setSelectedId(newThinker.id);
    setHighlightPath(null);
  };

  const captureReviewUndoSnapshot = (label: string) => {
    setReviewUndoSnapshot({
      label,
      createdAt: new Date().toISOString(),
      people,
      edges,
      importReviewQueue,
      importAuditLog,
      linkReviewQueue,
      selectedId,
      highlightPath,
      workbenchTab,
    });
  };

  const restoreReviewUndoSnapshot = () => {
    if (!reviewUndoSnapshot) return;
    setPeople(reviewUndoSnapshot.people);
    setEdges(reviewUndoSnapshot.edges);
    setImportReviewQueue(reviewUndoSnapshot.importReviewQueue);
    setImportAuditLog(reviewUndoSnapshot.importAuditLog);
    setLinkReviewQueue(reviewUndoSnapshot.linkReviewQueue);
    setSelectedId(reviewUndoSnapshot.selectedId);
    setHighlightPath(reviewUndoSnapshot.highlightPath);
    setWorkbenchTab(reviewUndoSnapshot.workbenchTab);
    setReviewUndoSnapshot(null);
    persistAtlasState(reviewUndoSnapshot.people, reviewUndoSnapshot.edges);
    persistImportReviewQueueToStorage(reviewUndoSnapshot.importReviewQueue);
    localStorage.setItem("atlas_import_audit_log_v1", JSON.stringify(reviewUndoSnapshot.importAuditLog));
    localStorage.setItem(LINK_REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(reviewUndoSnapshot.linkReviewQueue));
  };

  const handleResetDatabase = () => {
    if (window.confirm("Restore entire Atlas of Thinkers database to historical defaults? This resets any added scholars.")) {
      setPeople(INITIAL_PEOPLE_DATA);
      setEdges(INITIAL_EDGES_DATA);
      setSelectedId("plato");
      setMinYear(-650);
      setMaxYear(2030);
      setSelectedFields([]);
      setSelectedSubfields([]);
      setSelectedLensTags([]);
      setSelectedEras([]);
      setSelectedRegions([]);
      setHighlightPath(null);
      setOverlapContemps([]);
      setBfsMapNodes([]);
      persistAtlasStateToStorage(INITIAL_PEOPLE_DATA, INITIAL_EDGES_DATA);
      localStorage.removeItem(IMPORT_QUEUE_STORAGE_KEY);
      localStorage.removeItem(LEGACY_IMPORT_QUEUE_STORAGE_KEY);
      localStorage.removeItem("atlas_import_audit_log_v1");
      localStorage.removeItem(REJECTED_LINK_SUGGESTIONS_STORAGE_KEY);
      localStorage.removeItem(LINK_REVIEW_QUEUE_STORAGE_KEY);
      setImportReviewQueue([]);
      setImportAuditLog([]);
      setLinkReviewQueue([]);
      setRejectedLinkSuggestionKeys(new Set());
    }
  };

  const selectPerson = (id: string, options: { preserveHighlight?: boolean } = {}) => {
    setSelectedId(id);
    if (!options.preserveHighlight) {
      setHighlightPath(null);
    }
    setOverlapContemps([]);
    setBfsMapNodes([]);
  };

  // Compile unique lists of subfields dynamically from active thinker collection
  const allFields = Object.keys(FIELD_COLOR);
  const allSubfields: string[] = Array.from(
    new Set(people.flatMap((p) => p.subfields || []))
  )
    .filter(Boolean)
    .sort() as string[];
  const allEras = Array.from(new Set(people.map((p) => p.era).filter(Boolean) as string[])).sort();
  const allRegions = Array.from(new Set(people.map((p) => p.region).filter(Boolean) as string[]))
    .sort()
    .slice(0, 24);

  const countPeopleBy = (predicate: (person: Thinker) => boolean) => people.filter(predicate).length;

  const disciplineGroups = buildDisciplineGroups(allFields);
  const subfieldsByField = buildSubfieldsByField(allFields, people);
  const topicGroupsByField = buildTopicGroupsByField(allFields, subfieldsByField);

  // ── FILTERING & SORTING PROCESSING ──
  const getFilteredPeople = (): Thinker[] => {
    let list = [...people];

    // 1. Year limits filtering (including thinkers whose lifespans overlap with active boundaries)
    list = list.filter((p) => {
      const deathVal = p.death ?? 2026;
      return p.birth <= maxYear && deathVal >= minYear;
    });

    // 2. Dynamic Field filtering
    if (selectedFields.length > 0) {
      list = list.filter((p) => 
        p.fields && p.fields.some((f) => selectedFields.includes(f))
      );
    }

    // 3. Dynamic Subfield filtering
    if (selectedSubfields.length > 0) {
      list = list.filter((p) => 
        p.subfields && p.subfields.some((sf) => selectedSubfields.includes(sf))
      );
    }

    if (selectedLensTags.length > 0) {
      list = list.filter((p) => {
        const personLensTags = Object.values(inferLensTags(p)).flat();
        return selectedLensTags.every((tag) => personLensTags.includes(tag));
      });
    }

    if (selectedEras.length > 0) {
      list = list.filter((p) => p.era && selectedEras.includes(p.era));
    }

    if (selectedRegions.length > 0) {
      list = list.filter((p) => p.region && selectedRegions.includes(p.region));
    }

    const q = searchQuery.toLowerCase().trim();
    const queryTokens = q.split(/\s+/).filter(Boolean);
    const getSearchRelevanceScore = (p: Thinker) => {
      if (!q) return 0;

      const name = p.name.toLowerCase();
      const fields = (p.fields || []).join(" ").toLowerCase();
      const topics = (p.subfields || []).join(" ").toLowerCase();
      const works = (p.works || []).join(" ").toLowerCase();
      const movement = (p.movement || "").toLowerCase();
      const region = (p.region || "").toLowerCase();
      const era = (p.era || "").toLowerCase();
      const notes = (p.notes || "").toLowerCase();
      const searchable = [name, fields, topics, works, movement, region, era, notes].join(" ");
      if (!queryTokens.every((token) => searchable.includes(token))) return 0;

      let score = 1;
      if (name === q) score += 90;
      else if (name.startsWith(q)) score += 65;
      else if (name.includes(q)) score += 45;
      if (queryTokens.every((token) => name.includes(token))) score += 20;
      if (fields.includes(q)) score += 18;
      if (topics.includes(q)) score += 16;
      if (works.includes(q)) score += 14;
      if (movement.includes(q)) score += 12;
      if (region.includes(q) || era.includes(q)) score += 8;
      if (notes.includes(q)) score += 5;
      return score;
    };

    // 4. Ranked text search matching
    if (q !== "") {
      list = list.filter((p) => getSearchRelevanceScore(p) > 0);
    }

    if (onlyConnectedToFocus && selectedId) {
      const connectedIds = new Set<string>([selectedId]);
      edges.forEach((edge) => {
        if (edge.source === selectedId) connectedIds.add(edge.target);
        if (edge.target === selectedId) connectedIds.add(edge.source);
      });
      list = list.filter((p) => connectedIds.has(p.id));
    }

    if (onlyCurrentThread && selectedThreadId) {
      const thread = CANONICAL_THREADS.find((item) => item.id === selectedThreadId);
      const threadIds = new Set(
        (thread?.people || [])
          .map((name) => people.find((person) => person.name === name)?.id)
          .filter(Boolean)
      );
      list = list.filter((p) => threadIds.has(p.id));
    }

    if (onlyReviewGaps) {
      list = list.filter((p) => {
        const degree = edges.filter((edge) => edge.source === p.id || edge.target === p.id).length;
        return degree <= 1 || !p.subfields || p.subfields.length === 0;
      });
    }

    if (activeSavedViewId) {
      const activeSavedView = savedAtlasViews.find((view) => view.id === activeSavedViewId);
      if (activeSavedView) {
        const collectionIds = new Set(activeSavedView.collectionIds);
        list = list.filter((p) => collectionIds.has(p.id));
      }
    }

    // Sorting logic
    const relevanceScore = (p: Thinker) => {
      let score = (p.bridge_score ?? 1) + getSearchRelevanceScore(p);
      if (selectedId && edges.some((edge) => edge.source === selectedId && edge.target === p.id || edge.target === selectedId && edge.source === p.id)) score += 8;
      if (selectedId === p.id) score += 12;
      if (selectedFields.some((field) => p.fields?.includes(field))) score += 3;
      if (selectedEras.includes(p.era || "")) score += 2;
      return score;
    };
    const sorters = {
      birth: (a: Thinker, b: Thinker) => a.birth - b.birth,
      field: (a: Thinker, b: Thinker) => (a.fields?.[0] || "").localeCompare(b.fields?.[0] || "") || a.birth - b.birth,
      bridge: (a: Thinker, b: Thinker) => (b.bridge_score ?? 1) - (a.bridge_score ?? 1),
      name: (a: Thinker, b: Thinker) => a.name.localeCompare(b.name),
      relevance: (a: Thinker, b: Thinker) => relevanceScore(b) - relevanceScore(a) || a.birth - b.birth,
    };

    return list.sort(sorters[sortMode]);
  };

  const processedPeople = getFilteredPeople();

  const fitTimelineToResults = () => {
    if (processedPeople.length === 0) return;

    const births = processedPeople.map((p) => p.birth);
    const deaths = processedPeople.map((p) => p.death ?? 2026);
    const minP = Math.min(...births);
    const maxP = Math.max(...deaths);
    const span = maxP - minP;
    const buffer = Math.max(15, Math.round(span * 0.2));

    setMinYear(Math.max(-650, minP - buffer));
    setMaxYear(Math.min(2030, maxP + buffer));
  };
  const namedTimeRanges = [
    { label: "All Time", start: -650, end: 2030 },
    { label: "Axial Age", start: -650, end: -200 },
    { label: "Classical", start: -500, end: 500 },
    { label: "Late Antique", start: 200, end: 800 },
    { label: "Medieval", start: 500, end: 1500 },
    { label: "Renaissance", start: 1300, end: 1650 },
    { label: "Scientific Rev.", start: 1500, end: 1700 },
    { label: "Enlightenment", start: 1650, end: 1800 },
    { label: "Long 19th", start: 1789, end: 1914 },
    { label: "Modernism", start: 1880, end: 1945 },
    { label: "Postwar", start: 1945, end: 1990 },
    { label: "Contemporary", start: 1990, end: 2030 },
  ];

  const handleToggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]
    );
  };

  const handleToggleSubfield = (sub: string) => {
    setSelectedSubfields((prev) =>
      prev.includes(sub) ? prev.filter((item) => item !== sub) : [...prev, sub]
    );
  };

  const handleToggleLensTag = (tag: string) => {
    setSelectedLensTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleToggleEra = (era: string) => {
    setSelectedEras((prev) =>
      prev.includes(era) ? prev.filter((item) => item !== era) : [...prev, era]
    );
  };

  const handleToggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((item) => item !== region) : [...prev, region]
    );
  };

  const toggleDisciplineGroup = (group: string) => {
    setExpandedDisciplineGroups((prev) =>
      prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group]
    );
  };

  const toggleFacetFieldExpansion = (field: string) => {
    setExpandedFacetFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]
    );
  };

  // Epoch quick snaps helpers
  const applyEpochSnap = (start: number, end: number) => {
    setMinYear(start);
    setMaxYear(end);
  };

  // Contemporaries & BFS action hooks
  const handleFindContemporaries = (id: string) => {
    const p = people.find((item) => item.id === id);
    if (!p) return;

    const birth = p.birth;
    const death = p.death ?? 2024;

    const overlapped = people
      .filter((q) => {
        if (q.id === id) return false;
        const qb = q.birth;
        const qd = q.death ?? 2024;
        const overlapStart = Math.max(birth, qb);
        const overlapEnd = Math.min(death, qd);
        return overlapEnd - overlapStart > 20;
      })
      .sort((a, b) => {
        const overlapA = Math.min(death, a.death ?? 2024) - Math.max(birth, a.birth);
        const overlapB = Math.min(death, b.death ?? 2024) - Math.max(birth, b.birth);
        return overlapB - overlapA;
      })
      .slice(0, 10);

    setOverlapContemps(overlapped);
  };

  const handleShowBFS = (id: string) => {
    const adj: Record<string, string[]> = {};
    people.forEach((p) => {
      adj[p.id] = [];
    });

    edges.forEach((e) => {
      if (adj[e.source]) adj[e.source].push(e.target);
    });

    const levelMap: Record<string, number> = { [id]: 0 };
    const queue: string[] = [id];
    const visited = new Set<string>([id]);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const currentLevel = levelMap[cur];

      if (currentLevel >= 3) continue;

      const successors = adj[cur] || [];
      successors.forEach((next) => {
        if (!visited.has(next)) {
          visited.add(next);
          levelMap[next] = currentLevel + 1;
          queue.push(next);
        }
      });
    }

    const grouped: Record<number, Thinker[]> = {};
    Object.entries(levelMap).forEach(([nodeId, level]) => {
      if (level === 0) return;
      const foundNode = people.find((p) => p.id === nodeId);
      if (foundNode) {
        if (!grouped[level]) grouped[level] = [];
        grouped[level].push(foundNode);
      }
    });

    const result = Object.entries(grouped).map(([level, nodes]) => ({
      depth: Number(level),
      nodes: nodes.slice(0, 8),
    }));

    setBfsMapNodes(result);
  };

  const findShortestPath = (fromId: string, toId: string): string[] | null => {
    if (fromId === toId) return [fromId];

    const adj: Record<string, string[]> = {};
    people.forEach((p) => {
      adj[p.id] = [];
    });
    edges.forEach((e) => {
      if (adj[e.source] && adj[e.target] !== undefined) {
        adj[e.source].push(e.target);
      }
    });

    const queue = [fromId];
    const visited: Record<string, string | null> = { [fromId]: null };

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === toId) break;

      (adj[current] || []).forEach((next) => {
        if (!(next in visited)) {
          visited[next] = current;
          queue.push(next);
        }
      });
    }

    if (!(toId in visited)) return null;

    const path: string[] = [];
    let cursor: string | null = toId;
    while (cursor !== null) {
      path.unshift(cursor);
      cursor = visited[cursor];
    }
    return path;
  };

  const highlightImmediateRelations = (direction: "back" | "forward") => {
    if (!selectedId) return;
    const relatedIds = edges
      .filter((edge) => direction === "back" ? edge.target === selectedId : edge.source === selectedId)
      .map((edge) => direction === "back" ? edge.source : edge.target);

    setHighlightPath([selectedId, ...relatedIds]);
    if (direction === "forward") {
      handleShowBFS(selectedId);
    }
  };

  const showNeighborhood = () => {
    if (!selectedId) return;
    const neighbors = edges
      .filter((edge) => edge.source === selectedId || edge.target === selectedId)
      .map((edge) => (edge.source === selectedId ? edge.target : edge.source));

    setHighlightPath([selectedId, ...Array.from(new Set(neighbors))]);
    handleShowBFS(selectedId);
    setViewMode("network");
  };

  const addSuggestedRelationship = (a: Thinker, b: Thinker, reason: string) => {
    const source = a.birth <= b.birth ? a : b;
    const target = source.id === a.id ? b : a;

    if (edges.some((edge) =>
      (edge.source === source.id && edge.target === target.id) ||
      (edge.source === target.id && edge.target === source.id)
    )) {
      return;
    }

    captureReviewUndoSnapshot(`Added relationship: ${source.name} -> ${target.name}`);
    const nextEdges: InfluenceEdge[] = [
      ...edges,
      {
        source: source.id,
        target: target.id,
        type: "Suggested relationship",
        strength: 2,
        confidence: 0.35,
        status: "suggested",
        note: reason || "Added from Workbench candidate review.",
      },
    ];

    setEdges(nextEdges);
    persistAtlasState(people, nextEdges);
    setHighlightPath([source.id, target.id]);
    selectPerson(target.id, { preserveHighlight: true });
    setViewMode("split");
  };

  const persistLinkReviewQueue = (nextQueue: LinkReviewItem[]) => {
    setLinkReviewQueue(nextQueue);
    localStorage.setItem(LINK_REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(nextQueue));
  };

  const queueLinkReviewItem = (a: Thinker, b: Thinker, reason: string, score: number) => {
    const source = a.birth <= b.birth ? a : b;
    const target = source.id === a.id ? b : a;
    const id = `${source.id}::${target.id}`;
    if (linkReviewQueue.some((item) => item.id === id)) return;
    persistLinkReviewQueue([
      ...linkReviewQueue,
      {
        id,
        sourceId: source.id,
        targetId: target.id,
        sourceName: source.name,
        targetName: target.name,
        reason,
        score,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const acceptLinkReviewItem = (item: LinkReviewItem) => {
    const source = people.find((person) => person.id === item.sourceId);
    const target = people.find((person) => person.id === item.targetId);
    if (source && target) addSuggestedRelationship(source, target, item.reason);
    persistLinkReviewQueue(linkReviewQueue.filter((queuedItem) => queuedItem.id !== item.id));
  };

  const rejectLinkReviewItem = (item: LinkReviewItem) => {
    persistLinkReviewQueue(linkReviewQueue.filter((queuedItem) => queuedItem.id !== item.id));
    setRejectedLinkSuggestionKeys((prev) => {
      const next = new Set(prev);
      next.add(getLinkSuggestionKey(item.sourceId, item.targetId));
      next.add(getLinkSuggestionKey(item.targetId, item.sourceId));
      localStorage.setItem(REJECTED_LINK_SUGGESTIONS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const addManualRelationship = () => {
    if (!selectedThinker) return;

    const normalizedTarget = relationshipDraft.targetName.trim().toLowerCase();
    const target = people.find((person) =>
      person.name.toLowerCase() === normalizedTarget || person.id.toLowerCase() === normalizedTarget
    );
    if (!target || target.id === selectedThinker.id) return;

    const sourceId = relationshipDraft.direction === "out" ? selectedThinker.id : target.id;
    const targetId = relationshipDraft.direction === "out" ? target.id : selectedThinker.id;

    if (edges.some((edge) => edge.source === sourceId && edge.target === targetId)) {
      setHighlightPath([sourceId, targetId]);
      selectPerson(target.id, { preserveHighlight: true });
      return;
    }

    captureReviewUndoSnapshot(`Added relationship: ${selectedThinker.name} -> ${target.name}`);
    const nextEdges: InfluenceEdge[] = [
      ...edges,
      {
        source: sourceId,
        target: targetId,
        type: relationshipDraft.type.trim() || "Influence",
        strength: relationshipDraft.strength,
        confidence: relationshipDraft.confidence,
        status: "accepted",
        note: relationshipDraft.note.trim() || null,
      },
    ];

    setEdges(nextEdges);
    persistAtlasState(people, nextEdges);
    setHighlightPath([sourceId, targetId]);
    selectPerson(target.id, { preserveHighlight: true });
    setRelationshipDraft((prev) => ({ ...prev, targetName: "", note: "" }));
    setViewMode("split");
  };

  const updateThinkerTopics = (id: string, topics: string[]) => {
    const normalizedTopics = Array.from(new Set(topics.map((topic) => topic.trim()).filter(Boolean)));
    const nextPeople = people.map((person) =>
      person.id === id ? { ...person, subfields: normalizedTopics } : person
    );
    setPeople(nextPeople);
    persistAtlasState(nextPeople, edges);
  };

  const toggleThinkerTopic = (id: string, topic: string) => {
    const person = people.find((item) => item.id === id);
    if (!person) return;
    const currentTopics = person.subfields || [];
    updateThinkerTopics(
      id,
      currentTopics.includes(topic)
        ? currentTopics.filter((item) => item !== topic)
        : [...currentTopics, topic]
    );
  };

  const getTopicSuggestions = (person: Thinker) =>
    Array.from(new Set([
      ...person.fields.flatMap((field) => CONTROLLED_TOPICS[field] || []),
      ...Object.values(inferLensTags(person)).flat().map(getLensOptionLabel),
    ])).slice(0, 14);

  const inferEraFromYear = (year: number | null) => {
    if (year === null || Number.isNaN(year)) return null;
    const band = ERA_BANDS.find((item) => year >= item.s && year < item.e);
    if (!band) return year < ERA_BANDS[0].s ? ERA_BANDS[0].label : ERA_BANDS[ERA_BANDS.length - 1].label;
    return band.label === "Scientific Rev." ? "Scientific Revolution" : band.label;
  };

  const acceptImportDraft = () => {
    const name = importDraft.name.trim();
    const birth = Number(importDraft.birth);
    if (!name || Number.isNaN(birth)) return;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const uniqueId = people.some((person) => person.id === slug)
      ? `${slug}_${Date.now().toString(36)}`
      : slug;
    const topics = importDraft.topics
      .split(",")
      .map((topic) => topic.trim())
      .filter(Boolean);
    const sourceName = EXTERNAL_SOURCES.find((source) => source.id === importDraft.source)?.name || "External source";

    const newThinker: Thinker = {
      id: uniqueId,
      name,
      birth,
      death: importDraft.death.trim() ? Number(importDraft.death) : null,
      fields: [importDraft.field],
      subfields: topics,
      region: importDraft.region.trim() || null,
      era: importDraft.era.trim() || inferEraFromYear(birth),
      movement: importDraft.movement.trim() || "Imported",
      bridge_score: inferBridgeScoreForImportDraft(topics),
      works: [],
      influenced: [],
      notes: [
        importDraft.notes.trim(),
        `Imported from ${sourceName}${importDraft.sourceUrl.trim() ? `: ${importDraft.sourceUrl.trim()}` : ""}`,
      ].filter(Boolean).join(" "),
    };

    captureReviewUndoSnapshot(`Accepted import: ${newThinker.name}`);
    handleAddThinker(newThinker);
    if (draftQueueItemId) {
      removeImportReviewItem(draftQueueItemId, "accepted", "Accepted from edited import draft");
    }
    setImportDraft((prev) => ({
      ...prev,
      name: "",
      birth: "",
      death: "",
      region: "",
      era: "",
      movement: "",
      topics: "",
      sourceUrl: "",
      notes: "",
    }));
    setDraftQueueItemId(null);
    setWorkbenchTab("candidateRelationships");
  };

  const clearImportDraft = () => {
    setImportDraft((prev) => ({
      ...prev,
      name: "",
      birth: "",
      death: "",
      region: "",
      era: "",
      movement: "",
      topics: "",
      sourceUrl: "",
      notes: "",
    }));
    setDraftQueueItemId(null);
  };

  const normalizeName = normalizeEntityName;
  const getLinkSuggestionKey = (candidateId: string, personId: string) => `${candidateId}::${personId}`;
  const rejectCandidateLinkSuggestion = (candidateId: string, personId: string) => {
    const suggestionKey = getLinkSuggestionKey(candidateId, personId);
    setRejectedLinkSuggestionKeys((prev) => {
      const next = new Set(prev);
      next.add(suggestionKey);
      localStorage.setItem(REJECTED_LINK_SUGGESTIONS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
    setOpenSuggestionDetailKey(null);
  };

  const inferFieldFromExternalText = (text: string) => {
    const value = text.toLowerCase();
    if (value.includes("mathematician")) return "Mathematics";
    if (value.includes("philosopher")) return "Philosophy";
    if (value.includes("physicist")) return "Physics";
    if (value.includes("chemist")) return "Chemistry";
    if (value.includes("biologist") || value.includes("naturalist")) return "Biology";
    if (value.includes("computer") || value.includes("programmer")) return "Computing";
    if (value.includes("economist")) return "Economics";
    if (value.includes("writer") || value.includes("poet") || value.includes("novelist")) return "Literature";
    if (value.includes("astronomer")) return "Astronomy";
    if (value.includes("engineer") || value.includes("inventor")) return "Engineering";
    if (value.includes("historian")) return "History";
    return "Philosophy";
  };

  const getAutoTopicsForCandidate = (candidate: WikidataCandidate) => {
    const fields = candidate.fields && candidate.fields.length > 0
      ? candidate.fields
      : [inferFieldFromExternalText(candidate.description)];
    const sourceText = normalizeName([
      candidate.description,
      candidate.movement || "",
      ...(candidate.works || []),
      ...fields,
    ].join(" "));
    const controlledTopics = Array.from(new Set([
      ...fields.flatMap((field) => CONTROLLED_TOPICS[field] || []),
      ...Object.values(CONTROLLED_TOPICS).flat(),
    ]));
    const matchedTopics = controlledTopics.filter((topic) => {
      const normalizedTopic = normalizeName(topic);
      const topicTokens = normalizedTopic.split(" ").filter((token) => token.length >= 5);
      return sourceText.includes(normalizedTopic) || topicTokens.some((token) => sourceText.includes(token));
    });
    return Array.from(new Set([...(candidate.topics || []), ...matchedTopics])).slice(0, 12);
  };

  const getCandidateSourceName = (candidate: WikidataCandidate) =>
    candidate.sourceUrl === "manual-paste" ? "manual paste" : "Wikidata";

  const getCandidateSourceUrl = (candidate: WikidataCandidate) =>
    candidate.sourceUrl === "manual-paste" ? "" : candidate.wikipediaUrl || candidate.sourceUrl;

  const getDuplicateIdForCandidate = (candidate: WikidataCandidate) => findDuplicateCandidateId(candidate, people);

  const candidateToThinkerDraft = (candidate: WikidataCandidate): Thinker => ({
    id: candidate.id,
    name: candidate.name,
    birth: candidate.birth ?? 0,
    death: candidate.death,
    fields: candidate.fields && candidate.fields.length > 0
      ? candidate.fields
      : [inferFieldFromExternalText(candidate.description)],
    subfields: getAutoTopicsForCandidate(candidate),
    region: candidate.region || null,
    era: candidate.era || inferEraFromYear(candidate.birth),
    movement: candidate.movement || "Imported",
    bridge_score: 2,
    works: candidate.works || [],
    influenced: [],
    notes: candidate.description || null,
  });

  const getCandidateLinkSuggestions = (candidate: WikidataCandidate) => {
    const draft = candidateToThinkerDraft(candidate);

    return people
      .map((person) => scoreCandidateRelationship(candidate, draft, person))
      .filter((item) => item.score >= 4 && !rejectedLinkSuggestionKeys.has(getLinkSuggestionKey(candidate.id, item.person.id)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };

  const inferBridgeScoreForCandidate = (candidate: WikidataCandidate) => {
    const topicCount = getAutoTopicsForCandidate(candidate).length;
    const linkCount = getCandidateLinkSuggestions(candidate).filter((item) => item.confidence !== "weak").length;
    const metadataSignals = [
      (candidate.fields || []).length > 1,
      topicCount >= 4,
      (candidate.works || []).length >= 2,
      !!candidate.movement,
      linkCount >= 2,
    ].filter(Boolean).length;
    return Math.max(1, Math.min(5, 2 + metadataSignals));
  };

  const inferBridgeScoreForImportDraft = (topics: string[]) => {
    const signals = [
      topics.length >= 4,
      importDraft.sourceUrl.trim() !== "",
      importDraft.notes.trim().length > 80,
      importDraft.movement.trim() !== "",
    ].filter(Boolean).length;
    return Math.max(1, Math.min(5, 2 + signals));
  };

  const queueWikidataCandidate = (candidate: WikidataCandidate, confidence = 90) => {
    const duplicateId = getDuplicateIdForCandidate(candidate);
    setImportReviewQueue((prev) => {
      if (prev.some((item) => item.candidate.id === candidate.id)) return prev;
      const next = [...prev, {
        id: `${candidate.id}-${Date.now().toString(36)}`,
        candidate,
        confidence,
        duplicateId,
        status: duplicateId ? "duplicate" : "queued",
      }];
      persistImportReviewQueueToStorage(next);
      return next;
    });
  };

  const persistImportAuditLog = (nextLog: ImportAuditLogItem[]) => {
    const cappedLog = nextLog.slice(0, 100);
    setImportAuditLog(cappedLog);
    localStorage.setItem("atlas_import_audit_log_v1", JSON.stringify(cappedLog));
  };

  const logImportReviewItems = (items: ImportReviewItem[], status: ImportReviewStatus, reason: string) => {
    if (items.length === 0) return;
    const reviewedAt = new Date().toISOString();
    const nextEntries = items.map((item) => ({
      id: `${item.id}-${status}-${Date.now().toString(36)}`,
      candidateId: item.candidate.id,
      candidateName: item.candidate.name,
      confidence: item.confidence,
      status,
      reason,
      sourceUrl: item.candidate.wikipediaUrl || item.candidate.sourceUrl,
      reviewedAt,
    }));
    persistImportAuditLog([...nextEntries, ...importAuditLog]);
  };

  const removeImportReviewItem = (id: string, status: ImportReviewStatus = "skipped", reason = "Skipped from review queue") => {
    const itemToRemove = importReviewQueue.find((item) => item.id === id);
    if (itemToRemove) logImportReviewItems([itemToRemove], status, reason);
    setImportReviewQueue((prev) => {
      const next = prev.filter((item) => item.id !== id);
      persistImportReviewQueueToStorage(next);
      return next;
    });
    if (draftQueueItemId === id) setDraftQueueItemId(null);
  };

  const getCandidateConfidence = scoreCandidateConfidence;

  const getImportQualityLabels = (candidate: WikidataCandidate, confidence: number): ImportQualityLabel[] => {
    const candidateSourceUrl = getCandidateSourceUrl(candidate);
    const structuredSignalCount = [
      candidate.birth !== null,
      (candidate.fields || []).length > 0,
      (candidate.topics || []).length > 0,
      (candidate.works || []).length > 0,
      !!candidate.movement,
    ].filter(Boolean).length;
    const labels: ImportQualityLabel[] = [
      candidate.sourceUrl === "manual-paste"
        ? { label: "Manual paste", tone: "medium" }
        : candidate.wikipediaUrl
        ? { label: "Wikidata article", tone: "strong" }
        : { label: "Wikidata entity", tone: "medium" },
      structuredSignalCount >= 4
        ? { label: "Rich metadata", tone: "strong" }
        : structuredSignalCount >= 2
        ? { label: "Usable metadata", tone: "medium" }
        : { label: "Sparse metadata", tone: "warning" },
      confidence >= importConfidenceThreshold
        ? { label: "Auto-ready", tone: "strong" }
        : { label: "Needs review", tone: "weak" },
    ];
    if (!candidateSourceUrl) labels.push({ label: "Source gap", tone: "warning" });
    if (candidate.birth === null) labels.push({ label: "Missing dates", tone: "warning" });
    if ((candidate.works || []).length > 0) labels.push({ label: "Works found", tone: "medium" });
    return labels.slice(0, 4);
  };

  const getImportQualityClass = (tone: ImportQualityLabel["tone"]) =>
    tone === "strong"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "medium"
      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
      : tone === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-slate-700 bg-slate-700/20 text-slate-500";

  const acceptWikidataCandidate = (candidate: WikidataCandidate) => {
    if (candidate.birth === null) return;
    const duplicateId = getDuplicateIdForCandidate(candidate);
    if (duplicateId) {
      selectPerson(duplicateId);
      return;
    }

    const field = candidate.fields?.[0] || inferFieldFromExternalText(candidate.description);
    const slug = candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    captureReviewUndoSnapshot(`Accepted import: ${candidate.name}`);
    handleAddThinker({
      id: people.some((person) => person.id === slug) ? `${slug}_${candidate.id.toLowerCase()}` : slug,
      name: candidate.name,
      birth: candidate.birth,
      death: candidate.death,
      fields: [field],
      subfields: getAutoTopicsForCandidate(candidate),
      region: candidate.region || null,
      era: candidate.era || inferEraFromYear(candidate.birth),
      movement: candidate.movement || "Imported",
      bridge_score: inferBridgeScoreForCandidate(candidate),
      works: candidate.works || [],
      influenced: [],
      notes: `${candidate.description || "Imported candidate."} Imported from ${getCandidateSourceName(candidate)}${getCandidateSourceUrl(candidate) ? `: ${getCandidateSourceUrl(candidate)}` : ""}`,
    });
  };

  const acceptImportReviewItem = (item: ImportReviewItem, linkTopSuggestion = false) => {
    const candidate = item.candidate;
    if (candidate.birth === null) return;
    const duplicateId = getDuplicateIdForCandidate(candidate);
    if (duplicateId) {
      selectPerson(duplicateId);
      removeImportReviewItem(item.id, "duplicate", "Matched an existing thinker during accept");
      return;
    }

    const field = candidate.fields?.[0] || inferFieldFromExternalText(candidate.description);
    const slug = candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const newId = people.some((person) => person.id === slug) ? `${slug}_${candidate.id.toLowerCase()}` : slug;
    const newThinker: Thinker = {
      id: newId,
      name: candidate.name,
      birth: candidate.birth,
      death: candidate.death,
      fields: [field],
      subfields: getAutoTopicsForCandidate(candidate),
      region: candidate.region || null,
      era: candidate.era || inferEraFromYear(candidate.birth),
      movement: candidate.movement || "Imported",
      bridge_score: inferBridgeScoreForCandidate(candidate),
      works: candidate.works || [],
      influenced: [],
      notes: `${candidate.description || "Imported candidate."} Imported from ${getCandidateSourceName(candidate)}${getCandidateSourceUrl(candidate) ? `: ${getCandidateSourceUrl(candidate)}` : ""}`,
    };

    captureReviewUndoSnapshot(`Accepted import: ${newThinker.name}`);
    const nextPeople = [...people, newThinker];
    let nextEdges = edges;
    const topSuggestion = getCandidateLinkSuggestions(candidate)[0];
    if (linkTopSuggestion && topSuggestion) {
      const source = topSuggestion.person.birth <= newThinker.birth ? topSuggestion.person : newThinker;
      const target = source.id === topSuggestion.person.id ? newThinker : topSuggestion.person;
      nextEdges = [
        ...edges,
        {
          source: source.id,
          target: target.id,
          type: topSuggestion.category,
          strength: 2,
          confidence: 0.35,
          status: "suggested",
          note: `Imported with suggested context: ${topSuggestion.confidenceExplanation}; ${topSuggestion.reasons.join(", ") || "nearby chronology"}`,
          sourceClaims: [getCandidateSourceUrl(candidate)].filter(Boolean),
        },
      ];
      setEdges(nextEdges);
      setHighlightPath([source.id, target.id]);
    }

    setPeople(nextPeople);
    persistAtlasState(nextPeople, nextEdges);
    selectPerson(newId, { preserveHighlight: Boolean(topSuggestion) });
    setViewMode("split");
    removeImportReviewItem(item.id, "accepted", linkTopSuggestion ? "Accepted with top suggested link" : "Accepted from review queue");
    setWorkbenchTab("candidateRelationships");
  };

  const createThinkerFromImportCandidate = (candidate: WikidataCandidate, id: string): Thinker => {
    const field = candidate.fields?.[0] || inferFieldFromExternalText(candidate.description);
    return {
      id,
      name: candidate.name,
      birth: candidate.birth ?? 0,
      death: candidate.death,
      fields: [field],
      subfields: getAutoTopicsForCandidate(candidate),
      region: candidate.region || null,
      era: candidate.era || inferEraFromYear(candidate.birth),
      movement: candidate.movement || "Imported",
      bridge_score: inferBridgeScoreForCandidate(candidate),
      works: candidate.works || [],
      influenced: [],
      notes: `${candidate.description || "Imported candidate."} Imported from ${getCandidateSourceName(candidate)}${getCandidateSourceUrl(candidate) ? `: ${getCandidateSourceUrl(candidate)}` : ""}`,
    };
  };

  const createUniqueImportId = (candidate: WikidataCandidate, existingIds: Set<string>) => {
    const slug = candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || candidate.id.toLowerCase();
    const candidateSuffix = candidate.id.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    let nextId = existingIds.has(slug) ? `${slug}_${candidateSuffix}` : slug;
    let suffix = 2;
    while (existingIds.has(nextId)) {
      nextId = `${slug}_${candidateSuffix}_${suffix}`;
      suffix += 1;
    }
    existingIds.add(nextId);
    return nextId;
  };

  const mergeUniqueValues = (left: string[] = [], right: string[] = []) =>
    Array.from(new Set([...left, ...right].map((item) => item.trim()).filter(Boolean)));

  const persistImportReviewQueue = (nextQueue: ImportReviewItem[]) => {
    setImportReviewQueue(nextQueue);
    persistImportReviewQueueToStorage(nextQueue);
    if (draftQueueItemId && !nextQueue.some((item) => item.id === draftQueueItemId)) {
      setDraftQueueItemId(null);
    }
  };

  const updateImportReviewItemStatus = (id: string, status: ImportReviewStatus) => {
    const nextQueue = importReviewQueue.map((item) =>
      item.id === id ? { ...item, status } : item
    );
    persistImportReviewQueue(nextQueue);
  };

  const mergeImportReviewItemIntoDuplicate = (item: ImportReviewItem, duplicateId: string) => {
    const candidate = item.candidate;
    const sourceUrl = getCandidateSourceUrl(candidate);
    captureReviewUndoSnapshot(`Merged import metadata: ${candidate.name}`);
    const updatedPeople = people.map((person) => {
      if (person.id !== duplicateId) return person;
      const sourceNote = `Merged duplicate import from Wikidata: ${sourceUrl}`;
      return {
        ...person,
        fields: mergeUniqueValues(person.fields, candidate.fields && candidate.fields.length > 0 ? candidate.fields : [inferFieldFromExternalText(candidate.description)]),
        subfields: mergeUniqueValues(person.subfields, getAutoTopicsForCandidate(candidate)),
        works: mergeUniqueValues(person.works, candidate.works),
        region: person.region || candidate.region || null,
        era: person.era || candidate.era || inferEraFromYear(candidate.birth),
        movement: person.movement || candidate.movement || "Imported",
        notes: [person.notes, candidate.description, sourceNote].filter(Boolean).join(" "),
      };
    });
    setPeople(updatedPeople);
    persistAtlasState(updatedPeople, edges);
    logImportReviewItems([item], "accepted", `Merged duplicate metadata into ${people.find((person) => person.id === duplicateId)?.name || "existing thinker"}`);
    persistImportReviewQueue(importReviewQueue.filter((queueItem) => queueItem.id !== item.id));
    selectPerson(duplicateId);
    setViewMode("split");
    setWorkbenchTab("candidateRelationships");
  };

  const acceptImportReviewItems = (items: ImportReviewItem[], linkTopSuggestion = false) => {
    const acceptedItemIds = new Set<string>();
    const existingIds = new Set<string>(people.map((person) => person.id));
    const existingNames = new Set<string>(people.map((person) => normalizeName(person.name)));
    const nextPeople = [...people];
    const nextEdges = [...edges];
    let lastAcceptedId: string | null = null;
    let lastHighlightPath: string[] = [];

    items.forEach((item) => {
      const candidate = item.candidate;
      if (candidate.birth === null || existingNames.has(normalizeName(candidate.name))) return;

      const newId = createUniqueImportId(candidate, existingIds);
      const newThinker = createThinkerFromImportCandidate(candidate, newId);
      const topSuggestion = linkTopSuggestion ? getCandidateLinkSuggestions(candidate)[0] : null;
      nextPeople.push(newThinker);
      existingNames.add(normalizeName(candidate.name));
      acceptedItemIds.add(item.id);
      lastAcceptedId = newId;

      if (topSuggestion) {
        const source = topSuggestion.person.birth <= newThinker.birth ? topSuggestion.person : newThinker;
        const target = source.id === topSuggestion.person.id ? newThinker : topSuggestion.person;
        nextEdges.push({
          source: source.id,
          target: target.id,
          type: topSuggestion.category,
          strength: 2,
          confidence: 0.35,
          status: "suggested",
          note: `Imported with suggested context: ${topSuggestion.confidenceExplanation}; ${topSuggestion.reasons.join(", ") || "nearby chronology"}`,
          sourceClaims: [getCandidateSourceUrl(candidate)].filter(Boolean),
        });
        lastHighlightPath = [source.id, target.id];
      }
    });

    if (acceptedItemIds.size === 0) return;

    captureReviewUndoSnapshot(`Accepted ${acceptedItemIds.size} import${acceptedItemIds.size === 1 ? "" : "s"}`);
    setPeople(nextPeople);
    setEdges(nextEdges);
    persistAtlasState(nextPeople, nextEdges);
    logImportReviewItems(
      importReviewQueue.filter((item) => acceptedItemIds.has(item.id)),
      "accepted",
      linkTopSuggestion ? "Bulk accepted with top suggested link" : "Bulk accepted from review queue"
    );
    persistImportReviewQueue(importReviewQueue.filter((item) => !acceptedItemIds.has(item.id)));
    if (lastAcceptedId) {
      selectPerson(lastAcceptedId, { preserveHighlight: lastHighlightPath.length > 0 });
      setViewMode("split");
    }
    if (lastHighlightPath.length > 0) setHighlightPath(lastHighlightPath);
  };

  const clearDuplicateImportReviewItems = () => {
    const duplicateItems = importReviewQueue.filter((item) => getDuplicateIdForCandidate(item.candidate));
    logImportReviewItems(duplicateItems, "duplicate", "Cleared duplicate candidates");
    persistImportReviewQueue(importReviewQueue.filter((item) => !getDuplicateIdForCandidate(item.candidate)));
  };

  const clearLowConfidenceImportReviewItems = () => {
    const lowConfidenceItems = importReviewQueue.filter((item) => item.confidence < importConfidenceThreshold);
    logImportReviewItems(lowConfidenceItems, "skipped", `Cleared below ${importConfidenceThreshold}% threshold`);
    persistImportReviewQueue(importReviewQueue.filter((item) => item.confidence >= importConfidenceThreshold));
  };

  const clearImportReviewQueue = () => {
    if (!window.confirm("Clear all queued import candidates?")) return;
    logImportReviewItems(importReviewQueue, "skipped", "Cleared entire review queue");
    persistImportReviewQueue([]);
  };

  const clearImportAuditLog = () => {
    persistImportAuditLog([]);
  };

  const updateImportConfidenceThreshold = (value: number) => {
    const nextThreshold = Math.max(0, Math.min(100, Math.round(value)));
    setImportConfidenceThreshold(nextThreshold);
    localStorage.setItem("atlas_import_confidence_threshold_v1", String(nextThreshold));
  };

  const searchWikidataCandidates = async () => {
    const query = wikidataQuery.trim();
    if (!query) return;

    setWikidataLoading(true);
    try {
      const response = await fetch(`/api/import/wikidata/search?q=${encodeURIComponent(query)}`);
      const json = await response.json();
      setWikidataCandidates(Array.isArray(json.candidates) ? json.candidates : []);
    } catch {
      setWikidataCandidates([]);
    } finally {
      setWikidataLoading(false);
    }
  };

  const searchWikidataBatch = async () => {
    const names = wikidataBatchText
      .split(/\r?\n|,/)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 25);
    if (names.length === 0) return;

    setWikidataLoading(true);
    const results: typeof wikidataBatchCandidates = [];
    for (const name of names) {
      try {
        const response = await fetch(`/api/import/wikidata/search?q=${encodeURIComponent(name)}`);
        const json = await response.json();
        const candidate = Array.isArray(json.candidates) ? json.candidates[0] || null : null;
        results.push({
          query: name,
          candidate,
          confidence: getCandidateConfidence(name, candidate),
          duplicateId: candidate ? getDuplicateIdForCandidate(candidate) : null,
        });
      } catch {
        results.push({ query: name, candidate: null, confidence: 0, duplicateId: null });
      }
    }
    setWikidataBatchCandidates(results);
    setWikidataLoading(false);
  };

  const queuePastedImportRows = () => {
    const rows = wikidataBatchText
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter((row) => row.includes("|"))
      .slice(0, 25);

    rows.forEach((row) => {
      const [rawName, rawBirth, rawDeath, rawField, ...noteParts] = row.split("|").map((part) => part.trim());
      const birth = Number(rawBirth);
      if (!rawName || Number.isNaN(birth)) return;
      const death = rawDeath && !Number.isNaN(Number(rawDeath)) ? Number(rawDeath) : null;
      const notes = noteParts.join(" | ").trim();
      const field = rawField || inferFieldFromExternalText(notes);
      const candidate: WikidataCandidate = {
        id: `manual-${normalizeName(rawName)}-${Date.now().toString(36)}`,
        name: rawName,
        description: notes || "Manual pasted import.",
        birth,
        death,
        fields: [field],
        topics: [],
        region: null,
        era: inferEraFromYear(birth),
        movement: "",
        works: [],
        sourceUrl: "manual-paste",
        wikipediaUrl: null,
      };
      const confidence = Math.min(95, 55 + (field ? 15 : 0) + (notes ? 15 : 0) + (death !== null ? 5 : 0));
      queueWikidataCandidate(candidate, confidence);
    });
  };

  const parseCsvRows = (text: string) => {
    const rows: string[][] = [];
    let field = "";
    let row: string[] = [];
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];
      if (char === "\"" && inQuotes && nextChar === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(field.trim());
        field = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") index += 1;
        row.push(field.trim());
        if (row.some(Boolean)) rows.push(row);
        field = "";
        row = [];
      } else {
        field += char;
      }
    }

    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  };

  const importCsvToReviewQueue = async (file: File) => {
    const rows = parseCsvRows(await file.text());
    if (rows.length < 2) return;
    const headers = rows[0].map((header) => normalizeName(header));
    const getValue = (row: string[], names: string[]) => {
      const index = headers.findIndex((header) => names.map(normalizeName).includes(header));
      return index >= 0 ? row[index] || "" : "";
    };

    rows.slice(1, 101).forEach((row, index) => {
      const name = getValue(row, ["name", "person", "thinker"]).trim();
      const birth = Number(getValue(row, ["birth", "birthYear", "born"]));
      if (!name || Number.isNaN(birth)) return;
      const rawDeath = getValue(row, ["death", "deathYear", "died"]);
      const death = rawDeath && !Number.isNaN(Number(rawDeath)) ? Number(rawDeath) : null;
      const field = getValue(row, ["field", "discipline", "domain"]) || inferFieldFromExternalText(getValue(row, ["notes", "description"]));
      const notes = getValue(row, ["notes", "description", "summary"]);
      const topics = getValue(row, ["topics", "subfields", "tags"])
        .split(/[;|]/)
        .map((topic) => topic.trim())
        .filter(Boolean);
      const sourceUrl = getValue(row, ["sourceUrl", "source", "url"]);
      const candidate: WikidataCandidate = {
        id: `csv-${normalizeName(name)}-${index}-${Date.now().toString(36)}`,
        name,
        description: notes || "CSV imported candidate.",
        birth,
        death,
        fields: [field],
        topics,
        region: getValue(row, ["region", "place"]) || null,
        era: getValue(row, ["era"]) || inferEraFromYear(birth),
        movement: getValue(row, ["movement", "school"]) || null,
        works: getValue(row, ["works", "work"])
          .split(/[;|]/)
          .map((work) => work.trim())
          .filter(Boolean),
        sourceUrl: sourceUrl || "manual-paste",
        wikipediaUrl: sourceUrl.includes("wikipedia.org") ? sourceUrl : null,
      };
      const confidence = Math.min(95, 60 + (field ? 10 : 0) + (topics.length > 0 ? 10 : 0) + (sourceUrl ? 10 : 0));
      queueWikidataCandidate(candidate, confidence);
    });
  };

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await importCsvToReviewQueue(file);
    event.target.value = "";
  };

  const escapeCsvValue = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  };

  const exportPeopleCsv = () => {
    const headers = ["id", "name", "birth", "death", "fields", "topics", "region", "era", "movement", "works", "notes"];
    const csv = [
      headers.join(","),
      ...people.map((person) => [
        person.id,
        person.name,
        person.birth,
        person.death ?? "",
        (person.fields || []).join("; "),
        (person.subfields || []).join("; "),
        person.region || "",
        person.era || "",
        person.movement || "",
        (person.works || []).join("; "),
        person.notes || "",
      ].map(escapeCsvValue).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "intellectual-history-atlas-people.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAtlasJson = () => {
    const state = {
      version: 1,
      exportedAt: new Date().toISOString(),
      importQueueSchemaVersion: IMPORT_QUEUE_SCHEMA_VERSION,
      people,
      edges,
      importReviewQueue,
      importAuditLog,
      linkReviewQueue,
      importConfidenceThreshold,
      rejectedLinkSuggestionKeys: Array.from(rejectedLinkSuggestionKeys),
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "intellectual-history-atlas-state.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importAtlasJson = async (file: File) => {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.people) || !Array.isArray(parsed.edges)) {
      window.alert("This JSON file is not an exported atlas state.");
      return;
    }
    const nextPeople = parsed.people.filter(Boolean);
    const nextEdges = parsed.edges.filter(Boolean);
    const nextQueue = normalizeStoredImportReviewQueue(parsed.importReviewQueue);
    const nextAuditLog = Array.isArray(parsed.importAuditLog) ? parsed.importAuditLog.filter(Boolean).slice(0, 100) : [];
    const nextLinkQueue = normalizeLinkReviewQueue(parsed.linkReviewQueue);
    const nextThreshold = Number.isFinite(Number(parsed.importConfidenceThreshold))
      ? Math.max(0, Math.min(100, Number(parsed.importConfidenceThreshold)))
      : importConfidenceThreshold;
    const nextRejectedSuggestionKeys = new Set<string>(
      Array.isArray(parsed.rejectedLinkSuggestionKeys)
        ? parsed.rejectedLinkSuggestionKeys.filter((key: unknown): key is string => typeof key === "string")
        : []
    );
    const exportedAt = typeof parsed.exportedAt === "string" ? parsed.exportedAt : "unknown date";
    const restoreConfirmed = window.confirm(
      [
        `Restore exported atlas state from ${exportedAt}?`,
        "",
        `Current: ${people.length} thinkers, ${edges.length} edges, ${importReviewQueue.length} queued imports.`,
        `Incoming: ${nextPeople.length} thinkers, ${nextEdges.length} edges, ${nextQueue.length} queued imports.`,
        "",
        "This replaces the current local atlas state.",
      ].join("\n")
    );
    if (!restoreConfirmed) return;

    setPeople(nextPeople);
    setEdges(nextEdges);
    setImportReviewQueue(nextQueue);
    setImportAuditLog(nextAuditLog);
    setLinkReviewQueue(nextLinkQueue);
    setImportConfidenceThreshold(nextThreshold);
    setRejectedLinkSuggestionKeys(nextRejectedSuggestionKeys);
    persistAtlasState(nextPeople, nextEdges);
    persistImportReviewQueueToStorage(nextQueue);
    localStorage.setItem("atlas_import_audit_log_v1", JSON.stringify(nextAuditLog));
    localStorage.setItem(LINK_REVIEW_QUEUE_STORAGE_KEY, JSON.stringify(nextLinkQueue));
    localStorage.setItem("atlas_import_confidence_threshold_v1", String(nextThreshold));
    localStorage.setItem(REJECTED_LINK_SUGGESTIONS_STORAGE_KEY, JSON.stringify(Array.from(nextRejectedSuggestionKeys)));
  };

  const handleJsonImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await importAtlasJson(file);
    event.target.value = "";
  };

  const acceptHighConfidenceWikidataBatch = () => {
    wikidataBatchCandidates
      .filter((item) => item.candidate && item.confidence >= importConfidenceThreshold && !item.duplicateId)
      .forEach((item) => queueWikidataCandidate(item.candidate!, item.confidence));
  };

  const useWikidataCandidate = (candidate: WikidataCandidate, queueItemId: string | null = null) => {
    if (queueItemId) updateImportReviewItemStatus(queueItemId, "edited");
    setImportDraft((prev) => ({
      ...prev,
      source: "wikidata",
      name: candidate.name,
      birth: candidate.birth === null ? "" : String(candidate.birth),
      death: candidate.death === null ? "" : String(candidate.death),
      field: candidate.fields?.[0] || inferFieldFromExternalText(candidate.description),
      region: candidate.region || "",
      era: candidate.era || inferEraFromYear(candidate.birth) || "",
      movement: candidate.movement || "",
      topics: getAutoTopicsForCandidate(candidate).join(", "),
      sourceUrl: getCandidateSourceUrl(candidate),
      notes: candidate.description,
    }));
    setDraftQueueItemId(queueItemId);
  };

  const hasActiveFilters = selectedFields.length > 0 || selectedSubfields.length > 0 || selectedLensTags.length > 0 || selectedEras.length > 0 || selectedRegions.length > 0 || minYear !== -650 || maxYear !== 2030 || onlyConnectedToFocus || onlyCurrentThread || onlyReviewGaps || Boolean(activeSavedViewId);
  const activeFiltersCount = selectedFields.length + selectedSubfields.length + selectedLensTags.length + selectedEras.length + selectedRegions.length + (minYear !== -650 || maxYear !== 2030 ? 1 : 0) + (onlyConnectedToFocus ? 1 : 0) + (onlyCurrentThread ? 1 : 0) + (onlyReviewGaps ? 1 : 0) + (activeSavedViewId ? 1 : 0);
  const activeSavedView = activeSavedViewId ? savedAtlasViews.find((view) => view.id === activeSavedViewId) || null : null;
  const selectedThinker = selectedId ? people.find((p) => p.id === selectedId) : null;
  const selectedIncomingCount = selectedId ? edges.filter((e) => e.target === selectedId).length : 0;
  const selectedOutgoingCount = selectedId ? edges.filter((e) => e.source === selectedId).length : 0;
  const resetFilters = () => {
    setSelectedFields([]);
    setSelectedSubfields([]);
    setSelectedLensTags([]);
    setSelectedEras([]);
    setSelectedRegions([]);
    setOnlyConnectedToFocus(false);
    setOnlyCurrentThread(false);
    setOnlyReviewGaps(false);
    setActiveSavedViewId(null);
    setMinYear(-650);
    setMaxYear(2030);
  };
  const applyFilterPreset = (preset: "ancient" | "science" | "review" | "focus") => {
    resetFilters();
    setFilterDrawerOpen(false);

    if (preset === "ancient") {
      setSelectedEras(["Ancient"]);
      setMinYear(-650);
      setMaxYear(500);
      return;
    }

    if (preset === "science") {
      setSelectedFields(["Physics", "Astronomy", "Mathematics", "Biology", "Chemistry"]);
      setSortMode("relevance");
      return;
    }

    if (preset === "review") {
      setOnlyReviewGaps(true);
      setSortMode("relevance");
      return;
    }

    setOnlyConnectedToFocus(true);
    setSortMode("relevance");
  };
  const workspaceOptions: Array<{
    id: Workspace;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "atlas", label: "Influence Atlas", shortLabel: "Atlas", icon: List },
    { id: "sources", label: "Source Studio", shortLabel: "Sources", icon: Filter },
    { id: "focus", label: "Focus / Presentation", shortLabel: "Focus", icon: Eye },
  ];
  const activeWorkspaceLabel = workspaceOptions.find((workspace) => workspace.id === activeWorkspace)?.label || "Influence Atlas";
  const chromeDensityOptions: Array<{ id: ChromeDensity; label: string }> = [
    { id: "comfortable", label: "Comfort" },
    { id: "compact", label: "Compact" },
    { id: "curation", label: "Curate" },
    { id: "demo", label: "Demo" },
  ];
  const isCompactChrome = chromeDensity === "compact";
  const isReducedChrome = chromeDensity === "focus" || chromeDensity === "demo";
  const isSourceStudio = activeWorkspace === "sources";
  const showSecondaryChrome = chromeDensity !== "demo";
  const showRelationshipToolbar = !isReducedChrome && activeWorkspace === "atlas";
  const showFocusContextBand = !isReducedChrome && Boolean(selectedThinker) && activeWorkspace === "atlas";
  const showConnectionRadar = chromeDensity !== "demo" && Boolean(selectedThinker) && activeWorkspace !== "focus";
  const showRadarCurationActions = chromeDensity === "curation" || activeWorkspace === "sources";
  const showRelationshipInspector = !isReducedChrome && relationshipInspectorOpen && Boolean(selectedThinker);
  const effectiveWorkbenchPanelMode: PanelMode = extensionWorkbenchOpen ? workbenchPanelMode : "closed";
  const workbenchPanelModes: Array<{ id: Exclude<PanelMode, "closed">; label: string }> = [
    { id: "floating", label: "Float" },
    { id: "docked", label: "Dock" },
    { id: "pinned", label: "Pin" },
    { id: "fullscreen", label: "Full" },
  ];
  const workbenchPanelFrameClass =
    workbenchPanelMode === "fullscreen"
      ? "fixed inset-4 rounded-md border border-[#22273b] bg-[#0d1018] overflow-hidden z-50 shadow-2xl shadow-black/60"
      : workbenchPanelMode === "floating"
      ? "fixed right-4 top-[7.5rem] w-[min(920px,calc(100vw-2rem))] max-h-[calc(100vh-9rem)] rounded-md border border-[#22273b] bg-[#0d1018] overflow-hidden z-50 shadow-2xl shadow-black/60"
      : "shrink-0 bg-[#0d1018] border-b border-[#22273b] overflow-hidden z-20";
  const workbenchPanelContentClass =
    workbenchPanelMode === "fullscreen"
      ? "h-full overflow-y-auto scrollbar-thin px-6 py-4 space-y-3"
      : workbenchPanelMode === "floating"
      ? "max-h-[calc(100vh-9rem)] overflow-y-auto scrollbar-thin px-6 py-4 space-y-3"
      : "max-h-[min(420px,40vh)] overflow-y-auto scrollbar-thin px-6 py-4 space-y-3";

  const closeMajorOverlays = (except?: "filters" | "workbench" | "path") => {
    if (except !== "filters") setFilterDrawerOpen(false);
    if (except !== "path") setPathFinderOpen(false);
    if (except !== "workbench" && workbenchPanelMode !== "pinned") setExtensionWorkbenchOpen(false);
  };

  const openFilterDrawer = () => {
    closeMajorOverlays("filters");
    setFilterDrawerOpen(true);
  };

  const toggleFilterDrawer = () => {
    if (filterDrawerOpen) {
      setFilterDrawerOpen(false);
      return;
    }
    openFilterDrawer();
  };

  const openWorkbenchPanel = (tab?: typeof workbenchTab) => {
    setActiveWorkspace("sources");
    setActiveActivity(tab === "manualOverrides" ? "import" : "sources");
    setChromeDensity("curation");
    closeMajorOverlays("workbench");
    if (tab) setWorkbenchTab(tab);
    setExtensionWorkbenchOpen(true);
  };

  const openPathFinder = () => {
    closeMajorOverlays("path");
    setPathFinderOpen(true);
  };

  const togglePathFinder = () => {
    if (pathFinderOpen) {
      setPathFinderOpen(false);
      return;
    }
    openPathFinder();
  };

  const saveCurrentAtlasView = () => {
    const defaultName = [
      activeWorkspaceLabel,
      selectedThinker?.name || searchQuery || selectedFields[0] || selectedEras[0] || "Current view",
    ].join(": ");
    const name = window.prompt("Name this saved view or collection", defaultName)?.trim();
    if (!name) return;

    const id = `view-${Date.now()}`;
    const savedView: SavedAtlasView = {
      id,
      name,
      createdAt: new Date().toISOString(),
      activity: activeActivity,
      viewMode,
      chromeDensity,
      selectedId,
      selectedFields,
      selectedSubfields,
      selectedLensTags,
      selectedEras,
      selectedRegions,
      selectedThreadId,
      minYear,
      maxYear,
      searchQuery,
      sortMode,
      onlyConnectedToFocus,
      onlyCurrentThread,
      onlyReviewGaps,
      collectionIds: processedPeople.map((person) => person.id).slice(0, 500),
    };

    setSavedAtlasViews((prev) => [savedView, ...prev.filter((view) => view.name !== name)].slice(0, 20));
    setActiveSavedViewId(id);
    setCommandMenuOpen(false);
  };

  const applySavedAtlasView = (view: SavedAtlasView) => {
    setActiveWorkspace(getWorkspaceForActivity(view.activity));
    setActiveActivity(view.activity);
    setViewMode(view.viewMode);
    setChromeDensity(view.chromeDensity);
    setSelectedId(view.selectedId && people.some((person) => person.id === view.selectedId) ? view.selectedId : null);
    setSelectedFields(view.selectedFields);
    setSelectedSubfields(view.selectedSubfields);
    setSelectedLensTags(view.selectedLensTags);
    setSelectedEras(view.selectedEras);
    setSelectedRegions(view.selectedRegions);
    setSelectedThreadId(view.selectedThreadId);
    setSelectedThreadStep(0);
    setMinYear(view.minYear);
    setMaxYear(view.maxYear);
    setSearchQuery(view.searchQuery);
    setSortMode(view.sortMode);
    setOnlyConnectedToFocus(view.onlyConnectedToFocus);
    setOnlyCurrentThread(view.onlyCurrentThread);
    setOnlyReviewGaps(view.onlyReviewGaps);
    setActiveSavedViewId(view.id);
    setHighlightPath(null);
    setCommandMenuOpen(false);
    closeMajorOverlays();
  };

  const getWorkspaceForActivity = (activity: WorkspaceActivity): Workspace => {
    if (activity === "import" || activity === "curate" || activity === "sources") return "sources";
    return "atlas";
  };

  const applyWorkspace = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setCommandMenuOpen(false);

    if (workspace === "atlas") {
      setActiveActivity("explore");
      setChromeDensity((current) => current === "focus" ? "comfortable" : current);
      setViewMode("network");
      setSidebarOpen(false);
      closeMajorOverlays();
      return;
    }

    if (workspace === "focus") {
      setActiveActivity("inspect");
      setChromeDensity("focus");
      setViewMode("network");
      setSidebarOpen(false);
      closeMajorOverlays();
      return;
    }

    setActiveActivity(workbenchTab === "manualOverrides" ? "import" : "sources");
    setChromeDensity("curation");
    setViewMode("network");
    setSidebarOpen(false);
    openWorkbenchPanel(workbenchTab === "manualOverrides" ? "manualOverrides" : "candidateRelationships");
  };

  const openUnlinkedImportsView = () => {
    const collectionIds = unlinkedImportedThinkers.map((person) => person.id);
    const view: SavedAtlasView = {
      id: "dynamic-unlinked-imports",
      name: "Unlinked imports",
      createdAt: new Date().toISOString(),
      activity: "import",
      viewMode: "split",
      chromeDensity: "curation",
      selectedId: collectionIds[0] || null,
      selectedFields: [],
      selectedSubfields: [],
      selectedLensTags: [],
      selectedEras: [],
      selectedRegions: [],
      selectedThreadId: null,
      minYear: -650,
      maxYear: 2030,
      searchQuery: "",
      sortMode: "relevance",
      onlyConnectedToFocus: false,
      onlyCurrentThread: false,
      onlyReviewGaps: false,
      collectionIds,
    };

    setSavedAtlasViews((prev) => [view, ...prev.filter((item) => item.id !== view.id)].slice(0, 20));
    applySavedAtlasView(view);
  };

  const openNeedsReviewView = () => {
    const collectionIds = needsReviewThinkers.map((person) => person.id);
    const view: SavedAtlasView = {
      id: "dynamic-needs-review",
      name: "Needs review",
      createdAt: new Date().toISOString(),
      activity: "curate",
      viewMode: "split",
      chromeDensity: "curation",
      selectedId: collectionIds[0] || null,
      selectedFields: [],
      selectedSubfields: [],
      selectedLensTags: [],
      selectedEras: [],
      selectedRegions: [],
      selectedThreadId: null,
      minYear: -650,
      maxYear: 2030,
      searchQuery: "",
      sortMode: "relevance",
      onlyConnectedToFocus: false,
      onlyCurrentThread: false,
      onlyReviewGaps: true,
      collectionIds,
    };

    setSavedAtlasViews((prev) => [view, ...prev.filter((item) => item.id !== view.id)].slice(0, 20));
    applySavedAtlasView(view);
  };

  const openHighConfidenceSuggestionsView = () => {
    const collectionIds = [
      ...(selectedId ? [selectedId] : []),
      ...highConfidenceSuggestionThinkers.map((person) => person.id),
    ];
    const view: SavedAtlasView = {
      id: "dynamic-high-confidence-suggestions",
      name: "High-confidence suggestions",
      createdAt: new Date().toISOString(),
      activity: "curate",
      viewMode: "split",
      chromeDensity: "curation",
      selectedId: selectedId || collectionIds[0] || null,
      selectedFields: [],
      selectedSubfields: [],
      selectedLensTags: [],
      selectedEras: [],
      selectedRegions: [],
      selectedThreadId: null,
      minYear: -650,
      maxYear: 2030,
      searchQuery: "",
      sortMode: "relevance",
      onlyConnectedToFocus: false,
      onlyCurrentThread: false,
      onlyReviewGaps: false,
      collectionIds,
    };

    setSavedAtlasViews((prev) => [view, ...prev.filter((item) => item.id !== view.id)].slice(0, 20));
    applySavedAtlasView(view);
  };

  const openSourceGapsView = () => {
    const collectionIds = sourceGapThinkers.map((person) => person.id);
    const view: SavedAtlasView = {
      id: "dynamic-source-gaps",
      name: "Source gaps",
      createdAt: new Date().toISOString(),
      activity: "sources",
      viewMode: "network",
      chromeDensity: "curation",
      selectedId: collectionIds[0] || selectedId,
      selectedFields: [],
      selectedSubfields: [],
      selectedLensTags: [],
      selectedEras: [],
      selectedRegions: [],
      selectedThreadId: null,
      minYear: -650,
      maxYear: 2030,
      searchQuery: "",
      sortMode: "relevance",
      onlyConnectedToFocus: false,
      onlyCurrentThread: false,
      onlyReviewGaps: false,
      collectionIds,
    };

    setSavedAtlasViews((prev) => [view, ...prev.filter((item) => item.id !== view.id)].slice(0, 20));
    applySavedAtlasView(view);
  };

  const deleteSavedAtlasView = (id: string) => {
    setSavedAtlasViews((prev) => prev.filter((view) => view.id !== id));
    if (activeSavedViewId === id) setActiveSavedViewId(null);
  };

  const applyActivity = (activity: WorkspaceActivity) => {
    setActiveWorkspace(getWorkspaceForActivity(activity));
    setActiveActivity(activity);
    setCommandMenuOpen(false);

    if (activity === "explore") {
      setViewMode("split");
      setSidebarOpen(true);
      closeMajorOverlays();
      return;
    }

    if (activity === "inspect") {
      setViewMode("network");
      setSidebarOpen(false);
      closeMajorOverlays();
      return;
    }

    if (activity === "trace") {
      setViewMode("split");
      setSidebarOpen(false);
      openPathFinder();
      return;
    }

    if (activity === "curate") {
      setViewMode("split");
      setSidebarOpen(true);
      openWorkbenchPanel("candidateRelationships");
      return;
    }

    if (activity === "import") {
      setViewMode("split");
      setSidebarOpen(false);
      openWorkbenchPanel("manualOverrides");
      return;
    }

    setViewMode("network");
    setSidebarOpen(false);
    openWorkbenchPanel("candidateRelationships");
  };

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const handleShortcut = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const usesPrimaryModifier = event.ctrlKey || event.metaKey;

      if (usesPrimaryModifier && key === "k") {
        event.preventDefault();
        setCommandMenuOpen((prev) => !prev);
        return;
      }

      if (event.key === "Escape") {
        setCommandMenuOpen(false);
        setRelationshipInspectorOpen(false);
        closeMajorOverlays();
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const reviewShortcuts: Record<string, () => void> = {
        r: openNeedsReviewView,
        h: openHighConfidenceSuggestionsView,
        u: openUnlinkedImportsView,
        g: openSourceGapsView,
        i: () => applyActivity("import"),
        w: () => applyActivity("curate"),
      };

      const action = reviewShortcuts[key];
      if (!action) return;

      event.preventDefault();
      setCommandMenuOpen(false);
      action();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  const formatYear = (year: number | null) => {
    if (year === null) return "present";
    return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
  };
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const canonicalThreads = CANONICAL_THREADS.map((thread) => ({
    ...thread,
    resolvedPeople: thread.people.map((id) => peopleById.get(id)).filter(Boolean) as Thinker[],
    missingPeople: thread.people.filter((id) => !peopleById.has(id)),
  })).map((thread) => {
    const adjacentPairs = thread.resolvedPeople.slice(0, -1).map((person, index) => [person, thread.resolvedPeople[index + 1]]);
    const pairEdges = adjacentPairs.map(([left, right]) =>
      edges.find((edge) =>
        (edge.source === left.id && edge.target === right.id) ||
        (edge.source === right.id && edge.target === left.id)
      )
    );
    return {
      ...thread,
      stepEdges: pairEdges,
      gapFindings: auditThreadGaps([thread], people, edges),
      edgeGapCount: pairEdges.filter((edge) => !edge).length,
      weakEdgeCount: pairEdges.filter((edge) => edge && ((edge.confidence ?? 1) < 0.5 || (edge.sourceClaims || []).length === 0)).length,
    };
  }).filter((thread) => thread.resolvedPeople.length >= 2);
  const threadJunctionMarkers = getThreadJunctionMarkers(CANONICAL_THREADS);
  const activeCanonicalThread = canonicalThreads.find((thread) => thread.id === selectedThreadId) || null;
  const timelineBookmarks: TimelineBookmarkItem[] = [
    ...(selectedThinker ? [{ id: `focus-${selectedThinker.id}`, label: "Saved: Focus", year: selectedThinker.birth, kind: "saved" as const }] : []),
    ...customTimelineBookmarks,
    ...canonicalThreads.slice(0, 6).map((thread) => ({
      id: thread.id,
      label: `Thread: ${thread.title}`,
      year: thread.resolvedPeople[0]?.birth ?? -650,
      kind: "thread" as const,
    })),
  ];
  const saveTimelineBookmark = (bookmark: Omit<TimelineBookmarkItem, "id" | "kind">) => {
    const nextBookmark: TimelineBookmarkItem = {
      id: `timeline-${Date.now()}`,
      label: bookmark.label,
      year: bookmark.year,
      kind: "custom",
    };
    setCustomTimelineBookmarks((current) => [nextBookmark, ...current.filter((item) => item.year !== bookmark.year || item.label !== bookmark.label)].slice(0, 12));
  };
  const removeTimelineBookmark = (id: string) => {
    setCustomTimelineBookmarks((current) => current.filter((bookmark) => bookmark.id !== id));
  };
  const focusCanonicalThreadRelationshipStep = (thread: (typeof canonicalThreads)[number], step: number) => {
    const path = thread.resolvedPeople.map((person) => person.id);
    const maxRelationshipStep = Math.max(0, thread.resolvedPeople.length - 2);
    const nextStep = Math.max(0, Math.min(maxRelationshipStep, step));
    const pairPath = path.slice(nextStep, nextStep + 2);
    setSelectedThreadId(thread.id);
    setSelectedThreadStep(nextStep);
    setHighlightPath(path);
    selectPerson(pairPath[0], { preserveHighlight: true });
    setViewMode("split");
  };
  const focusCanonicalThread = (thread: (typeof canonicalThreads)[number]) => {
    focusCanonicalThreadRelationshipStep(thread, 0);
  };
  const continueThreadFromPerson = (personId: string) => {
    const preferredThread = activeCanonicalThread?.resolvedPeople.some((person) => person.id === personId)
      ? activeCanonicalThread
      : canonicalThreads.find((thread) => thread.resolvedPeople.some((person) => person.id === personId));
    if (!preferredThread) {
      window.alert("This thinker is not part of a curated thread yet.");
      return;
    }

    const personIndex = preferredThread.resolvedPeople.findIndex((person) => person.id === personId);
    const relationshipStep = Math.max(0, Math.min(personIndex, preferredThread.resolvedPeople.length - 2));
    openWorkbenchPanel("candidateRelationships");
    focusCanonicalThreadRelationshipStep(preferredThread, relationshipStep);
  };
  const edgeTypeOptions = Array.from(new Set(edges.map((edge) => edge.type).filter(Boolean))).sort();
  const edgeMatchesReviewFilters = (edge: InfluenceEdge) => {
    if (edgeTypeFilter !== "all" && edge.type !== edgeTypeFilter) return false;
    if (isSourceStudio && (edge.confidence ?? 1) < edgeConfidenceFilter) return false;

    const hasSources = Boolean(edge.sourceClaims && edge.sourceClaims.length > 0);
    const needsSource = edge.status === "needs_source" || !hasSources;
    if (isSourceStudio && edgeSourceFilter === "sourced" && !hasSources) return false;
    if (isSourceStudio && edgeSourceFilter === "needs_source" && !needsSource) return false;

    return true;
  };
  const threadTaggedEdges = tagRelationshipsWithThreads(edges, CANONICAL_THREADS);
  const filteredEdges = threadTaggedEdges.filter(edgeMatchesReviewFilters);
  const hasActiveEdgeFilters = edgeTypeFilter !== "all" || (isSourceStudio && (edgeSourceFilter !== "all" || edgeConfidenceFilter > 0));
  const selectedLensLabels = selectedThinker
    ? Array.from(new Set(Object.values(inferLensTags(selectedThinker)).flat())).map(getLensOptionLabel).slice(0, 8)
    : [];
  const selectedNearestRelations = selectedId
    ? filteredEdges
        .filter((edge) => edge.source === selectedId || edge.target === selectedId)
        .slice(0, 6)
        .map((edge) => {
          const otherId = edge.source === selectedId ? edge.target : edge.source;
          const other = people.find((person) => person.id === otherId);
          return { edge, other, direction: edge.source === selectedId ? "out" : "in" };
        })
        .filter((item) => item.other)
    : [];
  const selectedRelationshipRows = selectedId
    ? filteredEdges
        .filter((edge) => edge.source === selectedId || edge.target === selectedId)
        .map((edge) => {
          const otherId = edge.source === selectedId ? edge.target : edge.source;
          const other = people.find((person) => person.id === otherId);
          const direction = edge.source === selectedId ? "out" : "in";
          const hasSources = Boolean(edge.sourceClaims && edge.sourceClaims.length > 0);
          const needsSource = edge.status === "needs_source" || !hasSources;
          const lowConfidence = (edge.confidence ?? 1) < 0.5;
          const confidence = edge.confidence ?? 1;
          return { edge, other, direction, hasSources, needsSource, lowConfidence, confidence };
        })
        .filter((item) => item.other)
        .sort((a, b) => Number(b.needsSource || b.lowConfidence) - Number(a.needsSource || a.lowConfidence) || b.edge.strength - a.edge.strength)
    : [];
  const selectedSourceGapCount = selectedRelationshipRows.filter((row) => row.needsSource || row.lowConfidence).length;
  const unlinkedThinkers = people
    .filter((p) => !edges.some((e) => e.source === p.id || e.target === p.id))
    .slice(0, 20);
  const unlinkedImportedThinkers = people.filter((person) => {
    const isImported = person.movement === "Imported" || person.notes?.includes("Imported from");
    const hasEdges = edges.some((edge) => edge.source === person.id || edge.target === person.id);
    return isImported && !hasEdges;
  });
  const needsReviewThinkers = people.filter((person) => {
    const degree = edges.filter((edge) => edge.source === person.id || edge.target === person.id).length;
    return degree <= 1 || !person.subfields || person.subfields.length === 0;
  });
  const sourceGapEdges = edges.filter((edge) =>
    edge.status === "needs_source" || (edge.confidence ?? 1) < 0.5 || !edge.sourceClaims || edge.sourceClaims.length === 0
  );
  const sourceGapThinkers = Array.from(new Set(sourceGapEdges.flatMap((edge) => [edge.source, edge.target])))
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is Thinker => Boolean(person));
  const sparseThinkers = people
    .filter((p) => {
      const degree = edges.filter((e) => e.source === p.id || e.target === p.id).length;
      return degree > 0 && degree <= 1;
    })
    .slice(0, 20);
  const weaklyTaggedThinkers = people
    .filter((p) => !p.subfields || p.subfields.length === 0)
    .slice(0, 20);
  const duplicateCandidates = people
    .flatMap((person, index) =>
      people.slice(index + 1).map((other) => {
        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
        const nameA = normalize(person.name);
        const nameB = normalize(other.name);
        const sameName = nameA === nameB;
        const containedName = nameA.length > 6 && nameB.length > 6 && (nameA.includes(nameB) || nameB.includes(nameA));
        const closeBirth = Math.abs(person.birth - other.birth) <= 3;
        const sharedField = person.fields.some((field) => other.fields.includes(field));
        const score = (sameName ? 8 : 0) + (containedName ? 5 : 0) + (closeBirth ? 3 : 0) + (sharedField ? 2 : 0);
        return { a: person, b: other, score };
      })
    )
    .filter((candidate) => candidate.score >= 7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  const suggestedLinks = selectedThinker
    ? people
        .filter((p) => p.id !== selectedThinker.id)
        .filter((p) =>
          !rejectedLinkSuggestionKeys.has(getLinkSuggestionKey(selectedThinker.id, p.id)) &&
          !rejectedLinkSuggestionKeys.has(getLinkSuggestionKey(p.id, selectedThinker.id))
        )
        .filter((p) => !edges.some((edge) =>
          (edge.source === selectedThinker.id && edge.target === p.id) ||
          (edge.target === selectedThinker.id && edge.source === p.id)
        ))
        .map((person) => {
          const selectedLens = Object.values(inferLensTags(selectedThinker)).flat();
          const personLens = Object.values(inferLensTags(person)).flat();
          const sharedFields = person.fields.filter((field) => selectedThinker.fields.includes(field));
          const sharedTopics = (person.subfields || []).filter((topic) => selectedThinker.subfields?.includes(topic));
          const sharedLensTags = personLens.filter((tag) => selectedLens.includes(tag));
          const timeGap = Math.min(
            Math.abs(person.birth - (selectedThinker.death ?? selectedThinker.birth)),
            Math.abs(selectedThinker.birth - (person.death ?? person.birth))
          );
          const eraBonus = person.era && person.era === selectedThinker.era ? 2 : 0;
          const score = sharedFields.length * 4 + sharedTopics.length * 3 + sharedLensTags.length * 2 + eraBonus - Math.min(timeGap / 150, 4);
          return { person, score, sharedFields, sharedTopics, sharedLensTags };
        })
        .filter((candidate) => candidate.score > 1)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
    : [];
  const getSuggestedLinkReason = (candidate: (typeof suggestedLinks)[number]) => {
    const reasons = [
      ...candidate.sharedFields.slice(0, 2),
      ...candidate.sharedTopics.slice(0, 2),
      ...candidate.sharedLensTags.slice(0, 2).map(getLensOptionLabel),
    ];
    return reasons.length > 0 ? reasons.join(", ") : "nearby context";
  };
  const highConfidenceSuggestions = suggestedLinks.filter((candidate) => candidate.score >= 4);
  const highConfidenceSuggestionThinkers = highConfidenceSuggestions.map((candidate) => candidate.person);
  const focusLinkQueue = suggestedLinks.slice(0, 4);
  const connectedIndexPeople = selectedNearestRelations
    .map((item) => item.other)
    .filter(Boolean) as Thinker[];
  const likelyIndexPeople = suggestedLinks.map((candidate) => candidate.person);
  const currentMatchPeople = processedPeople
    .filter((person) => person.id !== selectedId)
    .filter((person) => !connectedIndexPeople.some((connected) => connected.id === person.id))
    .filter((person) => !likelyIndexPeople.some((likely) => likely.id === person.id))
    .slice(0, 30);
  const recentlyAddedPeople = [...people]
    .reverse()
    .filter((person) => processedPeople.some((match) => match.id === person.id))
    .filter((person) => person.id !== selectedId)
    .slice(0, 12);
  const recentlyReviewedPeople = importAuditLog
    .map((entry) =>
      people.find((person) =>
        person.id === entry.candidateId ||
        person.name.toLowerCase() === entry.candidateName.toLowerCase()
      )
    )
    .filter((person): person is Thinker => Boolean(person))
    .filter((person, index, list) => list.findIndex((item) => item.id === person.id) === index)
    .filter((person) => processedPeople.some((match) => match.id === person.id))
    .slice(0, 12);
  const highBridgeIndexPeople = processedPeople
    .filter((person) => (person.bridge_score ?? 0) >= 4)
    .filter((person) => person.id !== selectedId)
    .sort((a, b) => (b.bridge_score ?? 0) - (a.bridge_score ?? 0) || a.birth - b.birth)
    .slice(0, 12);

  const groupPeopleBy = (list: Thinker[], getKey: (person: Thinker) => string) =>
    Object.entries(
      list.reduce<Record<string, Thinker[]>>((acc, person) => {
        const key = getKey(person) || "Unclassified";
        if (!acc[key]) acc[key] = [];
        acc[key].push(person);
        return acc;
      }, {})
    )
      .map(([title, list]) => ({ title, list }))
      .sort((a, b) => a.title.localeCompare(b.title));
  const getInstitutionForPerson = (person: Thinker) =>
    INITIAL_INSTITUTIONS_DATA.find((institution) => institution.figures.includes(person.id))?.name || "Unaffiliated";
  const getReviewStatusForPerson = (person: Thinker) => {
    const personEdges = edges.filter((edge) => edge.source === person.id || edge.target === person.id);
    const hasSourceGap = personEdges.some((edge) =>
      edge.status === "needs_source" || (edge.confidence ?? 1) < 0.5 || !edge.sourceClaims || edge.sourceClaims.length === 0
    );
    const isImported = person.movement === "Imported" || person.notes?.includes("Imported from");

    if (isImported && personEdges.length === 0) return "Unlinked import";
    if (hasSourceGap) return "Needs source review";
    if (!person.subfields || person.subfields.length === 0) return "Needs tags";
    if (personEdges.length === 0) return "Orphan";
    if (personEdges.length <= 1) return "Sparse links";
    if (isImported) return "Imported linked";
    return "Connected";
  };

  const contextIndexGroups = [
    selectedThinker ? { title: "Selected", list: [selectedThinker] } : null,
    { title: "Connected", list: connectedIndexPeople },
    { title: "Likely Links", list: likelyIndexPeople },
    { title: "Recently Added", list: recentlyAddedPeople },
    { title: "Recently Reviewed", list: recentlyReviewedPeople },
    { title: "Orphans", list: unlinkedThinkers },
    { title: "High Bridge Score", list: highBridgeIndexPeople },
    { title: "Needs Source", list: sourceGapThinkers.slice(0, 12) },
    { title: "Current Matches", list: currentMatchPeople },
  ].filter(Boolean) as { title: string; list: Thinker[] }[];

  const indexGroups =
    indexMode === "context"
      ? contextIndexGroups
      : indexMode === "cluster"
      ? groupPeopleBy(processedPeople, (person) => getDomainForField(person.fields?.[0] || ""))
      : indexMode === "era"
      ? groupPeopleBy(processedPeople, (person) => person.era || "Unclassified")
      : indexMode === "movement"
      ? groupPeopleBy(processedPeople, (person) => person.movement || "Unclassified movement")
      : indexMode === "institution"
      ? groupPeopleBy(processedPeople, getInstitutionForPerson)
      : indexMode === "review"
      ? groupPeopleBy(processedPeople, getReviewStatusForPerson)
      : groupPeopleBy(processedPeople, (person) => person.fields?.[0] || "Unclassified");

  const getIndexContext = (person: Thinker, groupTitle: string) => {
    if (groupTitle === "Selected") {
      return `${formatYear(person.birth)} · current focus`;
    }

    if (groupTitle === "Recently Added") {
      return `${formatYear(person.birth)} · ${person.movement || person.fields?.[0] || "Unclassified"}`;
    }

    if (groupTitle === "Recently Reviewed") {
      const entry = importAuditLog.find((item) => item.candidateId === person.id || item.candidateName === person.name);
      return `${entry?.status || "reviewed"} · ${entry?.reason || person.fields?.[0] || "review history"}`;
    }

    if (groupTitle === "Orphans") {
      return `${formatYear(person.birth)} · no mapped relationships`;
    }

    if (groupTitle === "High Bridge Score") {
      return `${formatYear(person.birth)} · bridge ${person.bridge_score ?? 0}/5 · ${person.fields?.[0] || "Unclassified"}`;
    }

    if (groupTitle === "Needs Source") {
      const gapCount = edges.filter((edge) =>
        (edge.source === person.id || edge.target === person.id) &&
        (edge.status === "needs_source" || (edge.confidence ?? 1) < 0.5 || !edge.sourceClaims || edge.sourceClaims.length === 0)
      ).length;
      return `${gapCount} source gap${gapCount === 1 ? "" : "s"} · ${person.fields?.[0] || "Unclassified"}`;
    }

    if (groupTitle === "Connected") {
      const relation = selectedId
        ? edges.find((edge) =>
            (edge.source === selectedId && edge.target === person.id) ||
            (edge.target === selectedId && edge.source === person.id)
          )
        : null;
      if (relation && selectedId) {
        const direction = relation.source === selectedId ? "influences" : "influenced by";
        return `${direction} · ${relation.type}`;
      }
      return `${formatYear(person.birth)} · mapped relation`;
    }

    if (groupTitle === "Likely Links") {
      const candidate = suggestedLinks.find((item) => item.person.id === person.id);
      return candidate ? getSuggestedLinkReason(candidate) : `${formatYear(person.birth)} · possible link`;
    }

    if (indexMode === "era") {
      return `${formatYear(person.birth)} · ${person.fields?.[0] || "Unclassified"}`;
    }

    if (indexMode === "cluster") {
      const primaryField = person.fields?.[0] || "Unclassified";
      const topic = person.subfields?.[0] || person.era || person.region || "Unclassified";
      return `${primaryField} · ${topic}`;
    }

    if (indexMode === "field") {
      return `${formatYear(person.birth)} · ${person.era || person.region || "Unclassified"}`;
    }

    if (indexMode === "movement") {
      return `${formatYear(person.birth)} · ${person.fields?.[0] || "Unclassified"} · ${person.era || person.region || "Unclassified"}`;
    }

    if (indexMode === "institution") {
      return `${formatYear(person.birth)} · ${person.fields?.[0] || "Unclassified"} · ${person.movement || person.era || "Unclassified"}`;
    }

    if (indexMode === "review") {
      const degree = edges.filter((edge) => edge.source === person.id || edge.target === person.id).length;
      return `${formatYear(person.birth)} · ${degree} edge${degree === 1 ? "" : "s"} · ${person.fields?.[0] || "Unclassified"}`;
    }

    return `${formatYear(person.birth)} · ${person.fields?.[0] || "Unclassified"}`;
  };

  const toggleIndexGroup = (group: string) => {
    setExpandedIndexGroups((prev) =>
      prev.includes(group) ? prev.filter((item) => item !== group) : [...prev, group]
    );
  };

  const importQueueAcceptableItems = importReviewQueue.filter(
    (item) => item.candidate.birth !== null && item.confidence >= importConfidenceThreshold && !getDuplicateIdForCandidate(item.candidate)
  );
  const importQueueLinkableItems = importQueueAcceptableItems.filter(
    (item) => getCandidateLinkSuggestions(item.candidate).length > 0
  );
  const importQueueDuplicateCount = importReviewQueue.filter((item) => getDuplicateIdForCandidate(item.candidate)).length;
  const importQueueLowConfidenceCount = importReviewQueue.filter((item) => item.confidence < importConfidenceThreshold).length;
  const graphHealthReport = buildGraphHealthReport(people, edges, [], CANONICAL_THREADS);
  const graphRepairTriggers = getDryRunRepairJobTriggers(graphHealthReport.findings);
  const graphRepairPreview = createGraphRepairPreview("repair:source-studio-dry-run", planWeakUnsupportedEdgeDemotions(edges));
  const applyGraphRepairPreview = () => {
    if (graphRepairPreview.diffs.length === 0) {
      window.alert("No repair diffs are available to apply.");
      return;
    }

    captureReviewUndoSnapshot(`Applied repair preview: ${graphRepairPreview.diffs.length} diff${graphRepairPreview.diffs.length === 1 ? "" : "s"}`);
    const nextEdges = [...edges];
    graphRepairPreview.diffs.forEach((diff) => {
      const existingIndex = nextEdges.findIndex((edge) =>
        (diff.edge.id && edge.id === diff.edge.id) ||
        (edge.source === diff.edge.source && edge.target === diff.edge.target && edge.type === diff.edge.type)
      );
      if (diff.action === "add-edge" && existingIndex === -1) {
        nextEdges.push(diff.edge);
        return;
      }
      if (diff.action === "update-edge" && existingIndex >= 0) {
        nextEdges[existingIndex] = { ...nextEdges[existingIndex], ...diff.edge };
      }
    });
    setEdges(nextEdges);
    persistAtlasState(people, nextEdges);
  };
  const canRevertRepairPreview = reviewUndoSnapshot?.label.startsWith("Applied repair preview");
  const evidenceCoveragePercent = Math.round(graphHealthReport.metrics.sourcedEdgePercentage * 100);
  const conflictFindingCount = graphHealthReport.findings.filter((finding) =>
    finding.code === "duplicate-entity-risk" ||
    finding.code === "dangling-reference" ||
    finding.code === "impossible-dates"
  ).length;
  const automationConflictCount = conflictFindingCount + duplicateCandidates.length + importQueueDuplicateCount;
  const automationHoldCount = sourceGapEdges.length + importQueueLowConfidenceCount + graphHealthReport.summary.warning;
  const automationAcceptedCount = importQueueAcceptableItems.length + highConfidenceSuggestions.length;
  const topAutomationFindings = graphHealthReport.findings
    .filter((finding) => finding.severity !== "info")
    .slice(0, 4);
  const automatedClaimDecisionFeed: AutomatedClaimDecision[] = [
    ...importReviewQueue.slice(0, 4).map((item): AutomatedClaimDecision => {
      const duplicateId = getDuplicateIdForCandidate(item.candidate);
      if (duplicateId) {
        return {
          id: `import-conflict-${item.id}`,
          label: item.candidate.name,
          status: "conflicting",
          reason: `Matched existing entity ${(peopleById.get(duplicateId) as Thinker | undefined)?.name || duplicateId}.`,
        };
      }
      if (item.candidate.birth === null) {
        return {
          id: `import-rejected-${item.id}`,
          label: item.candidate.name,
          status: "rejected",
          reason: "Rejected from automation because the candidate has no usable birth year.",
        };
      }
      if (item.confidence >= importConfidenceThreshold) {
        return {
          id: `import-accepted-${item.id}`,
          label: item.candidate.name,
          status: "accepted",
          reason: `Confidence ${item.confidence}% meets the ${importConfidenceThreshold}% threshold.`,
        };
      }
      return {
        id: `import-held-${item.id}`,
        label: item.candidate.name,
        status: "held",
        reason: `Confidence ${item.confidence}% is below the ${importConfidenceThreshold}% threshold.`,
      };
    }),
    ...suggestedLinks.slice(0, 4).map((candidate): AutomatedClaimDecision => ({
      id: `link-${candidate.person.id}`,
      label: selectedThinker ? `${selectedThinker.name} / ${candidate.person.name}` : candidate.person.name,
      status: candidate.score >= 4 ? "accepted" : "held",
      reason: candidate.score >= 4
        ? `Relationship candidate scored ${candidate.score.toFixed(1)} from shared field, topic, lens, era, and chronology evidence.`
        : `Held because the relationship score ${candidate.score.toFixed(1)} is below the high-confidence cutoff.`,
    })),
    ...importAuditLog.slice(0, 4).map((entry): AutomatedClaimDecision => ({
      id: `audit-${entry.id}`,
      label: entry.candidateName,
      status: entry.status === "accepted"
        ? "accepted"
        : entry.status === "duplicate"
        ? "conflicting"
        : entry.status === "skipped"
        ? "rejected"
        : "held",
      reason: entry.reason,
    })),
  ].slice(0, 8);
  const getAutomatedClaimDecisionClass = (status: AutomatedClaimDecisionStatus) =>
    status === "accepted"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status === "conflicting"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
      : status === "rejected"
      ? "border-slate-600 bg-slate-700/20 text-slate-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";
  const latestImportAuditAt = importAuditLog
    .map((entry) => entry.reviewedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const sourceAdapterRunHistory: SourceAdapterRunRecord[] = EXTERNAL_SOURCES.map((source) => {
    const queueCount = source.id === "wikidata" ? importReviewQueue.length : 0;
    const auditCount = source.id === "wikidata" ? importAuditLog.length : 0;
    const localActivityCount = queueCount + auditCount;
    const requiresKey = source.status === "requires-api-key";
    return {
      id: `adapter-run:${source.id}`,
      adapterId: source.id,
      adapterName: source.name,
      runAt: localActivityCount > 0 ? latestImportAuditAt : null,
      status: requiresKey ? "failed" : localActivityCount > 0 ? "completed" : "held",
      queryCount: localActivityCount,
      observationCount: queueCount,
      claimCount: auditCount,
      errorMessage: requiresKey ? "Adapter requires an API key before automated runs can complete." : undefined,
    };
  });
  const sourceAdapterRunSummary = summarizeSourceAdapterRuns(sourceAdapterRunHistory);
  const getSourceAdapterRunClass = (status: SourceAdapterRunRecord["status"]) =>
    status === "completed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status === "failed"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
      : status === "running"
      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0b10] text-[#dde3f0] font-sans antialiased selection:bg-[#7b9cf5]/30">
      
      {/* ── CENTRALized HEADER BAR ── */}
      <header className={`flex ${isCompactChrome ? "h-12" : "h-14"} shrink-0 items-center justify-between px-6 bg-[#0f111a] border-b border-[#22273b] z-40`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-serif text-xl font-semibold italic">◈</span>
            <div className="hidden sm:flex font-serif text-base font-bold tracking-tight text-white items-center gap-1.5">
              Intellectual <span className="italic text-amber-400 font-normal">History</span>
              <span className="text-[10px] uppercase font-mono tracking-wider border border-slate-800 bg-[#161926] text-[#8c9bbb] rounded px-1.5 py-0.5 ml-2.5">Atlas</span>
            </div>
          </div>
          
          {/* Quick Global Counters */}
          <div className="hidden xl:flex items-center gap-2 text-[#465175] text-[10px] font-mono select-none">
            <span className="border-r border-[#22273b] pr-2.5">Thinkers: <b className="text-slate-300 font-bold">{people.length}</b></span>
            <span className="border-r border-[#22273b] pr-2.5">Lines: <b className="text-violet-400 font-bold">{edges.length}</b></span>
            <span>Matches: <b className="text-amber-500 font-bold">{processedPeople.length}</b></span>
            {PUBLIC_DEMO_MODE && (
              <span className="ml-2 rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">Demo</span>
            )}
            {!PUBLIC_DEMO_MODE && (
              <span className="ml-2 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-amber-200" title="Edits are stored privately in this browser's localStorage.">
                Local data
              </span>
            )}
          </div>
        </div>

        {/* Workspace switcher keeps exploration, source work, and focus mode separate. */}
        <div className="hidden md:flex min-w-0 items-center overflow-x-auto scrollbar-thin bg-[#07080d] p-0.5 border border-[#22273b] rounded-lg">
          {workspaceOptions.map((workspace) => {
            const Icon = workspace.icon;
            const isActive = activeWorkspace === workspace.id;

            return (
              <button
                key={workspace.id}
                data-testid={`workspace-${workspace.id}`}
                onClick={() => applyWorkspace(workspace.id)}
                className={`px-2.5 lg:px-3.5 py-1 text-[10px] lg:text-[11px] font-mono tracking-wide rounded-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? "bg-[#1f2438] text-[#9bdaff] font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
                title={`${workspace.label} workspace`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{workspace.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Contextual actions stay tucked away until needed. */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setCommandMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-mono transition-all cursor-pointer ${
              commandMenuOpen
                ? "bg-[#1f2438] border-[#7b9cf5] text-[#9bdaff]"
                : "border-[#22273b] bg-[#141724]/40 text-slate-300 hover:text-white"
            }`}
            title="Open activity actions (Ctrl+K)"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Actions</span>
          </button>

          <AnimatePresence>
            {commandMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className="fixed inset-x-3 top-16 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-md border border-[#22273b] bg-[#0d1018] p-1.5 shadow-2xl shadow-black/50 md:absolute md:inset-auto md:right-0 md:top-10 md:w-72 md:max-h-[calc(100vh-5rem)]"
              >
                <button
                  onClick={() => {
                    setCommandMenuOpen(false);
                    setAddModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#7b9cf5]" />
                  <span className="flex-1">Add Thinker</span>
                </button>
                <button
                  onClick={() => {
                    setCommandMenuOpen(false);
                    applyWorkspace("sources");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="flex-1">Open Source Studio</span>
                  <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[8.5px] text-slate-500">Alt W</span>
                </button>
                <button
                  onClick={() => {
                    setCommandMenuOpen(false);
                    applyActivity("trace");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-amber-300" />
                  <span className="flex-1">Trace Path</span>
                </button>
                <button
                  onClick={() => {
                    setCommandMenuOpen(false);
                    setWorkbenchTab("manualOverrides");
                    applyActivity("import");
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="flex-1">Import Review</span>
                  <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[8.5px] text-slate-500">Alt I</span>
                </button>
                <button
                  onClick={openUnlinkedImportsView}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="flex-1">Unlinked Imports</span>
                  <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[8.5px] text-slate-500">Alt U</span>
                  <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-[8.5px] text-cyan-200">{unlinkedImportedThinkers.length}</span>
                </button>
                <button
                  onClick={openNeedsReviewView}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-300" />
                  <span className="flex-1">Needs Review</span>
                  <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[8.5px] text-slate-500">Alt R</span>
                  <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[8.5px] text-amber-200">{needsReviewThinkers.length}</span>
                </button>
                <button
                  onClick={openHighConfidenceSuggestionsView}
                  disabled={!selectedId}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="flex-1">High-Confidence Suggestions</span>
                  <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[8.5px] text-slate-500">Alt H</span>
                  <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[8.5px] text-emerald-200">{highConfidenceSuggestions.length}</span>
                </button>
                <button
                  onClick={openSourceGapsView}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5 text-violet-300" />
                  <span className="flex-1">Source Gaps</span>
                  <span className="rounded bg-slate-700/40 px-1.5 py-0.5 text-[8.5px] text-slate-500">Alt G</span>
                  <span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[8.5px] text-violet-200">{sourceGapEdges.length}</span>
                </button>
                <div className="mx-2 my-1 rounded border border-[#22273b] bg-[#090b10] px-2 py-1.5 font-mono text-[8.5px] text-slate-500">
                  <div className="mb-1 uppercase tracking-wider text-slate-600">Shortcuts</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span>Ctrl K</span>
                    <span>Actions</span>
                    <span>Esc</span>
                    <span>Close panels</span>
                  </div>
                </div>
                <div className="my-1 h-px bg-[#22273b]" />
                <button
                  onClick={saveCurrentAtlasView}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-200 hover:bg-[#171b29] cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5 text-amber-300" />
                  Save View / Collection
                </button>
                {savedAtlasViews.length > 0 && (
                  <div className="px-2 py-1">
                    <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[8.5px] uppercase tracking-wider text-slate-600">
                      <span>Saved Views</span>
                      <span>{savedAtlasViews.length}</span>
                    </div>
                    <div className="max-h-36 space-y-1 overflow-y-auto scrollbar-thin pr-1">
                      {savedAtlasViews.slice(0, 8).map((view) => (
                        <div
                          key={view.id}
                          className={`flex items-center gap-1 rounded border px-1.5 py-1 ${
                            activeSavedViewId === view.id
                              ? "border-amber-400/50 bg-amber-400/10"
                              : "border-[#22273b] bg-[#090b10]"
                          }`}
                        >
                          <button
                            onClick={() => applySavedAtlasView(view)}
                            className="min-w-0 flex-1 text-left cursor-pointer"
                            title={`Apply ${view.name}`}
                          >
                            <div className="truncate text-[10px] font-mono text-slate-200">{view.name}</div>
                            <div className="truncate text-[8.5px] font-mono text-slate-600">
                              {view.collectionIds.length} thinkers · {view.activity} · {view.viewMode}
                            </div>
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteSavedAtlasView(view.id);
                            }}
                            className="rounded p-1 text-slate-600 hover:bg-[#171b29] hover:text-[#fa5278] cursor-pointer"
                            title={`Delete ${view.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="my-1 h-px bg-[#22273b]" />
                <div className="px-2 py-1">
                  <div className="mb-1 font-mono text-[8.5px] uppercase tracking-wider text-slate-600">Density</div>
                  <div className="grid grid-cols-5 gap-1">
                    {chromeDensityOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setChromeDensity(option.id);
                          if (option.id === "curation") applyActivity("curate");
                          if (option.id === "demo") {
                            setFilterDrawerOpen(false);
                            setExtensionWorkbenchOpen(false);
                            setPathFinderOpen(false);
                          }
                        }}
                        className={`rounded border px-1 py-1 text-[8.5px] font-mono transition-colors cursor-pointer ${
                          chromeDensity === option.id
                            ? "border-[#7b9cf5] bg-[#7b9cf5]/15 text-[#9bdaff]"
                            : "border-[#22273b] bg-[#090b10] text-slate-500 hover:text-slate-200"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="my-1 h-px bg-[#22273b]" />
                <button
                  onClick={() => {
                    setCommandMenuOpen(false);
                    handleResetDatabase();
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-[11px] font-mono text-slate-400 hover:bg-[#171b29] hover:text-slate-100 cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Reset Atlas
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── MINIMAL CONTROLS & SEARCH BAR sub-header ── */}
      {showSecondaryChrome && (
      <div className={`flex shrink-0 ${isCompactChrome ? "h-10" : "h-12"} items-center justify-between px-6 bg-[#131622] border-b border-[#22273b] z-30`}>
        
        {/* Toggle Sidebar and Live Search group */}
        <div className="flex items-center gap-4 w-full max-w-md">
          {/* Sidebar trigger */}
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-1 px-1.5 border border-[#22273b] rounded bg-[#090b10]/80 text-slate-400 hover:text-white cursor-pointer transition-colors"
            title={sidebarOpen ? "Collapse scholar index" : "Expand scholar index"}
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Live Search Input with beautiful spacing */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#505c80] pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, works, discoveries..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) setSortMode("relevance");
                setHighlightPath(null);
              }}
              className="pl-9 pr-8 py-1 bg-[#090b10] border border-[#22273b] rounded-md text-xs text-slate-200 w-full focus:border-[#7b9cf5] focus:outline-none transition-all placeholder:text-slate-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 px-1 text-[11px] text-[#5a6480] hover:text-[#fa5278] top-1/2 -translate-y-1/2"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {selectedThinker && (
          <div className="hidden lg:flex items-center gap-2 mx-4 min-w-0 text-[10px] font-mono text-slate-500">
            <span className="uppercase tracking-wider text-[#5a6480]">Focus</span>
            <button
              onClick={openPathFinder}
              className="max-w-[220px] truncate px-2 py-1 rounded border border-[#252a3d] bg-[#0d0f17] text-slate-200 hover:border-[#7b9cf5] transition-colors cursor-pointer"
              title="Open path finder from the current thinker"
            >
              {selectedThinker.name}
            </button>
            <span className="text-purple-300">{selectedIncomingCount} in</span>
            <span className="text-[#7b9cf5]">{selectedOutgoingCount} out</span>
          </div>
        )}

        {/* Filter and Curate action activator */}
        <div className="flex items-center gap-2">
          {activeSavedView && (
            <button
              onClick={() => setActiveSavedViewId(null)}
              className="hidden lg:flex max-w-[180px] items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[9px] font-mono text-amber-200 hover:border-amber-300 cursor-pointer"
              title="Clear saved collection constraint"
            >
              <Bookmark className="h-3 w-3 shrink-0" />
              <span className="truncate">{activeSavedView.name}</span>
              <X className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          )}

          {/* Quick Active filter indications */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={resetFilters}
                className="text-amber-500 hover:text-amber-400 text-[10px] font-mono uppercase tracking-wider cursor-pointer border border-[#c27829]/40 bg-[#c27829]/10 px-2 py-0.5 rounded transition-all flex items-center gap-1"
              >
                <span>Clear Filters</span>
                <span className="w-4 h-4 flex items-center justify-center bg-amber-500/20 text-amber-300 rounded-full text-[8.5px] font-bold font-sans">
                  {activeFiltersCount}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          <div className="hidden lg:flex items-center gap-1">
            {([
              ["ancient", "Ancient"],
              ["science", "Science"],
              ["review", "Review"],
              ["focus", "Focus"],
            ] as const).map(([preset, label]) => (
              <button
                key={preset}
                onClick={() => applyFilterPreset(preset)}
                disabled={preset === "focus" && !selectedId}
                className="rounded border border-[#252a3d] bg-[#090b10] px-2 py-1 text-[9px] font-mono text-slate-500 hover:border-[#7b9cf5] hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                title={`${label} filter preset`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOnlyConnectedToFocus((prev) => !prev)}
            disabled={!selectedId}
            className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 ${
              onlyConnectedToFocus ? "border-emerald-400 bg-emerald-400/15 text-emerald-200" : "border-[#252a3d] bg-[#090b10] text-slate-500 hover:text-slate-200"
            }`}
            title="Only show connected to current focus"
          >
            Connected
          </button>

          <button
            onClick={() => setOnlyCurrentThread((prev) => !prev)}
            disabled={!activeCanonicalThread}
            className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 ${
              onlyCurrentThread ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-[#252a3d] bg-[#090b10] text-slate-500 hover:text-slate-200"
            }`}
            title="Only show current canonical thread"
          >
            Thread
          </button>

          <button
            onClick={() => setOnlyReviewGaps((prev) => !prev)}
            className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
              onlyReviewGaps ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-[#252a3d] bg-[#090b10] text-slate-500 hover:text-slate-200"
            }`}
            title="Only show review gaps"
          >
            Gaps
          </button>

          {selectedThinker?.fields?.[0] && (
            <button
              onClick={() => handleToggleField(selectedThinker.fields[0])}
              className={`hidden xl:inline-flex rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
                selectedFields.includes(selectedThinker.fields[0])
                  ? "border-[#7b9cf5] bg-[#7b9cf5]/15 text-[#9bdaff]"
                  : "border-[#252a3d] bg-[#090b10] text-slate-500 hover:text-slate-200"
              }`}
              title="Toggle selected thinker field"
            >
              {selectedThinker.fields[0]}
            </button>
          )}

          {selectedThinker?.era && (
            <button
              onClick={() => setSelectedEras((prev) => prev.includes(selectedThinker.era!) ? prev.filter((era) => era !== selectedThinker.era) : [...prev, selectedThinker.era!])}
              className={`hidden xl:inline-flex rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
                selectedEras.includes(selectedThinker.era)
                  ? "border-purple-400 bg-purple-400/15 text-purple-200"
                  : "border-[#252a3d] bg-[#090b10] text-slate-500 hover:text-slate-200"
              }`}
              title="Toggle selected thinker era"
            >
              {selectedThinker.era}
            </button>
          )}

          <button
            data-testid="filter-drawer-toggle"
            onClick={toggleFilterDrawer}
            className={`px-4 py-1.5 rounded-md text-[11px] font-semibold font-mono border transition-all cursor-pointer flex items-center gap-2 ${
              filterDrawerOpen
                ? "bg-[#7b9cf5]/15 border-[#7b9cf5] text-[#9bdaff] shadow-[0_0_12px_rgba(123,156,245,0.15)]"
                : "border-[#22273b] text-slate-300 hover:text-white bg-[#0e1017]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {filterDrawerOpen ? <X className="w-3 h-3 ml-1 opacity-60" /> : <ChevronRight className="w-3 h-3 ml-1 opacity-60" />}
          </button>
        </div>
      </div>
      )}

      {/* Activity relationship toolbar */}
      {showRelationshipToolbar && (
      <div className="shrink-0 min-h-11 px-6 py-1.5 bg-[#0d1018] border-b border-[#22273b] z-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
            <span className="hidden md:inline font-mono text-[9px] uppercase tracking-wider text-[#5a6480] shrink-0">{activeWorkspaceLabel}</span>
          <div className="hidden lg:flex items-center rounded-md border border-[#22273b] bg-[#080a0f] p-0.5">
            {([
              ["split", List, "Split"],
              ["timeline", Clock, "Timeline"],
              ["network", Globe, "Map"],
            ] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if (activeActivity === "inspect" && mode !== "network") setActiveActivity("explore");
                }}
                className={`rounded px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                  viewMode === mode
                    ? "bg-[#1f2438] text-[#9bdaff]"
                    : "text-slate-500 hover:text-slate-200"
                }`}
                title={`${label} lens`}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={showNeighborhood}
            disabled={!selectedId || (selectedIncomingCount + selectedOutgoingCount) === 0}
            className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-[#252a3d] bg-[#141724] text-emerald-200 hover:border-emerald-400 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Neighborhood
          </button>
          <button
            onClick={() => highlightImmediateRelations("back")}
            disabled={!selectedId || selectedIncomingCount === 0}
            className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-[#252a3d] bg-[#141724] text-purple-200 hover:border-purple-400 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Lineage In
          </button>
          <button
            onClick={() => highlightImmediateRelations("forward")}
            disabled={!selectedId || selectedOutgoingCount === 0}
            className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-[#252a3d] bg-[#141724] text-[#9bdaff] hover:border-[#7b9cf5] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Lineage Out
          </button>
          <button
            onClick={() => {
              setActiveActivity("trace");
              openPathFinder();
            }}
            disabled={!selectedId}
            className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-[#252a3d] bg-[#141724] text-amber-300 hover:border-amber-400 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Find Bridge
          </button>
          <button
            onClick={() => selectedId && handleFindContemporaries(selectedId)}
            disabled={!selectedId}
            className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-[#252a3d] bg-[#141724] text-slate-300 hover:border-slate-500 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Contemporaries
          </button>
          <button
            onClick={() => {
              setCoordinatedLenses((prev) => !prev);
              setViewMode("split");
            }}
            className={`px-2.5 py-1 text-[10px] font-mono rounded-md border transition-colors cursor-pointer ${
              coordinatedLenses
                ? "border-[#7b9cf5] bg-[#7b9cf5]/15 text-[#9bdaff]"
                : "border-[#252a3d] bg-[#141724] text-slate-400 hover:border-slate-500"
            }`}
            title="Coordinate graph and timeline lenses"
          >
            Sync Lenses
          </button>
          <button
            onClick={() => setRelationshipInspectorOpen((prev) => !prev)}
            disabled={!selectedId}
            className={`px-2.5 py-1 text-[10px] font-mono rounded-md border transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
              relationshipInspectorOpen
                ? "border-amber-400 bg-amber-400/15 text-amber-200"
                : "border-[#252a3d] bg-[#141724] text-slate-400 hover:border-slate-500"
            }`}
            title="Toggle compact relationship inspector"
          >
            Relations
          </button>
        </div>

        <div className="hidden xl:flex items-center gap-2 min-w-0 text-[10px] font-mono text-slate-500">
          <span className="uppercase tracking-wider text-[#5a6480] shrink-0">Relationship tools</span>
          <span className="text-slate-600">Use the current focus to trace, bridge, or compare context.</span>
        </div>
      </div>
      )}

      {(showFocusContextBand || showConnectionRadar) && selectedThinker && (
        <div className="shrink-0 px-6 py-3 bg-[#10131d] border-b border-[#22273b] z-20">
          {showFocusContextBand && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
            <div className="xl:col-span-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: FIELD_COLOR[selectedThinker.fields?.[0] || "Philosophy"] || "#94a3b8" }}
                />
                <div className="min-w-0">
                  <div className="truncate font-serif text-sm font-bold text-slate-100">{selectedThinker.name}</div>
                  <div className="font-mono text-[9px] text-slate-600">
                    {formatYear(selectedThinker.birth)} to {formatYear(selectedThinker.death)} · {selectedThinker.fields?.join(", ") || "Unclassified"}
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 flex flex-wrap gap-1.5">
              {selectedLensLabels.length > 0 ? (
                selectedLensLabels.map((label) => (
                  <span key={label} className="rounded border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 font-mono text-[9px] text-cyan-100">
                    {label}
                  </span>
                ))
              ) : (
                <span className="font-mono text-[9px] text-slate-600">No broad lenses inferred yet</span>
              )}
            </div>

            <div className="xl:col-span-5 min-w-0">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-0.5">
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-[#5a6480]">
                  {selectedIncomingCount} in / {selectedOutgoingCount} out
                </span>
                {selectedNearestRelations.map(({ edge, other, direction }) => (
                  <button
                    key={`${edge.source}-${edge.target}`}
                    onClick={() => other && selectPerson(other.id)}
                    className="shrink-0 max-w-[190px] truncate rounded border border-[#252a3d] bg-[#0b0d14] px-2 py-1 text-left font-mono text-[9px] text-slate-400 hover:border-[#7b9cf5] hover:text-slate-100 cursor-pointer"
                    title={edge.note || edge.type}
                  >
                    {direction === "in" ? "<" : ">"} {other?.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          )}

          {showRelationshipInspector && selectedThinker && (
          <div className={`${showFocusContextBand || showConnectionRadar ? "mt-3 " : ""}grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] gap-2 items-center`}>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#5a6480]">Relationship Inspector</span>
              <span className="rounded border border-[#252a3d] bg-[#0b0d14] px-1.5 py-0.5 text-[8.5px] font-mono text-slate-500">
                {selectedRelationshipRows.length} edges
              </span>
              {selectedSourceGapCount > 0 && (
                <button
                  onClick={openSourceGapsView}
                  className="rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[8.5px] font-mono text-violet-200 hover:border-violet-300 cursor-pointer"
                  title="Open source gaps view"
                >
                  {selectedSourceGapCount} gaps
                </button>
              )}
            </div>

            <div className="min-w-0 flex gap-2 overflow-x-auto scrollbar-thin pb-0.5">
              {selectedRelationshipRows.length > 0 ? (
                selectedRelationshipRows.slice(0, 10).map(({ edge, other, direction, confidence, hasSources, needsSource, lowConfidence }) => {
                  const otherField = other?.fields?.[0] || "Philosophy";
                  const col = FIELD_COLOR[otherField] || "#94a3b8";
                  return (
                    <div
                      key={`relationship-inspector-${edge.source}-${edge.target}`}
                      className="shrink-0 w-[280px] rounded-md border border-[#252a3d] bg-[#0b0d14] px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: col }} />
                        <button
                          onClick={() => other && selectPerson(other.id)}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                          title={edge.note || edge.type}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[9px] text-slate-600">{direction === "in" ? "<" : ">"}</span>
                            <span className="truncate text-[10.5px] font-semibold text-slate-200">{other?.name}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[9px] font-mono text-slate-500">
                            {edge.type} · strength {edge.strength}
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            if (!other) return;
                            setHighlightPath(direction === "out" ? [selectedThinker.id, other.id] : [other.id, selectedThinker.id]);
                          }}
                          className="rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-2 py-1 text-[8.5px] font-mono text-[#9bdaff] hover:border-[#9bdaff] cursor-pointer"
                          title="Highlight this edge"
                        >
                          Path
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={`rounded border px-1.5 py-0.5 text-[8.5px] font-mono ${
                          lowConfidence ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                        }`}>
                          {Math.round(confidence * 100)}%
                        </span>
                        <span className={`rounded border px-1.5 py-0.5 text-[8.5px] font-mono ${
                          needsSource ? "border-violet-400/30 bg-violet-400/10 text-violet-200" : "border-[#252a3d] bg-[#090b10] text-slate-500"
                        }`}>
                          {hasSources ? `${edge.sourceClaims?.length || 0} sources` : "needs source"}
                        </span>
                        {edge.status && (
                          <span className="truncate rounded border border-[#252a3d] bg-[#090b10] px-1.5 py-0.5 text-[8.5px] font-mono text-slate-500">
                            {edge.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No Direct Relationships"
                  detail="Use Trace Path, widen filters, or open Source Studio when you are ready to add or review relationships."
                  action={isSourceStudio ? { label: "Open Review", onClick: () => openWorkbenchPanel("candidateRelationships") } : undefined}
                />
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isSourceStudio && (
                <button
                  onClick={() => openWorkbenchPanel("candidateRelationships")}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-mono text-emerald-200 hover:border-emerald-300 cursor-pointer"
                >
                  Review
                </button>
              )}
              <button
                onClick={() => setRelationshipInspectorOpen(false)}
                className="rounded border border-[#252a3d] bg-[#090b10] p-1 text-slate-500 hover:text-slate-200 cursor-pointer"
                title="Close relationship inspector"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          )}

          {showConnectionRadar && (
          <div className={`${showFocusContextBand ? "mt-3 " : ""}grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-2 items-center`}>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#5a6480]">Connection Radar</span>
              {showRadarCurationActions && isSourceStudio && (
                <button
                  onClick={() => {
                    openWorkbenchPanel("candidateRelationships");
                  }}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-mono text-emerald-200 hover:border-emerald-300 cursor-pointer"
                >
                  Review Queue
                </button>
              )}
            </div>

            <div className="min-w-0 flex gap-2 overflow-x-auto scrollbar-thin pb-0.5">
              {focusLinkQueue.length > 0 ? (
                focusLinkQueue.map((candidate) => {
                  const person = candidate.person;
                  const col = FIELD_COLOR[person.fields?.[0] || "Philosophy"] || "#94a3b8";
                  return (
                    <div
                      key={`focus-radar-${person.id}`}
                      className="shrink-0 w-[250px] rounded-md border border-[#252a3d] bg-[#0b0d14] px-3 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                        <button
                          onClick={() => {
                            setHighlightPath([selectedThinker.id, person.id]);
                            selectPerson(person.id, { preserveHighlight: true });
                          }}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <div className="truncate text-[10.5px] font-semibold text-slate-200">{person.name}</div>
                          <div className="truncate text-[9px] font-mono text-slate-500">
                            {formatYear(person.birth)} · {getSuggestedLinkReason(candidate)}
                          </div>
                        </button>
                        {showRadarCurationActions && isSourceStudio && (
                          <button
                            onClick={() => addSuggestedRelationship(selectedThinker, person, `Shared context: ${getSuggestedLinkReason(candidate)}`)}
                            className="rounded border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-2 py-1 text-[9px] font-mono text-[#9bdaff] hover:border-[#9bdaff] cursor-pointer"
                            title="Add a low-confidence suggested relationship"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No High-Signal Suggestions"
                  detail="Try widening filters, choosing a better-connected focus, or opening the review view to repair sparse records."
                  action={{ label: "Needs Review", onClick: openNeedsReviewView }}
                />
              )}
            </div>
          </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {filterDrawerOpen && (
          <motion.div
            data-testid="filter-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="shrink-0 glass-panel border-b border-[#22273b] overflow-hidden z-20 shadow-xl shadow-black/40"
          >
            <div className="max-h-[min(420px,40vh)] overflow-y-auto scrollbar-thin p-6 space-y-5 select-none text-xs">
              
              {/* Row 1: Epoch Limits & Timeline Sliders */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start pb-4 border-b border-[#22273b]/60">
                {/* Epoch Shortcuts Selector */}
                <div className="xl:col-span-5 space-y-2">
                  <h4 className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider flex items-center gap-1.5 font-bold mb-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-500/80" />
                    <span>Era Shortcuts</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {namedTimeRanges.map((period) => {
                      const active = minYear === period.start && maxYear === period.end;
                      return (
                        <button
                          key={`${period.label}-${period.start}-${period.end}`}
                          onClick={() => applyEpochSnap(period.start, period.end)}
                          className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                            active
                              ? "border-amber-400/60 bg-amber-400/15 text-amber-200"
                              : "border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60"
                          }`}
                          title={`${period.label}: ${formatYear(period.start)} to ${formatYear(period.end)}`}
                        >
                          {period.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Precise Year Double Ranges */}
                <div className="xl:col-span-7 space-y-2">
                  <h4 className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider font-bold mb-1">
                    Time Range
                  </h4>
                  <div className="flex gap-4 items-center bg-[#090a0f] border border-[#22273b] p-3 rounded-md">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-slate-500">From</span>
                      <input
                        type="number"
                        min="-650"
                        max="2030"
                        step="50"
                        value={minYear}
                        onChange={(e) => setMinYear(Math.min(maxYear, Number(e.target.value)))}
                        className="w-16 bg-slate-800 border border-slate-700 text-slate-200 text-center rounded py-0.5 px-1 focus:outline-none"
                      />
                    </div>

                    <div className="flex-1 relative h-1.5 flex items-center bg-slate-800 rounded range-slider-container">
                      <input
                        type="range"
                        min="-650"
                        max="2030"
                        value={minYear}
                        onChange={(e) => setMinYear(Math.min(maxYear, Number(e.target.value)))}
                        className="absolute w-full h-1.5 bg-transparent appearance-none pointer-events-auto accent-[#7b9cf5] cursor-pointer"
                        style={{ zIndex: minYear > (2030 - 650) / 2 ? 11 : 10 }}
                      />
                      <input
                        type="range"
                        min="-650"
                        max="2030"
                        value={maxYear}
                        onChange={(e) => setMaxYear(Math.max(minYear, Number(e.target.value)))}
                        className="absolute w-full h-1.5 bg-transparent appearance-none pointer-events-auto accent-[#7b9cf5] cursor-pointer"
                        style={{ zIndex: maxYear < (2030 - 650) / 2 ? 11 : 10 }}
                      />
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-slate-500">To</span>
                      <input
                        type="number"
                        min="-650"
                        max="2030"
                        step="50"
                        value={maxYear}
                        onChange={(e) => setMaxYear(Math.max(minYear, Number(e.target.value)))}
                        className="w-16 bg-slate-800 border border-slate-700 text-slate-200 text-center rounded py-0.5 px-1 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Faceted filtering */}
              <div className="space-y-3 pb-4 border-b border-[#22273b]/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider font-bold">
                      Faceted Filters
                    </h4>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                      Select multiple values in each category. Counts show total available thinkers.
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setSelectedFields([]);
                        setSelectedSubfields([]);
                        setSelectedLensTags([]);
                        setSelectedEras([]);
                        setSelectedRegions([]);
                      }}
                      className="px-2.5 py-1 text-[10px] font-mono rounded-md border border-[#252a3d] text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear Facets
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                  {ATLAS_LENSES.map((lens) => (
                    <div key={lens.id} className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{lens.label}</div>
                          <p className="text-[9.5px] text-slate-600 font-mono mt-0.5">{lens.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {lens.options.map((option) => {
                          const active = selectedLensTags.includes(option.id);
                          const count = countPeopleBy((p) => inferLensTags(p)[lens.id]?.includes(option.id) ?? false);
                          return (
                            <button
                              key={option.id}
                              onClick={() => handleToggleLensTag(option.id)}
                              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[9.5px] font-mono border transition-colors cursor-pointer ${
                                active ? "bg-cyan-400/15 border-cyan-300/70 text-cyan-100" : "border-[#252a3d] text-slate-400 hover:text-slate-100 hover:border-slate-600"
                              }`}
                            >
                              <span>{option.label}</span>
                              <span className="text-slate-600">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
                  <div className="xl:col-span-2 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">Disciplines</div>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                      {disciplineGroups.map((group) => {
                        const groupOpen = expandedDisciplineGroups.includes(group.name);
                        const groupCount = countPeopleBy((p) => p.fields?.some((field) => group.fields.includes(field)) ?? false);
                        return (
                          <div key={group.name} className="border border-[#1d2232] rounded-md bg-[#0e1119]">
                            <button
                              data-testid={`discipline-group-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                              onClick={() => toggleDisciplineGroup(group.name)}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-left font-mono text-[10px] text-slate-200 hover:text-white cursor-pointer"
                            >
                              <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${groupOpen ? "rotate-90" : ""}`} />
                              <span className="flex-1 uppercase tracking-wider">{group.name}</span>
                              <span className="text-slate-600">{groupCount}</span>
                            </button>

                            {groupOpen && (
                              <div className="pb-2 px-2 space-y-1">
                                {group.fields.map((field) => {
                                  const fieldOpen = expandedFacetFields.includes(field);
                                  const active = selectedFields.includes(field);
                                  const col = FIELD_COLOR[field] || "#94a3b8";
                                  const count = countPeopleBy((p) => p.fields?.includes(field) ?? false);
                                  const fieldSubfields = subfieldsByField[field] || [];
                                  return (
                                    <div key={field} className="rounded-md">
                                      <div className={`flex items-center gap-1 rounded border transition-colors ${
                                        active ? "bg-[#1f2438] border-[#7b9cf5]" : "border-transparent hover:bg-[#151824]"
                                      }`}>
                                        <button
                                          data-testid={`facet-field-expand-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                                          onClick={() => toggleFacetFieldExpansion(field)}
                                          className="p-1 text-slate-500 hover:text-slate-200 cursor-pointer"
                                          title={`Expand ${field} subfields`}
                                        >
                                          <ChevronRight className={`w-3 h-3 transition-transform ${fieldOpen ? "rotate-90" : ""}`} />
                                        </button>
                                        <button
                                          onClick={() => handleToggleField(field)}
                                          className="flex-1 min-w-0 flex items-center gap-2 py-1 pr-2 text-left text-[10px] font-mono cursor-pointer"
                                        >
                                          <span className={`w-3 h-3 rounded-sm border flex items-center justify-center ${active ? "border-[#7b9cf5]" : "border-slate-700"}`}>
                                            {active && <span className="w-1.5 h-1.5 rounded-sm bg-[#7b9cf5]" />}
                                          </span>
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} />
                                          <span className={`flex-1 truncate ${active ? "text-white" : "text-slate-400"}`}>{field}</span>
                                          <span className="text-slate-600">{count}</span>
                                        </button>
                                      </div>

                                      {fieldOpen && (
                                        <div data-testid={`facet-field-topics-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="ml-8 mt-1 space-y-1 border-l border-[#252a3d] pl-2">
                                          {(topicGroupsByField[field] || []).map((topicGroup) => {
                                            const visibleTopics = topicGroup.topics.slice(0, 18);
                                            const groupActiveCount = topicGroup.topics.filter((topic) => selectedSubfields.includes(topic)).length;
                                            return (
                                              <div key={`${field}-${topicGroup.name}`} className="rounded bg-[#0a0c12]/70 px-1.5 py-1">
                                                <div className="mb-1 flex items-center gap-2 px-1 font-mono text-[8.5px] uppercase tracking-wider text-slate-600">
                                                  <span className="flex-1 truncate">{topicGroup.name}</span>
                                                  {groupActiveCount > 0 && <span className="text-[#9bdaff]">{groupActiveCount}</span>}
                                                </div>
                                                <div className="space-y-1">
                                                  {visibleTopics.map((sub) => {
                                                    const subActive = selectedSubfields.includes(sub);
                                                    const subCount = countPeopleBy((p) => p.fields?.includes(field) && (p.subfields?.includes(sub) ?? false));
                                                    return (
                                                      <button
                                                        key={`${field}-${topicGroup.name}-${sub}`}
                                                        onClick={() => handleToggleSubfield(sub)}
                                                        className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left text-[9.5px] font-mono border transition-colors cursor-pointer ${
                                                          subActive ? "bg-[#7b9cf5]/15 border-[#7b9cf5]/60 text-white" : "border-transparent text-slate-500 hover:bg-[#151824] hover:text-slate-200"
                                                        }`}
                                                      >
                                                        <span className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center ${subActive ? "border-[#7b9cf5]" : "border-slate-700"}`}>
                                                          {subActive && <span className="w-1 h-1 rounded-sm bg-[#7b9cf5]" />}
                                                        </span>
                                                        <span className="flex-1 truncate">{sub}</span>
                                                        <span className="text-slate-600">{subCount}</span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                          {fieldSubfields.length === 0 && (
                                            <div className="px-2 py-1 text-[9.5px] text-slate-600 font-mono italic">No mapped subfields.</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">Era</div>
                    <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
                      {allEras.map((era) => {
                        const active = selectedEras.includes(era);
                        const count = countPeopleBy((p) => p.era === era);
                        return (
                          <button
                            key={era}
                            onClick={() => handleToggleEra(era)}
                            className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] font-mono border transition-colors cursor-pointer ${
                              active ? "bg-[#1f2438] border-emerald-400 text-white" : "border-transparent text-slate-400 hover:bg-[#151824] hover:text-slate-100"
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-sm border flex items-center justify-center ${active ? "border-emerald-400" : "border-slate-700"}`}>
                              {active && <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />}
                            </span>
                            <span className="flex-1 truncate">{era}</span>
                            <span className="text-slate-600">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">Region</div>
                    <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
                      {allRegions.map((region) => {
                        const active = selectedRegions.includes(region);
                        const count = countPeopleBy((p) => p.region === region);
                        return (
                          <button
                            key={region}
                            onClick={() => handleToggleRegion(region)}
                            className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left text-[10px] font-mono border transition-colors cursor-pointer ${
                              active ? "bg-[#1f2438] border-amber-400 text-white" : "border-transparent text-slate-400 hover:bg-[#151824] hover:text-slate-100"
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-sm border flex items-center justify-center ${active ? "border-amber-400" : "border-slate-700"}`}>
                              {active && <span className="w-1.5 h-1.5 rounded-sm bg-amber-400" />}
                            </span>
                            <span className="flex-1 truncate">{region}</span>
                            <span className="text-slate-600">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Sorting Options & Interface Layer Switches */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[...selectedFields, ...selectedEras, ...selectedRegions, ...selectedSubfields, ...selectedLensTags].map((filterValue) => (
                    <button
                      key={filterValue}
                      onClick={() => {
                        setSelectedFields((prev) => prev.filter((item) => item !== filterValue));
                        setSelectedEras((prev) => prev.filter((item) => item !== filterValue));
                        setSelectedRegions((prev) => prev.filter((item) => item !== filterValue));
                        setSelectedSubfields((prev) => prev.filter((item) => item !== filterValue));
                        setSelectedLensTags((prev) => prev.filter((item) => item !== filterValue));
                      }}
                      className="px-2.5 py-1 text-[10px] font-mono rounded-full border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                    >
                      {getLensOptionLabel(filterValue)} x
                    </button>
                  ))}
                </div>
              )}

              {/* Row 3: Sorting Options & Interface Layer Switches */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-1">
                {/* Sorters Selection */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider font-bold">Sort Index:</span>
                  <div className="flex items-center bg-[#090a0f] border border-[#22273b] p-0.5 rounded-md">
                    {(["birth", "field", "bridge", "relevance", "name"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSortMode(mode)}
                        className={`px-2.5 py-1 text-[10px] font-mono rounded cursor-pointer capitalize ${
                          sortMode === mode ? "bg-[#7b9cf5]/20 text-[#7b9cf5] font-bold" : "text-slate-500 hover:text-slate-200"
                        }`}
                      >
                        {mode === "birth" ? "Age" : mode === "bridge" ? "Significance" : mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Layer Visibility toggles */}
                <div className="flex flex-wrap items-center gap-2 text-[#465175] text-[10px] font-mono">
                  <button
                    onClick={fitTimelineToResults}
                    disabled={processedPeople.length === 0}
                    className="px-2.5 py-1 text-[10px] font-mono border border-[#7b9cf5]/50 bg-[#7b9cf5]/10 text-[#9bdaff] rounded-md cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Fit Results
                  </button>
                  <span className="text-[#5a6480] uppercase font-bold mr-1">Layer Visibility:</span>
                  <button
                    onClick={() => setShowMov((prev) => !prev)}
                    className={`px-2.5 py-1 text-[10px] font-mono border rounded-md cursor-pointer transition-colors ${
                      showMov ? "bg-slate-700/20 border-slate-600 text-slate-100" : "border-slate-800 text-[#5a6480]"
                    }`}
                  >
                    Epoch Bands
                  </button>
                  <button
                    onClick={() => setShowEdges((prev) => !prev)}
                    className={`px-2.5 py-1 text-[10px] font-mono border rounded-md cursor-pointer transition-colors ${
                      showEdges ? "bg-slate-700/20 border-slate-600 text-slate-100" : "border-slate-800 text-[#5a6480]"
                    }`}
                  >
                    Influence Lines
                  </button>
                  <select
                    value={edgeTypeFilter}
                    onChange={(event) => setEdgeTypeFilter(event.target.value)}
                    className="max-w-[150px] rounded-md border border-[#252a3d] bg-[#090a0f] px-2 py-1 text-[10px] font-mono text-slate-400 outline-none"
                    title="Filter edges by relationship type"
                  >
                    <option value="all">All edge types</option>
                    {edgeTypeOptions.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {isSourceStudio && (
                    <>
                      <select
                        value={edgeSourceFilter}
                        onChange={(event) => setEdgeSourceFilter(event.target.value as typeof edgeSourceFilter)}
                        className="rounded-md border border-[#252a3d] bg-[#090a0f] px-2 py-1 text-[10px] font-mono text-slate-400 outline-none"
                        title="Filter edges by source status"
                      >
                        <option value="all">All sources</option>
                        <option value="sourced">Sourced</option>
                        <option value="needs_source">Needs source</option>
                      </select>
                      <label className="flex items-center gap-1.5 rounded-md border border-[#252a3d] bg-[#090a0f] px-2 py-1 text-[10px] font-mono text-slate-500">
                        <span>{Math.round(edgeConfidenceFilter * 100)}%+</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={edgeConfidenceFilter}
                          onChange={(event) => setEdgeConfidenceFilter(Number(event.target.value))}
                          className="w-16 accent-[#7b9cf5]"
                          title="Minimum edge confidence"
                        />
                      </label>
                    </>
                  )}
                  {hasActiveEdgeFilters && (
                    <span className="text-[#5a6480]">
                      {filteredEdges.length}/{edges.length}
                    </span>
                  )}
                  {hasActiveEdgeFilters && (
                    <button
                      onClick={() => {
                        setEdgeTypeFilter("all");
                        setEdgeSourceFilter("all");
                        setEdgeConfidenceFilter(0);
                      }}
                      className="rounded-md border border-[#252a3d] px-2 py-1 text-[10px] font-mono text-slate-500 hover:text-slate-200 cursor-pointer"
                    >
                      Reset Edges
                    </button>
                  )}
                  <button
                    onClick={() => setShowWorks((prev) => !prev)}
                    className={`px-2.5 py-1 text-[10px] font-mono border rounded-md cursor-pointer transition-colors ${
                      showWorks ? "bg-slate-700/20 border-slate-600 text-slate-100" : "border-slate-800 text-[#5a6480]"
                    }`}
                  >
                    Discoveries
                  </button>
                  <button
                    onClick={() => setShowLabels((prev) => !prev)}
                    className={`px-2.5 py-1 text-[10px] font-mono border rounded-md cursor-pointer transition-colors ${
                      showLabels ? "bg-slate-700/20 border-slate-600 text-slate-100" : "border-slate-800 text-[#5a6480]"
                    }`}
                  >
                    Labels
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <AnimatePresence>
        {isSourceStudio && extensionWorkbenchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={workbenchPanelFrameClass}
          >
            <div className={workbenchPanelContentClass}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-[10px] text-emerald-300 uppercase tracking-wider font-bold">Source Studio</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {effectiveWorkbenchPanelMode} automation console for evidence coverage, conflicts, repair previews, and admin recovery.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded border border-[#22273b] bg-[#080a0f] p-0.5">
                    {workbenchPanelModes.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setWorkbenchPanelMode(mode.id)}
                        className={`rounded px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
                          workbenchPanelMode === mode.id ? "bg-emerald-500/15 text-emerald-200" : "text-slate-500 hover:text-slate-200"
                        }`}
                        title={`${mode.label} workbench panel`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setExtensionWorkbenchOpen(false)}
                    className="p-1 text-slate-500 hover:text-white cursor-pointer"
                    title="Close workbench"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#22273b] bg-[#080a0f] p-1">
                {([
                  ["sourceHealth", `Source health ${sourceGapEdges.length}`],
                  ["claimConflicts", `Claim conflicts ${automationConflictCount}`],
                  ["candidateRelationships", `Candidate relationships ${suggestedLinks.length}`],
                  ["repairJobs", `Repair jobs ${graphRepairPreview.diffs.length}`],
                  ["manualOverrides", `Manual overrides ${importReviewQueue.length}`],
                  ["exportRecovery", "Export/recovery"],
                ] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setWorkbenchTab(tab)}
                    className={`rounded px-3 py-1.5 text-[10px] font-mono transition-colors cursor-pointer ${
                      workbenchTab === tab
                        ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
                        : "text-slate-500 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
                <button
                  onClick={openSourceGapsView}
                  className="rounded-md border border-[#22273b] bg-[#090a0f] p-3 text-left hover:border-violet-400/50 hover:bg-[#111520] cursor-pointer"
                  title="Show relationships that need source coverage or stronger confidence"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Evidence Coverage</span>
                    <span className="rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[8px] font-mono text-violet-200">
                      {evidenceCoveragePercent}%
                    </span>
                  </div>
                  <div className="mt-2 font-serif text-xl font-bold text-slate-100">{sourceGapEdges.length}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-600">edges held for source review</div>
                </button>

                <button
                  onClick={() => setWorkbenchTab("candidateRelationships")}
                  className="rounded-md border border-[#22273b] bg-[#090a0f] p-3 text-left hover:border-emerald-400/50 hover:bg-[#111520] cursor-pointer"
                  title="Inspect queued and high-confidence relationship candidates"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Candidate Relationships</span>
                    <span className="rounded border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-mono text-emerald-200">
                      {linkReviewQueue.length} queued
                    </span>
                  </div>
                  <div className="mt-2 font-serif text-xl font-bold text-slate-100">{automationAcceptedCount}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-600">ready or high-confidence claims</div>
                </button>

                <button
                  onClick={() => setWorkbenchTab("claimConflicts")}
                  className="rounded-md border border-[#22273b] bg-[#090a0f] p-3 text-left hover:border-rose-400/50 hover:bg-[#111520] cursor-pointer"
                  title="Review duplicate and impossible-reference conflict risk"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Conflicts</span>
                    <span className="rounded border border-rose-400/30 bg-rose-400/10 px-1.5 py-0.5 text-[8px] font-mono text-rose-200">
                      {graphHealthReport.summary.critical} critical
                    </span>
                  </div>
                  <div className="mt-2 font-serif text-xl font-bold text-slate-100">{automationConflictCount}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-600">duplicate or invalid-record risks</div>
                </button>

                <button
                  onClick={() => setWorkbenchTab("repairJobs")}
                  className="rounded-md border border-[#22273b] bg-[#090a0f] p-3 text-left hover:border-amber-400/50 hover:bg-[#111520] cursor-pointer"
                  title="Preview repair jobs before changing canonical data"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Repair Preview</span>
                    <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-mono text-amber-200">
                      {graphRepairTriggers.length} triggers
                    </span>
                  </div>
                  <div className="mt-2 font-serif text-xl font-bold text-slate-100">{graphRepairPreview.diffs.length}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-slate-600">dry-run edge diffs available</div>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <div className="rounded-md border border-[#22273b] bg-[#090a0f] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Automation State</span>
                    <span className="font-mono text-[8.5px] text-slate-600">{graphHealthReport.findings.length} findings</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5">
                      <div className="font-mono text-[8px] uppercase text-emerald-300">Accepted</div>
                      <div className="font-serif text-lg font-bold text-slate-100">{automationAcceptedCount}</div>
                    </div>
                    <div className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5">
                      <div className="font-mono text-[8px] uppercase text-amber-300">Held</div>
                      <div className="font-serif text-lg font-bold text-slate-100">{automationHoldCount}</div>
                    </div>
                    <div className="rounded border border-rose-500/25 bg-rose-500/10 px-2 py-1.5">
                      <div className="font-mono text-[8px] uppercase text-rose-300">Conflicting</div>
                      <div className="font-serif text-lg font-bold text-slate-100">{automationConflictCount}</div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {automatedClaimDecisionFeed.length > 0 ? automatedClaimDecisionFeed.slice(0, 4).map((decision) => (
                      <div key={decision.id} className="rounded border border-[#252a3d] bg-[#0e1119] px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[9px] text-slate-300">{decision.label}</span>
                          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[7.5px] font-mono ${getAutomatedClaimDecisionClass(decision.status)}`}>
                            {decision.status}
                          </span>
                        </div>
                        <div className="mt-0.5 line-clamp-2 font-mono text-[8px] leading-snug text-slate-600">{decision.reason}</div>
                      </div>
                    )) : (
                      <div className="mt-2 rounded border border-[#252a3d] bg-[#0e1119] px-2 py-2 font-mono text-[9px] text-slate-600">
                        No automated claim decisions yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-[#22273b] bg-[#090a0f] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Conflict Feed</span>
                    <span className="font-mono text-[8.5px] text-slate-600">{topAutomationFindings.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {topAutomationFindings.length > 0 ? topAutomationFindings.map((finding) => (
                      <div key={`${finding.code}-${finding.targetId}`} className="rounded border border-[#252a3d] bg-[#0e1119] px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-[9px] text-slate-300">{finding.code}</span>
                          <span className={`shrink-0 rounded border px-1 py-0.5 text-[7.5px] font-mono ${
                            finding.severity === "critical"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }`}>
                            {finding.severity}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[8px] text-slate-600">{finding.targetId}</div>
                      </div>
                    )) : (
                      <div className="rounded border border-[#252a3d] bg-[#0e1119] px-2 py-2 font-mono text-[9px] text-slate-600">
                        No blocking conflict findings.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-[#22273b] bg-[#090a0f] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Repair Diffs</span>
                    <span className="font-mono text-[8.5px] text-slate-600">{graphRepairPreview.applied ? "applied" : "dry run"}</span>
                  </div>
                  <div className="space-y-1.5">
                    {graphRepairPreview.diffs.slice(0, 3).map((diff) => (
                      <div key={`${diff.action}-${diff.edge.source}-${diff.edge.target}`} className="rounded border border-[#252a3d] bg-[#0e1119] px-2 py-1.5">
                        <div className="truncate font-mono text-[9px] text-slate-300">{diff.edge.source}{" -> "}{diff.edge.target}</div>
                        <div className="mt-0.5 truncate font-mono text-[8px] text-slate-600">{diff.reason}</div>
                      </div>
                    ))}
                    {graphRepairPreview.diffs.length === 0 && (
                      <div className="rounded border border-[#252a3d] bg-[#0e1119] px-2 py-2 font-mono text-[9px] text-slate-600">
                        No weak unsupported edges ready for demotion.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {reviewUndoSnapshot && (
                <div className="flex flex-col gap-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-[8.5px] uppercase tracking-wider text-amber-300">Last Review Action</div>
                    <div className="truncate text-[10px] font-mono text-slate-500">{reviewUndoSnapshot.label}</div>
                  </div>
                  <button
                    onClick={restoreReviewUndoSnapshot}
                    className="shrink-0 rounded border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[9px] font-mono text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                  >
                    Undo
                  </button>
                </div>
              )}

              {workbenchTab === "candidateRelationships" && (
                <div className="space-y-3">
                  <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Canonical Threads</span>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                          Curated chains for following concepts across fields and eras.
                        </p>
                      </div>
                      <span className="font-mono text-[9px] text-slate-600">{canonicalThreads.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {canonicalThreads.map((thread) => {
                        const threadMarkers = threadJunctionMarkers.filter((marker) =>
                          marker.threadIds.includes(thread.id) ||
                          thread.people.includes(marker.entityId)
                        );
                        const branchCount = threadMarkers.filter((marker) => marker.kind === "branch" || marker.kind === "both").length;
                        const convergenceCount = threadMarkers.filter((marker) => marker.kind === "convergence" || marker.kind === "both").length;
                        return (
                        <button
                          key={thread.id}
                          onClick={() => focusCanonicalThread(thread)}
                          className="rounded-md border border-[#1d2232] bg-[#0e1119] p-2 text-left hover:border-[#7b9cf5] hover:bg-[#151824] cursor-pointer"
                          title={thread.purpose}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-serif text-sm font-bold text-slate-100">{thread.title}</div>
                              <div className="mt-0.5 truncate font-mono text-[8.5px] text-slate-600">{thread.field}</div>
                            </div>
                            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-mono ${
                              thread.confidence === "high"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : thread.confidence === "medium"
                                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}>
                              {thread.confidence}
                            </span>
                          </div>
                          <div className="mt-2 truncate text-[9px] font-mono text-slate-500">
                            {thread.resolvedPeople.map((person) => person.name).join(" -> ")}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span className="rounded border border-[#252a3d] px-1.5 py-0.5 text-[8px] font-mono text-slate-500">
                              {thread.resolvedPeople.length} steps
                            </span>
                            {thread.concepts.slice(0, 3).map((concept) => (
                              <span key={`${thread.id}-${concept}`} className="rounded border border-[#252a3d] px-1.5 py-0.5 text-[8px] font-mono text-slate-500">
                                {concept}
                              </span>
                            ))}
                            {thread.missingPeople.length > 0 && (
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-mono text-amber-300">
                                {thread.missingPeople.length} gaps
                              </span>
                            )}
                            {thread.edgeGapCount > 0 && (
                              <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-mono text-rose-300">
                                {thread.edgeGapCount} edge gaps
                              </span>
                            )}
                            {thread.weakEdgeCount > 0 && (
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-mono text-amber-300">
                                {thread.weakEdgeCount} weak edges
                              </span>
                            )}
                            {thread.gapFindings.length > 0 && (
                              <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-mono text-rose-300">
                                {thread.gapFindings.length} audit gaps
                              </span>
                            )}
                            {branchCount > 0 && (
                              <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] font-mono text-cyan-200">
                                {branchCount} branch
                              </span>
                            )}
                            {convergenceCount > 0 && (
                              <span className="rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[8px] font-mono text-violet-200">
                                {convergenceCount} convergence
                              </span>
                            )}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                    {activeCanonicalThread && (
                      <div className="mt-3 rounded-md border border-[#252a3d] bg-[#0b0d14] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[9px] uppercase tracking-wider text-slate-500">{activeCanonicalThread.title}</div>
                            <div className="mt-0.5 truncate text-[10px] font-mono text-slate-300">
                              {activeCanonicalThread.resolvedPeople[selectedThreadStep]?.name}
                              {" -> "}
                              {activeCanonicalThread.resolvedPeople[selectedThreadStep + 1]?.name || "End"}
                            </div>
                          </div>
                          <span className="shrink-0 rounded border border-[#252a3d] px-1.5 py-0.5 text-[8px] font-mono text-slate-500">
                            {Math.min(selectedThreadStep + 1, activeCanonicalThread.resolvedPeople.length - 1)} / {activeCanonicalThread.resolvedPeople.length - 1}
                          </span>
                        </div>
                        <div className="mt-2 rounded border border-[#252a3d] bg-[#0e1119] px-2 py-1.5">
                          {(() => {
                            const stepEdge = activeCanonicalThread.stepEdges[selectedThreadStep];
                            const source = activeCanonicalThread.resolvedPeople[selectedThreadStep];
                            const target = activeCanonicalThread.resolvedPeople[selectedThreadStep + 1];
                            return (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-mono text-[9px] text-slate-300">
                                    {source?.name}{" -> "}{target?.name || "Thread complete"}
                                  </span>
                                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-mono ${
                                    stepEdge
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                      : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                  }`}>
                                    {stepEdge ? "mapped" : "gap"}
                                  </span>
                                </div>
                                <div className="mt-1 truncate font-mono text-[8.5px] text-slate-600">
                                  {stepEdge
                                    ? `${stepEdge.type} / confidence ${stepEdge.confidence ?? 0.5} / ${(stepEdge.sourceClaims || stepEdge.claimIds || []).length} source claims`
                                    : "No relationship edge currently connects this thread step."}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <button
                            onClick={() => focusCanonicalThreadRelationshipStep(activeCanonicalThread, selectedThreadStep - 1)}
                            disabled={selectedThreadStep === 0}
                            className="rounded border border-[#252a3d] px-2 py-1 text-[8.5px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Prev Edge
                          </button>
                          <button
                            onClick={() => setHighlightPath(activeCanonicalThread.resolvedPeople.map((person) => person.id))}
                            className="rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-2 py-1 text-[8.5px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                          >
                            Full Thread
                          </button>
                          <button
                            onClick={() => focusCanonicalThreadRelationshipStep(activeCanonicalThread, selectedThreadStep + 1)}
                            disabled={selectedThreadStep >= activeCanonicalThread.resolvedPeople.length - 2}
                            className="rounded border border-[#252a3d] px-2 py-1 text-[8.5px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Next Edge
                          </button>
                        </div>
                        <div className="mt-2 truncate text-[8.5px] font-mono text-slate-600">
                          {activeCanonicalThread.resolvedPeople
                            .slice(Math.max(0, selectedThreadStep - 1), Math.min(activeCanonicalThread.resolvedPeople.length, selectedThreadStep + 2))
                            .map((person) => person.name)
                            .join(" -> ")}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Add Relationship</span>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">
                          Create a sourced or provisional link from the selected focus.
                        </p>
                      </div>
                      <span className="font-mono text-[9px] text-slate-600 truncate max-w-[180px]">
                        {selectedThinker ? selectedThinker.name : "No focus selected"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
                      <select
                        value={relationshipDraft.direction}
                        onChange={(event) => setRelationshipDraft((prev) => ({ ...prev, direction: event.target.value as "out" | "in" }))}
                        disabled={!selectedThinker}
                        className="xl:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 disabled:opacity-40"
                      >
                        <option value="out">Focus influences</option>
                        <option value="in">Influenced by</option>
                      </select>

                      <div className="xl:col-span-3">
                        <input
                          list="thinker-options"
                          value={relationshipDraft.targetName}
                          onChange={(event) => setRelationshipDraft((prev) => ({ ...prev, targetName: event.target.value }))}
                          disabled={!selectedThinker}
                          placeholder="Target thinker"
                          className="w-full rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 disabled:opacity-40"
                        />
                        <datalist id="thinker-options">
                          {people
                            .filter((person) => person.id !== selectedId)
                            .map((person) => (
                              <option key={person.id} value={person.name} />
                            ))}
                        </datalist>
                      </div>

                      <input
                        value={relationshipDraft.type}
                        onChange={(event) => setRelationshipDraft((prev) => ({ ...prev, type: event.target.value }))}
                        disabled={!selectedThinker}
                        placeholder="Relationship type"
                        className="xl:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 disabled:opacity-40"
                      />

                      <label className="xl:col-span-1 flex items-center gap-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[9px] font-mono text-slate-500">
                        <span>S</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={relationshipDraft.strength}
                          onChange={(event) => setRelationshipDraft((prev) => ({ ...prev, strength: Math.max(1, Math.min(5, Number(event.target.value))) }))}
                          disabled={!selectedThinker}
                          className="w-full bg-transparent text-slate-200 outline-none disabled:opacity-40"
                        />
                      </label>

                      <label className="xl:col-span-1 flex items-center gap-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[9px] font-mono text-slate-500">
                        <span>C</span>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={relationshipDraft.confidence}
                          onChange={(event) => setRelationshipDraft((prev) => ({ ...prev, confidence: Math.max(0, Math.min(1, Number(event.target.value))) }))}
                          disabled={!selectedThinker}
                          className="w-full bg-transparent text-slate-200 outline-none disabled:opacity-40"
                        />
                      </label>

                      <input
                        value={relationshipDraft.note}
                        onChange={(event) => setRelationshipDraft((prev) => ({ ...prev, note: event.target.value }))}
                        disabled={!selectedThinker}
                        placeholder="Evidence note"
                        className="xl:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 disabled:opacity-40"
                      />

                      <button
                        onClick={addManualRelationship}
                        disabled={!selectedThinker || relationshipDraft.targetName.trim() === ""}
                        className="xl:col-span-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        "Influence",
                        "Critique",
                        "Transmission",
                        "Collaboration",
                        "Conceptual parallel",
                        "likely influence",
                        "direct mentorship",
                        "collaboration",
                        "parallel development",
                        "source-context neighbor",
                        "needs review",
                        "Suggested relationship",
                      ].map((type) => (
                        <button
                          key={type}
                          onClick={() => setRelationshipDraft((prev) => ({ ...prev, type }))}
                          disabled={!selectedThinker}
                          className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer disabled:opacity-35 ${
                            relationshipDraft.type === type
                              ? "border-[#7b9cf5] bg-[#7b9cf5]/15 text-[#9bdaff]"
                              : "border-[#252a3d] text-slate-500 hover:text-slate-200"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {[
                    { title: "Unlinked", count: unlinkedThinkers.length, list: unlinkedThinkers },
                    { title: "Sparse Links", count: sparseThinkers.length, list: sparseThinkers },
                  ].map((queue) => (
                    <div key={queue.title} className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">{queue.title}</span>
                        <span className="font-mono text-[9px] text-slate-600">{queue.count}</span>
                      </div>
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-thin pr-1">
                        {queue.list.length > 0 ? (
                          queue.list.map((person) => {
                            const col = FIELD_COLOR[person.fields?.[0] || "Philosophy"] || "#94a3b8";
                            return (
                              <button
                                key={`${queue.title}-${person.id}`}
                                onClick={() => {
                                  selectPerson(person.id);
                                  setViewMode("split");
                                }}
                                className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded border border-transparent hover:border-[#7b9cf5] hover:bg-[#151824] cursor-pointer"
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                                <span className="flex-1 truncate text-[10px] font-mono text-slate-300">{person.name}</span>
                                <span className="text-[8.5px] text-slate-600 font-mono">{person.fields?.[0]}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-[10px] text-slate-600 italic font-mono py-2">Nothing in this queue.</div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Link Review Queue</span>
                      <span className="font-mono text-[9px] text-slate-600">{linkReviewQueue.length}</span>
                    </div>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-thin pr-1">
                      {linkReviewQueue.length > 0 ? (
                        linkReviewQueue.map((item) => (
                          <div key={item.id} className="rounded border border-[#252a3d] bg-[#0b0d14] px-2 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => {
                                  setHighlightPath([item.sourceId, item.targetId]);
                                  selectPerson(item.targetId, { preserveHighlight: true });
                                  setViewMode("split");
                                }}
                                className="min-w-0 flex-1 cursor-pointer text-left"
                              >
                                <span className="block truncate text-[9.5px] font-mono text-slate-300">{item.sourceName}{" -> "}{item.targetName}</span>
                                <span className="block truncate text-[8px] font-mono text-slate-600">{item.reason}</span>
                              </button>
                              <span className="shrink-0 text-[8px] font-mono text-emerald-300">{Math.max(1, Math.round(item.score))}</span>
                            </div>
                            <div className="mt-1 flex justify-end gap-1">
                              <button
                                onClick={() => rejectLinkReviewItem(item)}
                                className="rounded border border-rose-500/20 px-1.5 py-0.5 text-[8px] font-mono text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => acceptLinkReviewItem(item)}
                                className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-mono text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          title="No Links Queued"
                          detail="Queue a candidate from Link Candidates, or use high-confidence suggestions to build a shortlist for later review."
                          action={{ label: "High-Confidence View", onClick: openHighConfidenceSuggestionsView }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Link Candidates</span>
                      <span className="font-mono text-[9px] text-slate-600">{suggestedLinks.length}</span>
                    </div>
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-thin pr-1">
                      {selectedThinker && suggestedLinks.length > 0 ? (
                        suggestedLinks.map((candidate) => {
                          const person = candidate.person;
                          const col = FIELD_COLOR[person.fields?.[0] || "Philosophy"] || "#94a3b8";
                          const shared = [
                            ...candidate.sharedFields,
                            ...candidate.sharedTopics,
                            ...candidate.sharedLensTags.map(getLensOptionLabel),
                          ].slice(0, 2);
                          const source = selectedThinker.birth <= person.birth ? selectedThinker : person;
                          const target = source.id === selectedThinker.id ? person : selectedThinker;
                          const queued = linkReviewQueue.some((item) => item.id === `${source.id}::${target.id}`);
                          const reason = shared.length > 0 ? `Shared context: ${shared.join(", ")}` : "Potential contextual match.";
                          return (
                            <div
                              key={`suggested-${person.id}`}
                              className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded border border-transparent hover:border-emerald-400 hover:bg-[#151824]"
                              title={shared.length > 0 ? `Shared: ${shared.join(", ")}` : "Potential contextual match"}
                            >
                              <button
                                onClick={() => {
                                  selectPerson(person.id);
                                  setHighlightPath([selectedThinker.id, person.id]);
                                  setViewMode("split");
                                }}
                                className="flex flex-1 min-w-0 items-center gap-2 cursor-pointer text-left"
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate text-[10px] font-mono text-slate-300">{person.name}</span>
                                  <span className="block truncate text-[8.5px] text-slate-600 font-mono">
                                    {shared.length > 0 ? shared.join(" / ") : person.fields?.[0]}
                                  </span>
                                </span>
                              </button>
                              <button
                                onClick={() => queueLinkReviewItem(selectedThinker, person, reason, candidate.score)}
                                disabled={queued}
                                className="shrink-0 rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-1.5 py-0.5 text-[8.5px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                                title="Queue this relationship for later review"
                              >
                                Queue
                              </button>
                              <button
                                onClick={() => addSuggestedRelationship(selectedThinker, person, reason)}
                                className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                                title="Add this as a low-confidence suggested relationship"
                              >
                                Add
                              </button>
                              <span className="text-[8.5px] text-emerald-300 font-mono">
                                {Math.max(1, Math.round(candidate.score))}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <EmptyState
                          title={selectedThinker ? "No Link Candidates" : "Select a Focus"}
                          detail={selectedThinker
                            ? "This focus has no strong contextual candidates under the current filters. Clear filters or use Source Gaps to find weak evidence."
                            : "Choose a thinker from the index or graph to generate relationship candidates."}
                          action={selectedThinker
                            ? { label: "Clear Filters", onClick: resetFilters }
                            : { label: "Explore", onClick: () => applyActivity("explore") }}
                        />
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {workbenchTab === "sourceHealth" && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                  <div className="xl:col-span-12 rounded-md border border-[#22273b] bg-[#090a0f] p-3">
                    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Adapter Run History</span>
                        <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                          Source adapter activity, held runs, and configuration errors.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-mono text-emerald-300">
                          {sourceAdapterRunSummary.completedRuns} completed
                        </span>
                        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-mono text-amber-300">
                          {sourceAdapterRunSummary.heldRuns} held
                        </span>
                        <span className="rounded border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-mono text-rose-300">
                          {sourceAdapterRunSummary.failedRuns} failed
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                      {sourceAdapterRunHistory.map((run) => (
                        <div key={run.id} className="rounded-md border border-[#252a3d] bg-[#0e1119] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-serif text-sm font-bold text-slate-100">{run.adapterName}</span>
                            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-mono ${getSourceAdapterRunClass(run.status)}`}>
                              {run.status}
                            </span>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-1 text-center font-mono text-[8px] text-slate-500">
                            <span className="rounded border border-[#252a3d] bg-[#090a0f] px-1 py-1">{run.queryCount} queries</span>
                            <span className="rounded border border-[#252a3d] bg-[#090a0f] px-1 py-1">{run.observationCount} obs</span>
                            <span className="rounded border border-[#252a3d] bg-[#090a0f] px-1 py-1">{run.claimCount} claims</span>
                          </div>
                          <div className="mt-1 truncate font-mono text-[8.5px] text-slate-600">
                            {run.runAt ? `Last run ${new Date(run.runAt).toLocaleString()}` : "No completed local run"}
                          </div>
                          {run.errorMessage && (
                            <div className="mt-1 rounded border border-rose-500/20 bg-rose-500/10 px-2 py-1 font-mono text-[8px] text-rose-300">
                              {run.errorMessage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {sourceAdapterRunSummary.latestErrors.length > 0 && (
                      <div className="mt-2 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1.5">
                        <div className="font-mono text-[8.5px] uppercase tracking-wider text-rose-300">Latest Error Summary</div>
                        <div className="mt-1 space-y-1">
                          {sourceAdapterRunSummary.latestErrors.map((error) => (
                            <div key={error.adapterId} className="truncate font-mono text-[8.5px] text-slate-500">
                              {error.adapterName}: {error.errorMessage}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="xl:col-span-7 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Topic Editor</span>
                      <span className="font-mono text-[9px] text-slate-600">{selectedThinker ? selectedThinker.name : "No focus selected"}</span>
                    </div>

                    {selectedThinker ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedThinker.subfields || []).length > 0 ? (
                            selectedThinker.subfields?.map((topic) => (
                              <button
                                key={`current-topic-${topic}`}
                                onClick={() => toggleThinkerTopic(selectedThinker.id, topic)}
                                className="rounded border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-2 py-1 text-[9px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                              >
                                {topic} x
                              </button>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono italic">No topics assigned.</span>
                          )}
                        </div>

                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Suggested Topics</div>
                          <div className="flex flex-wrap gap-1.5">
                            {getTopicSuggestions(selectedThinker).map((topic) => {
                              const active = selectedThinker.subfields?.includes(topic) ?? false;
                              return (
                                <button
                                  key={`suggest-topic-${topic}`}
                                  onClick={() => toggleThinkerTopic(selectedThinker.id, topic)}
                                  className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
                                    active
                                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                                      : "border-[#252a3d] text-slate-500 hover:text-slate-200"
                                  }`}
                                >
                                  {topic}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const input = event.currentTarget.elements.namedItem("customTopic") as HTMLInputElement;
                            if (input.value.trim()) {
                              toggleThinkerTopic(selectedThinker.id, input.value.trim());
                              input.value = "";
                            }
                          }}
                          className="flex gap-2"
                        >
                          <input
                            name="customTopic"
                            placeholder="Add custom topic"
                            className="flex-1 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600"
                          />
                          <button className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-200 hover:bg-emerald-500/20 cursor-pointer">
                            Add
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 italic font-mono py-2">Select a thinker to edit topics.</div>
                    )}
                  </div>

                  <div className="xl:col-span-5 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Needs Topics</span>
                      <span className="font-mono text-[9px] text-slate-600">{weaklyTaggedThinkers.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                      {weaklyTaggedThinkers.map((person) => {
                        const lensLabels = Object.values(inferLensTags(person)).flat().map(getLensOptionLabel).slice(0, 3);
                        const col = FIELD_COLOR[person.fields?.[0] || "Philosophy"] || "#94a3b8";
                        return (
                          <button
                            key={`tag-${person.id}`}
                            onClick={() => {
                              selectPerson(person.id);
                              setAddModalOpen(false);
                            }}
                            className="rounded-md border border-[#1d2232] bg-[#0e1119] p-3 text-left hover:border-[#7b9cf5] cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} />
                              <span className="truncate text-[10px] font-mono text-slate-200">{person.name}</span>
                            </div>
                            <div className="mt-1 text-[8.5px] font-mono text-slate-600 truncate">
                              {lensLabels.length > 0 ? lensLabels.join(" / ") : "No inferred lens"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {workbenchTab === "repairJobs" && (
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                  <div className="xl:col-span-5 rounded-md border border-[#22273b] bg-[#090a0f] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Dry-Run Triggers</span>
                        <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                          Repair jobs stay preview-only until an operator applies them.
                        </p>
                      </div>
                      <span className="font-mono text-[9px] text-slate-600">{graphRepairTriggers.length}</span>
                    </div>
                    <div className="space-y-2">
                      {graphRepairTriggers.length > 0 ? graphRepairTriggers.map((trigger) => (
                        <div key={trigger.id} className="rounded-md border border-[#252a3d] bg-[#0e1119] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-mono text-[9.5px] text-slate-300">{trigger.reason}</span>
                            <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-mono text-amber-300">
                              dry run
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {trigger.findingCodes.map((code) => (
                              <span key={`${trigger.id}-${code}`} className="rounded border border-[#252a3d] px-1.5 py-0.5 text-[8px] font-mono text-slate-500">
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )) : (
                        <EmptyState
                          title="No Repair Triggers"
                          detail="Current graph health findings do not cross configured repair thresholds."
                        />
                      )}
                    </div>
                  </div>

                  <div className="xl:col-span-7 rounded-md border border-[#22273b] bg-[#090a0f] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Repair Preview Diff</span>
                        <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                          Proposed canonical edge changes generated from quality policies.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {canRevertRepairPreview && (
                          <button
                            onClick={restoreReviewUndoSnapshot}
                            className="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[8.5px] font-mono text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                          >
                            Revert Batch
                          </button>
                        )}
                        <button
                          onClick={applyGraphRepairPreview}
                          disabled={graphRepairPreview.diffs.length === 0}
                          className="rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[8.5px] font-mono text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Apply Batch
                        </button>
                        <span className="font-mono text-[9px] text-slate-600">{graphRepairPreview.diffs.length}</span>
                      </div>
                    </div>
                    <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                      {graphRepairPreview.diffs.length > 0 ? graphRepairPreview.diffs.map((diff) => {
                        const source = peopleById.get(diff.edge.source) as Thinker | undefined;
                        const target = peopleById.get(diff.edge.target) as Thinker | undefined;
                        return (
                          <div key={`${diff.action}-${diff.edge.source}-${diff.edge.target}-${diff.edge.type}`} className="rounded-md border border-[#252a3d] bg-[#0e1119] p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                onClick={() => {
                                  setHighlightPath([diff.edge.source, diff.edge.target]);
                                  selectPerson(diff.edge.source, { preserveHighlight: true });
                                  setViewMode("split");
                                }}
                                className="min-w-0 flex-1 cursor-pointer text-left"
                              >
                                <span className="block truncate font-mono text-[10px] text-slate-300">
                                  {source?.name || diff.edge.source}{" -> "}{target?.name || diff.edge.target}
                                </span>
                                <span className="block truncate font-mono text-[8.5px] text-slate-600">{diff.edge.type}</span>
                              </button>
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-mono text-amber-300">
                                {diff.action}
                              </span>
                            </div>
                            <div className="mt-1 truncate font-mono text-[8.5px] text-slate-600">{diff.reason}</div>
                          </div>
                        );
                      }) : (
                        <EmptyState
                          title="No Diff Available"
                          detail="No weak unsupported relationship edges currently match automated repair policies."
                          action={{ label: "Source Health", onClick: () => setWorkbenchTab("sourceHealth") }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {workbenchTab === "manualOverrides" && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                  <div className="xl:col-span-12 rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <span className="font-mono text-[8.5px] uppercase tracking-wider text-amber-300">Admin Fallback Tools</span>
                        <p className="mt-0.5 text-[10px] font-mono text-slate-500">
                          Batch paste, CSV import, edited drafts, and duplicate metadata merge stay available for recovery and operator overrides.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {["batch paste", "CSV import", "duplicate merge", "manual accept"].map((label) => (
                          <span key={label} className="rounded border border-amber-500/25 bg-[#090a0f] px-1.5 py-0.5 text-[8px] font-mono text-amber-200">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="xl:col-span-7 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Manual Override Draft</span>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">Normalize or recover an external candidate after automation has held it.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {draftQueueItemId && (
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-emerald-300">
                            Editing queued
                          </span>
                        )}
                        <span className="font-mono text-[9px] text-slate-600">
                          {EXTERNAL_SOURCES.find((source) => source.id === importDraft.source)?.name}
                        </span>
                      </div>
                    </div>

                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        searchWikidataCandidates();
                      }}
                      className="mb-3 flex gap-2"
                    >
                      <input
                        value={wikidataQuery}
                        onChange={(event) => setWikidataQuery(event.target.value)}
                        placeholder="Search Wikidata"
                        className="flex-1 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600"
                      />
                      <button
                        disabled={wikidataLoading || wikidataQuery.trim() === ""}
                        className="rounded-md border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-3 py-2 text-[10px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {wikidataLoading ? "Searching" : "Search"}
                      </button>
                    </form>

                    {wikidataCandidates.length > 0 && (
                      <div className="mb-3 max-h-36 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                        {wikidataCandidates.map((candidate) => {
                          const confidence = getCandidateConfidence(wikidataQuery, candidate);
                          const qualityLabels = getImportQualityLabels(candidate, confidence);
                          return (
                          <div
                            key={candidate.id}
                            className="w-full rounded-md border border-[#1d2232] bg-[#0e1119] px-2 py-1.5 text-left hover:border-[#7b9cf5]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => useWikidataCandidate(candidate)}
                                className="min-w-0 flex-1 truncate text-left text-[10px] font-mono text-slate-200 hover:text-white cursor-pointer"
                              >
                                {candidate.name}
                              </button>
                              <span className="shrink-0 text-[8.5px] font-mono text-slate-600">{candidate.id}</span>
                              <button
                                onClick={() => queueWikidataCandidate(candidate, confidence)}
                                className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                              >
                                Queue
                              </button>
                            </div>
                            <div className="mt-0.5 truncate text-[8.5px] font-mono text-slate-600">
                              {candidate.birth ?? "?"} to {candidate.death ?? "present"} · {candidate.description || "No description"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {qualityLabels.map((label) => (
                                <span key={`${candidate.id}-${label.label}`} className={`rounded border px-1.5 py-0.5 text-[8px] font-mono ${getImportQualityClass(label.tone)}`}>
                                  {label.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mb-3 rounded-md border border-[#1d2232] bg-[#0b0d14] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Batch Paste / CSV Fallback</span>
                        <span className="font-mono text-[8.5px] text-slate-600">admin max 25</span>
                      </div>
                      <div className="flex gap-2">
                        <textarea
                          data-testid="batch-import-text"
                          value={wikidataBatchText}
                          onChange={(event) => setWikidataBatchText(event.target.value)}
                          placeholder="Paste names separated by commas or new lines"
                          className="min-h-16 flex-1 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600"
                        />
                        <button
                          onClick={searchWikidataBatch}
                          disabled={wikidataLoading || wikidataBatchText.trim() === ""}
                          className="self-stretch rounded-md border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-3 py-2 text-[10px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Find
                        </button>
                        <button
                          data-testid="queue-pasted-import-rows"
                          onClick={queuePastedImportRows}
                          disabled={!wikidataBatchText.includes("|")}
                          className="self-stretch rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Queue Rows
                        </button>
                        <input
                          ref={csvImportInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleCsvImport}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => csvImportInputRef.current?.click()}
                          title="Fallback CSV import for admin recovery and spreadsheet review"
                          className="self-stretch rounded-md border border-[#252a3d] bg-[#10131d] px-3 py-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          Import CSV
                        </button>
                      </div>
                      {wikidataBatchCandidates.length > 0 && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
                            <span className="text-[9px] font-mono text-slate-500">
                              {wikidataBatchCandidates.filter((item) => item.candidate && item.confidence >= importConfidenceThreshold && !item.duplicateId).length} ready at {importConfidenceThreshold}% / {wikidataBatchCandidates.length} reviewed
                            </span>
                            <button
                              onClick={acceptHighConfidenceWikidataBatch}
                              disabled={!wikidataBatchCandidates.some((item) => item.candidate && item.confidence >= importConfidenceThreshold && !item.duplicateId)}
                              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Queue Ready
                            </button>
                          </div>
                          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                          {wikidataBatchCandidates.map((item) => {
                            const qualityLabels = item.candidate ? getImportQualityLabels(item.candidate, item.confidence) : [];
                            return (
                            <div key={item.query} className="flex items-center gap-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-1.5">
                              <span className="w-24 shrink-0 truncate text-[9px] font-mono text-slate-600">{item.query}</span>
                              {item.candidate ? (
                                <>
                                  <button
                                    onClick={() => useWikidataCandidate(item.candidate!)}
                                    className="min-w-0 flex-1 truncate text-left text-[10px] font-mono text-slate-200 hover:text-white cursor-pointer"
                                  >
                                    {item.candidate.name} · {item.candidate.birth ?? "?"}
                                  </button>
                                  <div className="hidden max-w-40 shrink-0 flex-wrap gap-1 md:flex">
                                    {qualityLabels.slice(0, 2).map((label) => (
                                      <span key={`${item.query}-${label.label}`} className={`rounded border px-1.5 py-0.5 text-[8px] font-mono ${getImportQualityClass(label.tone)}`}>
                                        {label.label}
                                      </span>
                                    ))}
                                  </div>
                                  <span className={`rounded px-1.5 py-0.5 text-[8px] font-mono ${
                                    item.duplicateId
                                      ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                                      : item.confidence >= importConfidenceThreshold
                                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                      : "bg-slate-700/20 text-slate-500 border border-slate-700"
                                  }`}>
                                    {item.duplicateId ? "Duplicate" : `${item.confidence}%`}
                                  </span>
                                  <button
                                    onClick={() => queueWikidataCandidate(item.candidate!, item.confidence)}
                                    disabled={!!item.duplicateId || item.candidate.birth === null}
                                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    Queue
                                  </button>
                                </>
                              ) : (
                                <span className="text-[9px] font-mono text-slate-600">No candidate</span>
                              )}
                            </div>
                            );
                          })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                      <select value={importDraft.source} onChange={(event) => setImportDraft((prev) => ({ ...prev, source: event.target.value }))} className="md:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200">
                        {EXTERNAL_SOURCES.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                      </select>
                      <input data-testid="import-draft-name" value={importDraft.name} onChange={(event) => setImportDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name" className="md:col-span-4 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <input value={importDraft.birth} onChange={(event) => setImportDraft((prev) => ({ ...prev, birth: event.target.value }))} placeholder="Birth year" className="md:col-span-1 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <input value={importDraft.death} onChange={(event) => setImportDraft((prev) => ({ ...prev, death: event.target.value }))} placeholder="Death" className="md:col-span-1 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <select value={importDraft.field} onChange={(event) => setImportDraft((prev) => ({ ...prev, field: event.target.value }))} className="md:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200">
                        {allFields.map((field) => <option key={field} value={field}>{field}</option>)}
                      </select>
                      <input value={importDraft.region} onChange={(event) => setImportDraft((prev) => ({ ...prev, region: event.target.value }))} placeholder="Region" className="md:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <select value={importDraft.era} onChange={(event) => setImportDraft((prev) => ({ ...prev, era: event.target.value }))} className="md:col-span-2 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200">
                        <option value="">{importDraft.birth.trim() && !Number.isNaN(Number(importDraft.birth)) ? `Auto: ${inferEraFromYear(Number(importDraft.birth)) || "Unclassified"}` : "Auto era"}</option>
                        {allEras.map((era) => <option key={era} value={era}>{era}</option>)}
                      </select>
                      <input value={importDraft.topics} onChange={(event) => setImportDraft((prev) => ({ ...prev, topics: event.target.value }))} placeholder="Topics, comma separated" className="md:col-span-3 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <input value={importDraft.movement} onChange={(event) => setImportDraft((prev) => ({ ...prev, movement: event.target.value }))} placeholder="Movement" className="md:col-span-3 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <input value={importDraft.sourceUrl} onChange={(event) => setImportDraft((prev) => ({ ...prev, sourceUrl: event.target.value }))} placeholder="Source URL" className="md:col-span-6 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                      <textarea data-testid="import-draft-notes" value={importDraft.notes} onChange={(event) => setImportDraft((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Short review note" className="md:col-span-6 min-h-16 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-[9px] font-mono text-slate-600">Accepting creates a local thinker and preserves source context in notes.</div>
                      <div className="flex items-center gap-2">
                        {(importDraft.name.trim() || draftQueueItemId) && (
                          <button onClick={clearImportDraft} className="rounded-md border border-[#252a3d] px-3 py-2 text-[10px] font-mono text-slate-500 hover:text-slate-200 cursor-pointer">
                            Clear Draft
                          </button>
                        )}
                        <button data-testid="accept-import-draft" onClick={acceptImportDraft} disabled={!importDraft.name.trim() || Number.isNaN(Number(importDraft.birth))} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer">
                          {draftQueueItemId ? "Accept Edited" : "Accept Candidate"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-5 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="mb-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-200">Override Queue</span>
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">Held imports can be accepted, linked, cleared, or merged as an explicit operator action.</p>
                        </div>
                        <span className="font-mono text-[9px] text-slate-600">{importReviewQueue.length}</span>
                      </div>

                      {importReviewQueue.length > 0 && (
                        <div className="mb-3 rounded-md border border-[#1d2232] bg-[#0b0d14] p-2">
                          <div className="mb-2 grid grid-cols-[1fr_auto] items-center gap-3 rounded border border-[#252a3d] bg-[#0e1119] px-2 py-1.5">
                            <label className="min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Auto threshold</span>
                                <span className="font-mono text-[9px] text-emerald-300">{importConfidenceThreshold}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={importConfidenceThreshold}
                                onChange={(event) => updateImportConfidenceThreshold(Number(event.target.value))}
                                className="mt-1 w-full accent-emerald-400"
                              />
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={importConfidenceThreshold}
                              onChange={(event) => updateImportConfidenceThreshold(Number(event.target.value))}
                              className="w-14 rounded border border-[#252a3d] bg-[#090a0f] px-1.5 py-1 text-center text-[9px] font-mono text-slate-200"
                            />
                          </div>
                          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8.5px] text-slate-600">
                            <span>{importQueueAcceptableItems.length} acceptable</span>
                            <span>{importQueueLinkableItems.length} link-ready</span>
                            <span>{importQueueDuplicateCount} duplicates</span>
                            <span>{importQueueLowConfidenceCount} low-confidence</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
                            <button
                              onClick={() => acceptImportReviewItems(importQueueAcceptableItems)}
                              disabled={importQueueAcceptableItems.length === 0}
                              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Accept All
                            </button>
                            <button
                              onClick={() => acceptImportReviewItems(importQueueLinkableItems, true)}
                              disabled={importQueueLinkableItems.length === 0}
                              className="rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-1.5 text-[8.5px] font-mono text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Accept + Link
                            </button>
                            <button
                              onClick={clearDuplicateImportReviewItems}
                              disabled={importQueueDuplicateCount === 0}
                              className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[8.5px] font-mono text-amber-300 hover:bg-amber-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Clear Dups
                            </button>
                            <button
                              onClick={clearLowConfidenceImportReviewItems}
                              disabled={importQueueLowConfidenceCount === 0}
                              className="rounded border border-[#252a3d] bg-[#10131d] px-2 py-1.5 text-[8.5px] font-mono text-slate-400 hover:text-slate-200 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Clear Low
                            </button>
                            <button
                              onClick={clearImportReviewQueue}
                              className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[8.5px] font-mono text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                            >
                              Clear Queue
                            </button>
                          </div>
                        </div>
                      )}

                      <div data-testid="import-review-queue" className="max-h-[280px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                        {importReviewQueue.length > 0 ? (
                          importReviewQueue.map((item) => {
                            const candidate = item.candidate;
                            const currentDuplicateId = getDuplicateIdForCandidate(candidate);
                            const duplicate = currentDuplicateId ? people.find((person) => person.id === currentDuplicateId) : null;
                            const linkSuggestions = getCandidateLinkSuggestions(candidate);
                            const reviewStatus: ImportReviewStatus = duplicate ? "duplicate" : item.status;
                            const qualityLabels = getImportQualityLabels(candidate, item.confidence);
                            return (
                              <div key={item.id} data-testid="import-review-queue-item" className="rounded-md border border-[#1d2232] bg-[#0e1119] p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="truncate text-[11px] font-semibold text-slate-100">{candidate.name}</div>
                                    <div className="mt-0.5 truncate text-[8.5px] font-mono text-slate-600">
                                      {candidate.birth ?? "?"} to {candidate.death ?? "present"} · {(candidate.fields || []).join(", ") || inferFieldFromExternalText(candidate.description)}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-1">
                                    <span className={`rounded border px-1.5 py-0.5 text-[8px] font-mono ${
                                      duplicate
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                        : item.confidence >= importConfidenceThreshold
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                        : "border-slate-700 bg-slate-700/20 text-slate-500"
                                    }`}>
                                      {duplicate ? "Duplicate" : `${item.confidence}%`}
                                    </span>
                                    <span className={`rounded border px-1.5 py-0.5 text-[8px] font-mono capitalize ${
                                      reviewStatus === "edited"
                                        ? "border-[#7b9cf5]/30 bg-[#7b9cf5]/10 text-[#9bdaff]"
                                        : reviewStatus === "duplicate"
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                        : "border-[#252a3d] bg-[#10131d] text-slate-500"
                                    }`}>
                                      {reviewStatus}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1">
                                  {qualityLabels.map((label) => (
                                    <span key={`${item.id}-${label.label}`} className={`rounded border px-1.5 py-0.5 text-[8px] font-mono ${getImportQualityClass(label.tone)}`}>
                                      {label.label}
                                    </span>
                                  ))}
                                </div>

                                {duplicate ? (
                                  <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                                    <button
                                      onClick={() => selectPerson(duplicate.id)}
                                      className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-left text-[9px] font-mono text-amber-200 hover:border-amber-400 cursor-pointer"
                                    >
                                      Matches existing: {duplicate.name}
                                    </button>
                                    <button
                                      onClick={() => mergeImportReviewItemIntoDuplicate(item, duplicate.id)}
                                      className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-left text-[9px] font-mono text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                                    >
                                      Admin merge metadata
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-2 space-y-1">
                                    <div className="font-mono text-[8.5px] uppercase tracking-wider text-slate-600">Suggested Links</div>
                                    {linkSuggestions.length > 0 ? linkSuggestions.map((suggestion) => {
                                      const suggestionKey = `${item.id}-${suggestion.person.id}`;
                                      const detailsOpen = openSuggestionDetailKey === suggestionKey;
                                      return (
                                        <div key={suggestionKey} className="rounded border border-[#252a3d] bg-[#0b0d14] px-2 py-1 hover:border-[#7b9cf5]">
                                          <button
                                            onClick={() => {
                                              setHighlightPath([suggestion.person.id]);
                                              selectPerson(suggestion.person.id, { preserveHighlight: true });
                                            }}
                                            className="w-full text-left cursor-pointer"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="truncate text-[9px] font-mono text-slate-300">{suggestion.person.name}</span>
                                              <div className="flex shrink-0 items-center gap-1">
                                                <span className="max-w-28 truncate rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-1.5 py-0.5 text-[8px] font-mono text-[#9bdaff]">
                                                  {suggestion.category}
                                                </span>
                                                <span className={`rounded border px-1.5 py-0.5 text-[8px] font-mono ${
                                                  suggestion.confidence === "strong"
                                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                    : suggestion.confidence === "medium"
                                                    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                                                    : "border-slate-700 bg-slate-700/20 text-slate-500"
                                                }`}>
                                                  {suggestion.confidence} {Math.max(1, Math.round(suggestion.score))}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="truncate text-[8px] font-mono text-slate-600">
                                              {suggestion.confidenceExplanation} - {suggestion.reasons.length > 0 ? suggestion.reasons.join(" / ") : "nearby chronology"}
                                            </div>
                                          </button>
                                          <div className="mt-1 flex items-center justify-between gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setOpenSuggestionDetailKey(detailsOpen ? null : suggestionKey)}
                                              className="rounded border border-[#252a3d] px-1.5 py-0.5 text-[8px] font-mono text-slate-500 hover:text-slate-200 cursor-pointer"
                                            >
                                              Why
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => rejectCandidateLinkSuggestion(candidate.id, suggestion.person.id)}
                                              className="rounded border border-rose-500/20 px-1.5 py-0.5 text-[8px] font-mono text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                                            >
                                              Reject
                                            </button>
                                          </div>
                                          {detailsOpen && (
                                            <div className="mt-1 rounded border border-[#1d2232] bg-[#090a0f] px-2 py-1.5 font-mono text-[8px] text-slate-500">
                                              <div>{suggestion.category} / {suggestion.confidenceExplanation} / score {Math.max(1, Math.round(suggestion.score))}</div>
                                              <div className="mt-1 text-slate-600">{suggestion.reasons.length > 0 ? suggestion.reasons.join(" / ") : "nearby chronology"}</div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }) : (
                                      <EmptyState
                                        title="No Strong Link Suggestions"
                                        detail="Accept the candidate without a link, or edit the draft to add clearer movement, topic, and source context before linking."
                                      />
                                    )}
                                  </div>
                                )}

                                <div className="mt-2 flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => removeImportReviewItem(item.id)}
                                    className="rounded border border-[#252a3d] px-2 py-1 text-[8.5px] font-mono text-slate-500 hover:text-slate-200 cursor-pointer"
                                  >
                                    Skip
                                  </button>
                                  <button
                                    data-testid="edit-import-review-item"
                                    onClick={() => useWikidataCandidate(candidate, item.id)}
                                    className="rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-2 py-1 text-[8.5px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                                  >
                                    Edit Draft
                                  </button>
                                  <button
                                    data-testid="accept-link-import-review-item"
                                    onClick={() => acceptImportReviewItem(item, true)}
                                    disabled={!!duplicate || candidate.birth === null || linkSuggestions.length === 0}
                                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    Accept + Link
                                  </button>
                                  <button
                                    data-testid="accept-import-review-item"
                                    onClick={() => acceptImportReviewItem(item)}
                                    disabled={!!duplicate || candidate.birth === null}
                                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    Accept
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <EmptyState
                            title="Import Queue Empty"
                            detail="Search Wikidata, paste a batch, or create a manual draft. Accepted candidates appear in the atlas and can be linked from the workbench."
                            action={{ label: "Manual Overrides", onClick: () => setWorkbenchTab("manualOverrides") }}
                          />
                        )}
                      </div>

                      {importAuditLog.length > 0 && (
                        <div className="mt-3 rounded-md border border-[#1d2232] bg-[#0b0d14] p-2">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[8.5px] uppercase tracking-wider text-slate-500">Recent Import Audit</span>
                            <button
                              onClick={clearImportAuditLog}
                              className="rounded border border-[#252a3d] px-1.5 py-0.5 text-[8px] font-mono text-slate-500 hover:text-slate-200 cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="max-h-24 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                            {importAuditLog.slice(0, 6).map((entry) => (
                              <div key={entry.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded border border-[#252a3d] bg-[#0e1119] px-2 py-1">
                                <span className={`rounded border px-1.5 py-0.5 text-[8px] font-mono capitalize ${
                                  entry.status === "accepted"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : entry.status === "duplicate"
                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                    : "border-slate-700 bg-slate-700/20 text-slate-500"
                                }`}>
                                  {entry.status}
                                </span>
                                <div className="min-w-0">
                                  <div className="truncate text-[9px] font-mono text-slate-300">{entry.candidateName}</div>
                                  <div className="truncate text-[8px] font-mono text-slate-600">{entry.reason}</div>
                                </div>
                                <span className="font-mono text-[8px] text-slate-600">{entry.confidence}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Source Adapters</span>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">Planned connectors for lower-token expansion.</p>
                      </div>
                      <span className="font-mono text-[9px] text-slate-600">{EXTERNAL_SOURCES.length}</span>
                    </div>
                    <div className="space-y-2">
                      {EXTERNAL_SOURCES.map((source) => (
                        <button key={source.id} onClick={() => setImportDraft((prev) => ({ ...prev, source: source.id }))} className={`w-full rounded-md border p-3 text-left transition-colors cursor-pointer ${importDraft.source === source.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-[#1d2232] bg-[#0e1119] hover:border-[#7b9cf5]"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-serif text-sm font-bold text-slate-100">{source.name}</div>
                            <span className={`font-mono text-[8px] uppercase tracking-wider rounded px-1.5 py-0.5 border ${source.status === "requires-api-key" ? "border-amber-500/30 text-amber-300 bg-amber-500/10" : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"}`}>
                              {source.status === "requires-api-key" ? "API key" : "Open"}
                            </span>
                          </div>
                          <p className="text-[10px] leading-relaxed text-slate-500 mt-1.5">{source.bestFor}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {source.importTargets.map((target) => (
                              <span key={`${source.id}-${target}`} className="font-mono text-[8.5px] rounded border border-[#252a3d] px-1.5 py-0.5 text-slate-500">
                                {target}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {workbenchTab === "exportRecovery" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-md border border-[#252a3d] bg-[#090b10] p-4">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Admin Recovery</div>
                    <h5 className="mt-1 font-serif text-lg font-bold text-slate-100">Export or restore local data</h5>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      JSON restore is a fallback recovery path for moving local operator state between browsers or deployments.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <input
                        ref={jsonImportInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={handleJsonImport}
                      />
                      <button
                        type="button"
                        onClick={exportAtlasJson}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        Export JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => jsonImportInputRef.current?.click()}
                        className="rounded-md border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-3 py-2 text-[10px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                      >
                        Restore JSON
                      </button>
                    </div>
                  </div>

                  <div className="rounded-md border border-[#252a3d] bg-[#090b10] p-4">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Admin Audit Export</div>
                    <h5 className="mt-1 font-serif text-lg font-bold text-slate-100">Export people as CSV</h5>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      CSV remains a lightweight fallback for spreadsheet auditing outside the automated evidence console.
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={exportPeopleCsv}
                        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-mono text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {workbenchTab === "claimConflicts" && (
                <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Duplicate Candidates</span>
                      <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                        Import duplicate metadata merge lives in Manual Overrides so conflict resolution remains explicit.
                      </p>
                    </div>
                    <span className="font-mono text-[9px] text-slate-600">{duplicateCandidates.length}</span>
                  </div>
                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                    {duplicateCandidates.length > 0 ? duplicateCandidates.map((candidate) => (
                      <div key={`${candidate.a.id}-${candidate.b.id}`} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-md border border-[#1d2232] bg-[#0e1119] px-3 py-2">
                        <button onClick={() => selectPerson(candidate.a.id)} className="truncate text-left text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer">{candidate.a.name}</button>
                        <span className="text-[8.5px] text-slate-600 font-mono">vs</span>
                        <button onClick={() => selectPerson(candidate.b.id)} className="truncate text-left text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer">{candidate.b.name}</button>
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-mono text-amber-300">{candidate.score}</span>
                      </div>
                    )) : (
                      <EmptyState
                        title="No Likely Duplicates"
                        detail="The current atlas has no close name/year collisions. Recheck after importing a batch or merging external candidates."
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* 1. COLLAPSIBLE SCHOLAR INDEX SIDEBAR (Left Panel) */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidebarWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ width: sidebarWidth }}
              className="absolute md:relative inset-y-0 left-0 h-full max-w-[calc(100vw-48px)] glass-panel border-r border-[#22273b] flex flex-col shrink-0 overflow-hidden select-none z-40 md:z-auto"
            >
              {/* Drag resizing handle visual anchor bar */}
              <div
                onMouseDown={handleLeftResizeStart}
                className="hidden md:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#7b9cf5]/30 active:bg-[#7b9cf5]/80 transition-colors z-50 select-none"
                title="Drag sideways to resize Thinker Index sidebar"
              />

              <div className="h-10 border-b border-[#22273b] flex items-center justify-between px-4 bg-[#141722]/80 pr-6">
                <span className="font-mono text-[9px] text-[#8c9bbb] uppercase tracking-widest font-bold">Thinkers Index</span>
                <span className="font-mono text-[8.5px] text-slate-500">({processedPeople.length})</span>
              </div>
              <div className="border-b border-[#22273b] bg-[#0d1018] px-3 py-2 pr-5">
                <div className="flex gap-1 overflow-x-auto rounded-md border border-[#22273b] bg-[#080a0f] p-0.5 scrollbar-thin">
                  {(["context", "cluster", "era", "field", "movement", "institution", "review"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setIndexMode(mode)}
                      className={`shrink-0 rounded px-1.5 py-1 text-[8px] font-mono capitalize transition-colors cursor-pointer ${
                        indexMode === mode
                          ? "bg-[#1f2438] text-[#9bdaff] font-bold"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                      title={`Group index by ${mode === "cluster" ? "domain cluster" : mode}`}
                    >
                      {mode === "context" ? "ctx" : mode === "cluster" ? "dom" : mode === "movement" ? "movt" : mode === "institution" ? "inst" : mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin pointer-events-auto bg-[#0a0b10]/40">
                <div className="flex flex-col py-1.5">
                  {indexGroups.map((group) => {
                    const open = indexMode === "context" || expandedIndexGroups.includes(group.title);
                    if (indexMode === "context" && group.list.length === 0) return null;

                    return (
                      <div key={`${indexMode}-${group.title}`} className="border-b border-[#151a28]/80 last:border-b-0">
                        <button
                          onClick={() => toggleIndexGroup(group.title)}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-[9px] font-mono uppercase tracking-wider text-slate-500 hover:text-slate-200 cursor-pointer"
                        >
                          <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
                          <span className="flex-1 truncate">{group.title}</span>
                          <span>{group.list.length}</span>
                        </button>

                        {open && indexMode === "cluster" && (
                          <div className="px-3.5 pb-2 -mt-0.5 flex flex-wrap gap-1">
                            {Array.from(new Set(group.list.map((person) => person.fields?.[0] || "Unclassified")))
                              .slice(0, 5)
                              .map((field) => {
                                const col = FIELD_COLOR[field] || "#94a3b8";
                                const count = group.list.filter((person) => person.fields?.[0] === field).length;
                                return (
                                  <button
                                    key={`${group.title}-${field}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedFields((prev) => prev.includes(field) ? prev : [...prev, field]);
                                      openFilterDrawer();
                                    }}
                                    className="rounded border border-[#252a3d] bg-[#0b0d14] px-1.5 py-0.5 text-[8.5px] font-mono text-slate-500 hover:text-slate-200 hover:border-slate-600 cursor-pointer"
                                    title={`Filter to ${field}`}
                                  >
                                    <span style={{ color: col }}>{field}</span> <span className="text-slate-700">{count}</span>
                                  </button>
                                );
                              })}
                          </div>
                        )}

                        {open && (
                          <div className="pb-1">
                            {group.list.map((p) => {
                              const primaryField = p.fields?.[0] || "Philosophy";
                              const col = FIELD_COLOR[primaryField] || "#94a3b8";
                              const isSelected = p.id === selectedId;
                              const inPath = highlightPath && highlightPath.includes(p.id);
                              const contextText = getIndexContext(p, group.title);
                              const rowEdges = edges.filter((edge) => edge.source === p.id || edge.target === p.id);
                              const sourcedEdgeCount = rowEdges.filter((edge) => edge.sourceClaims && edge.sourceClaims.length > 0).length;
                              const reviewStatus = getReviewStatusForPerson(p);
                              const reviewTone =
                                reviewStatus.includes("Needs") || reviewStatus === "Orphan"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : reviewStatus.includes("Sparse") || reviewStatus.includes("Unlinked")
                                  ? "border-[#7b9cf5]/30 bg-[#7b9cf5]/10 text-[#9bdaff]"
                                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";

                              return (
                                <div
                                  key={`${group.title}-${p.id}`}
                                  className={`group flex items-center border-l-2 transition-all hover:bg-[#1f243b]/44 ${
                                    isSelected
                                      ? "bg-[#1f2438] border-[#7b9cf5] text-white font-semibold"
                                      : inPath
                                      ? "bg-amber-500/10 border-amber-500 text-amber-500"
                                      : "border-transparent text-slate-400 hover:text-white"
                                  }`}
                                >
                                  <button
                                    onClick={() => selectPerson(p.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2 text-left text-[10.5px] cursor-pointer"
                                    title={`Focus ${p.name}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                                    <div className="flex-1 overflow-hidden">
                                      <div className="truncate font-sans font-medium">{p.name}</div>
                                      <div className="text-[8.5px] text-slate-500 font-mono mt-0.5 truncate">
                                        {contextText}
                                      </div>
                                    </div>
                                  </button>
                                  <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
                                    <div className="flex gap-1">
                                      <span className="rounded border border-[#252a3d] bg-[#0b0d14] px-1 py-0.5 text-[7.5px] font-mono text-slate-500">
                                        {rowEdges.length}e
                                      </span>
                                      <span className="rounded border border-[#252a3d] bg-[#0b0d14] px-1 py-0.5 text-[7.5px] font-mono text-slate-500">
                                        {sourcedEdgeCount}s
                                      </span>
                                    </div>
                                    <span className={`max-w-20 truncate rounded border px-1 py-0.5 text-[7px] font-mono ${reviewTone}`}>
                                      {reviewStatus}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-0.5 pr-2 pl-1 opacity-55 transition-opacity group-hover:opacity-100">
                                    {[
                                      { label: "F", title: "Focus", action: () => selectPerson(p.id) },
                                      { label: "C", title: "Connect", action: () => { selectPerson(p.id); openWorkbenchPanel("candidateRelationships"); } },
                                      { label: "T", title: "Edit tags", action: () => { selectPerson(p.id); openWorkbenchPanel("sourceHealth"); } },
                                      { label: "S", title: "Review sources", action: () => { selectPerson(p.id); applyActivity("sources"); } },
                                    ].map((action) => (
                                      <button
                                        key={`${p.id}-${action.title}`}
                                        onClick={action.action}
                                        className="rounded border border-[#252a3d] bg-[#0b0d14] px-1 py-0.5 text-[7.5px] font-mono text-slate-500 hover:border-[#7b9cf5] hover:text-[#9bdaff] cursor-pointer"
                                        title={`${action.title} ${p.name}`}
                                      >
                                        {action.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {processedPeople.length === 0 && (
                    <div className="p-3">
                      <EmptyState
                        title="No Thinkers Match"
                        detail="The current search, saved collection, year range, or facets have narrowed the atlas to zero results."
                        action={{ label: "Clear Filters", onClick: resetFilters }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
 
        {/* 2. DYNAMIC MAIN WORKSPACE AREA */}
        <main className="flex-1 flex flex-col min-h-0 relative bg-[#090b10]">
          
          <div className="flex-1 relative flex flex-col min-h-0">
            {/* TIMELINE MODE */}
            <div className={`flex-1 min-h-0 relative ${viewMode === "timeline" ? "block h-full" : "hidden"}`}>
              <Timeline
                people={processedPeople}
                edges={filteredEdges}
                selectedId={selectedId}
                onSelect={selectPerson}
                highlightPath={highlightPath}
                logScale={logScale}
                onToggleLogScale={() => setLogScale((prev) => !prev)}
                showMov={showMov}
                showEdges={showEdges}
                showWorks={showWorks}
                showLabels={showLabels}
                zoom={zoom}
                setZoom={setZoom}
                searchQuery={searchQuery}
                minYear={minYear}
                maxYear={maxYear}
                timelineBookmarks={timelineBookmarks}
                onSaveTimelineBookmark={saveTimelineBookmark}
                onRemoveTimelineBookmark={removeTimelineBookmark}
                coordinatedNearbyContext={coordinatedLenses}
              />
            </div>
 
            {/* COSMOS NETWORK FORCE MAP MODE */}
            <div className={`flex-1 min-h-0 relative bg-[#090b10] ${viewMode === "network" ? "flex h-full flex-col" : "hidden"}`}>
              <div className="min-h-0 flex-1 p-4">
                <NetworkGraph
                  people={processedPeople}
                  edges={filteredEdges}
                  selectedId={selectedId}
                  onSelect={selectPerson}
                  highlightPath={highlightPath}
                  coordinatedFocusDepth={coordinatedLenses ? 2 : undefined}
                />
              </div>
              {activeWorkspace === "atlas" && (
                <div className={`shrink-0 border-t border-[#22273b] bg-[#080a0f] transition-[height] duration-200 ${timelineStripExpanded ? "h-[320px]" : "h-[132px]"}`}>
                  <div className="flex h-8 items-center justify-between border-b border-[#1b2030] px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Timeline Context</span>
                      {selectedThinker && (
                        <span className="truncate text-[10px] font-mono text-slate-300">
                          {selectedThinker.name} · {formatYear(selectedThinker.birth)} to {formatYear(selectedThinker.death)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setTimelineStripExpanded((prev) => !prev)}
                        className="rounded border border-[#252a3d] bg-[#10131d] px-2 py-1 text-[9px] font-mono text-slate-400 hover:text-slate-100 cursor-pointer"
                        title={timelineStripExpanded ? "Collapse timeline strip" : "Expand timeline strip"}
                      >
                        {timelineStripExpanded ? "Collapse" : "Expand"}
                      </button>
                      <button
                        onClick={() => setViewMode("timeline")}
                        className="rounded border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-2 py-1 text-[9px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                        title="Open full timeline lens"
                      >
                        Full
                      </button>
                    </div>
                  </div>
                  <div className="h-[calc(100%-2rem)] overflow-hidden">
                    <Timeline
                      people={processedPeople}
                      edges={filteredEdges}
                      selectedId={selectedId}
                      onSelect={selectPerson}
                      highlightPath={highlightPath}
                      logScale={logScale}
                      onToggleLogScale={() => setLogScale((prev) => !prev)}
                      showMov={showMov}
                      showEdges={filteredEdges.length <= 180 ? showEdges : false}
                      showWorks={timelineStripExpanded && showWorks}
                      showLabels={timelineStripExpanded && showLabels}
                      zoom={zoom}
                      setZoom={setZoom}
                      searchQuery={searchQuery}
                      minYear={minYear}
                      maxYear={maxYear}
                      timelineBookmarks={timelineBookmarks}
                      onSaveTimelineBookmark={saveTimelineBookmark}
                      onRemoveTimelineBookmark={removeTimelineBookmark}
                      coordinatedNearbyContext={coordinatedLenses}
                    />
                  </div>
                </div>
              )}
            </div>
 
            {/* SPLIT COMBINED VIEW MODE */}
            <div className={`flex-1 min-h-0 divide-y divide-[#22273b] bg-[#090b10] flex flex-col ${viewMode === "split" ? "block h-full" : "hidden"}`}>
              <div style={{ height: `${splitHeightRatio}%` }} className="min-h-[100px] overflow-hidden relative max-md:!h-full">
                <Timeline
                  people={processedPeople}
                  edges={filteredEdges}
                  selectedId={selectedId}
                  onSelect={selectPerson}
                  highlightPath={highlightPath}
                  logScale={logScale}
                  onToggleLogScale={() => setLogScale((prev) => !prev)}
                  showMov={showMov}
                  showEdges={showEdges}
                  showWorks={showWorks}
                  showLabels={showLabels}
                  zoom={zoom}
                  setZoom={setZoom}
                  searchQuery={searchQuery}
                  minYear={minYear}
                  maxYear={maxYear}
                  timelineBookmarks={timelineBookmarks}
                  onSaveTimelineBookmark={saveTimelineBookmark}
                  onRemoveTimelineBookmark={removeTimelineBookmark}
                  coordinatedNearbyContext={coordinatedLenses}
                />
              </div>

              {/* SPLIT VIEW DRAG RESIZER */}
              <div
                onMouseDown={handleSplitResizeStart}
                className="hidden md:block h-[6px] bg-[#141620] border-t border-b border-[#22273b] cursor-row-resize hover:bg-[#7b9cf5]/30 active:bg-[#7b9cf5]/80 transition-all select-none relative z-40 shrink-0"
                title="Drag vertically to adjust split panel height"
              />

              <div style={{ height: `${100 - splitHeightRatio}%` }} className="min-h-[150px] p-3 relative max-md:hidden">
                <NetworkGraph
                  people={processedPeople}
                  edges={filteredEdges}
                  selectedId={selectedId}
                  onSelect={selectPerson}
                  highlightPath={highlightPath}
                  coordinatedFocusDepth={coordinatedLenses ? 2 : undefined}
                />
              </div>
            </div>
          </div>
 
          {/* Floaters overlays (Path finder) */}
          <PathFinder
            people={people}
            edges={edges}
            selectedId={selectedId}
            onFindPath={setHighlightPath}
            onSelect={(id) => selectPerson(id, { preserveHighlight: true })}
            isOpen={pathFinderOpen}
            onToggle={togglePathFinder}
            highlightPath={highlightPath}
          />
        </main>
 
        {/* 3. SLIDING RIGHT DRAWER FOR CHOSEN THINKER DETAIL INSPECTION */}
        <AnimatePresence>
          {selectedId && (
            <motion.div
              initial={{ x: "100%", opacity: 0.95 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.95 }}
              transition={{ type: "spring", damping: 24, stPercentage: 0.4 }}
              style={{ width: detailWidth }}
              className="absolute md:relative top-0 right-0 h-full shrink-0 border-l border-[#22273b] glass-panel-heavy flex flex-col z-30 shadow-2xl overflow-hidden max-md:top-auto max-md:bottom-0 max-md:!h-[72%] max-md:!w-full max-md:border-l-0 max-md:border-t"
            >
              {/* Drag resizing handle visual anchor bar */}
              <div
                onMouseDown={handleRightResizeStart}
                className="hidden md:block absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[#7b9cf5]/30 active:bg-[#7b9cf5]/80 transition-colors z-50 select-none"
                title="Drag sideways to resize Scholar Dossier drawer"
              />

              {/* Header inside Detail drawer */}
              <div className="shrink-0 px-5 py-3 border-b border-[#22273b] bg-[#141722] flex justify-between items-center pl-6">
                <span className="font-mono text-[9px] text-[#8c9bbb] uppercase tracking-widest font-bold">SCHOLAR DOSSIER</span>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setHighlightPath(null);
                    setOverlapContemps([]);
                    setBfsMapNodes([]);
                  }}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                  title="Close dossier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Detail component scroll block */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <DetailPanel
                  selectedId={selectedId}
                  onSelect={selectPerson}
                  people={people}
                  edges={filteredEdges}
                  onFindContemporaries={handleFindContemporaries}
                  onShowBFS={handleShowBFS}
                  onOpenSourceStudio={(id) => {
                    selectPerson(id);
                    openWorkbenchPanel("candidateRelationships");
                  }}
                  onContinueThread={continueThreadFromPerson}
                />
              </div>

              {/* Downstream Successors & Contemporaries overlaps map overlays */}
              {(overlapContemps.length > 0 || bfsMapNodes.length > 0) && (
                <div className="absolute inset-0 bg-[#0d0e15]/95 border-l border-[#22273b] p-6 overflow-y-auto z-10">
                  <div className="flex justify-between items-center mb-5">
                    <h4 className="font-serif text-[13px] font-bold text-amber-500 tracking-wide uppercase">
                      {overlapContemps.length > 0 ? "Chronological Overlaps" : "Downstream Successors"}
                    </h4>
                    <button
                      onClick={() => {
                        setOverlapContemps([]);
                        setBfsMapNodes([]);
                      }}
                      className="text-amber-500 hover:text-amber-400 text-[10px] font-mono cursor-pointer border border-[#c27829]/30 bg-[#c27829]/10 px-2 py-0.5 rounded transition-all"
                    >
                      &larr; Dossier
                    </button>
                  </div>

                  {overlapContemps.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                        Other scholars sharing more than 20 years overlapping lifetime lifespan on the historical timeline:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {overlapContemps.map((p) => {
                          const primaryField = p.fields?.[0] || "Philosophy";
                          const col = FIELD_COLOR[primaryField] || "#94a3b8";
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                selectPerson(p.id);
                                setOverlapContemps([]);
                              }}
                              className="p-3 border border-[#22273b] hover:border-[#7b9cf5] bg-[#141722]/80 rounded-md cursor-pointer transition-all flex flex-col justify-between"
                            >
                              <span className="font-serif font-bold text-xs" style={{ color: col }}>
                                {p.name}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500 mt-1.5 block">
                                Lifespan: {p.birth < 0 ? `${Math.abs(p.birth)} BCE` : p.birth} &ndash; {p.death ?? "present"} · {p.region}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {bfsMapNodes.length > 0 && (
                    <div className="space-y-5 font-mono">
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Tracing downstream successor descendants by generational bounds path limits:
                      </p>
                      <div className="space-y-5">
                        {bfsMapNodes.map((layer) => (
                          <div key={layer.depth} className="space-y-2 border-l border-slate-700 pl-3">
                            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                              Downstream Generation {layer.depth}:
                            </div>
                            {layer.nodes.length === 0 ? (
                              <div className="text-[10px] text-slate-600 italic">No mapped successors discovered at this depth.</div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {layer.nodes.map((p) => {
                                  const primaryField = p.fields?.[0] || "Philosophy";
                                  const col = FIELD_COLOR[primaryField] || "#94a3b8";
                                  return (
                                    <button
                                      key={p.id}
                                      onClick={() => {
                                        selectPerson(p.id);
                                        setBfsMapNodes([]);
                                      }}
                                      className="px-2.5 py-1 bg-[#1a1c29] hover:bg-[#22273b] border border-[#22273b] hover:border-[#7b9cf5] text-[10px] text-slate-200 rounded-md flex items-center gap-1.5 cursor-pointer transition-all"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} />
                                      {p.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MODALS ── */}
      <nav className="md:hidden shrink-0 h-14 grid grid-cols-3 border-t border-[#22273b] bg-[#0f111a] z-40">
        {workspaceOptions.map((workspace) => {
          const Icon = workspace.icon;
          const isActive = activeWorkspace === workspace.id;

          return (
            <button
              key={`mobile-${workspace.id}`}
              onClick={() => applyWorkspace(workspace.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-mono transition-colors cursor-pointer ${
                isActive ? "text-[#9bdaff] bg-[#1f2438]" : "text-slate-500 hover:text-slate-200"
              }`}
              title={`${workspace.label} workspace`}
            >
              <Icon className="w-4 h-4" />
              <span>{workspace.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <AddThinkerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddThinker}
      />
    </div>
  );
}
