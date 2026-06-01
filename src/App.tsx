import React, { useState, useEffect, useRef } from "react";
import { Thinker, InfluenceEdge } from "./types";
import {
  INITIAL_PEOPLE_DATA,
  INITIAL_EDGES_DATA,
  FIELD_COLOR,
  ERA_BANDS,
} from "./data";
import Timeline from "./components/Timeline";
import NetworkGraph from "./components/NetworkGraph";
import DetailPanel from "./components/DetailPanel";
import AddThinkerModal from "./components/AddThinkerModal";
import PathFinder from "./components/PathFinder";
import { TAXONOMY_DOMAINS, CONTROLLED_TOPICS, ATLAS_LENSES, inferLensTags, getLensOptionLabel, getTopicGroupsForField, getDomainForField } from "./taxonomy";
import { EXTERNAL_SOURCES } from "./externalSources";
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
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type WikidataCandidate = {
  id: string;
  name: string;
  description: string;
  birth: number | null;
  death: number | null;
  aliases?: string[];
  fields?: string[];
  topics?: string[];
  region?: string | null;
  era?: string | null;
  movement?: string | null;
  works?: string[];
  sourceUrl: string;
  wikipediaUrl: string | null;
};

type ImportReviewStatus = "queued" | "edited" | "accepted" | "skipped" | "duplicate";

type ImportReviewItem = {
  id: string;
  candidate: WikidataCandidate;
  confidence: number;
  duplicateId: string | null;
  status: ImportReviewStatus;
};

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

export default function App() {
  const [people, setPeople] = useState<Thinker[]>([]);
  const [edges, setEdges] = useState<InfluenceEdge[]>([]);
  const csvImportInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  // Layout Controls
  const [viewMode, setViewMode] = useState<"timeline" | "network" | "split">("split");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [extensionWorkbenchOpen, setExtensionWorkbenchOpen] = useState(false);

  // Panel Resizer states
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [detailWidth, setDetailWidth] = useState(380);
  const [splitHeightRatio, setSplitHeightRatio] = useState(50);

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
  const [indexMode, setIndexMode] = useState<"context" | "cluster" | "era" | "field">("context");
  const [expandedIndexGroups, setExpandedIndexGroups] = useState<string[]>([
    "Selected",
    "Connected",
    "Likely Links",
    "Current Matches",
    "Natural Inquiry",
    "Human Systems",
  ]);
  const [workbenchTab, setWorkbenchTab] = useState<"links" | "tags" | "imports" | "duplicates">("links");
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
  const [importConfidenceThreshold, setImportConfidenceThreshold] = useState(() => {
    const savedThreshold = localStorage.getItem("atlas_import_confidence_threshold_v1");
    const parsedThreshold = savedThreshold ? Number(savedThreshold) : 80;
    return Number.isFinite(parsedThreshold) ? Math.max(0, Math.min(100, parsedThreshold)) : 80;
  });
  const [wikidataLoading, setWikidataLoading] = useState(false);

  const [sortMode, setSortMode] = useState<"birth" | "field" | "bridge" | "name">("birth");
  const [searchQuery, setSearchQuery] = useState("");

  // Layer toggles
  const [showMov, setShowMov] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showWorks, setShowWorks] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [logScale, setLogScale] = useState(true);
  const [zoom, setZoom] = useState(1.4);

  // Overlays
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pathFinderOpen, setPathFinderOpen] = useState(false);
  const [highlightPath, setHighlightPath] = useState<string[] | null>(null);

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
    const savedPeople = localStorage.getItem("atlas_people_v6");
    const savedEdges = localStorage.getItem("atlas_edges_v6");
    const savedImportQueue = localStorage.getItem("atlas_import_queue_v1");
    const savedImportAuditLog = localStorage.getItem("atlas_import_audit_log_v1");

    if (savedPeople && savedEdges) {
      try {
        const parsedPeople = JSON.parse(savedPeople);
        const parsedEdges = JSON.parse(savedEdges);
        if (Array.isArray(parsedPeople) && Array.isArray(parsedEdges)) {
          setPeople(parsedPeople.filter(Boolean));
          setEdges(parsedEdges.filter(Boolean));
        } else {
          setPeople(INITIAL_PEOPLE_DATA);
          setEdges(INITIAL_EDGES_DATA);
        }
      } catch (e) {
        setPeople(INITIAL_PEOPLE_DATA);
        setEdges(INITIAL_EDGES_DATA);
      }
    } else {
      setPeople(INITIAL_PEOPLE_DATA);
      setEdges(INITIAL_EDGES_DATA);
      localStorage.setItem("atlas_people_v6", JSON.stringify(INITIAL_PEOPLE_DATA));
      localStorage.setItem("atlas_edges_v6", JSON.stringify(INITIAL_EDGES_DATA));
    }

    if (savedImportQueue) {
      try {
        const parsedImportQueue = JSON.parse(savedImportQueue);
        if (Array.isArray(parsedImportQueue)) {
          const normalizedQueue = parsedImportQueue
            .filter(Boolean)
            .map((item) => ({
              ...item,
              status: item.status || (item.duplicateId ? "duplicate" : "queued"),
            }))
            .filter((item) => item.candidate && item.id) as ImportReviewItem[];
          setImportReviewQueue(normalizedQueue);
          localStorage.setItem("atlas_import_queue_v1", JSON.stringify(normalizedQueue));
        }
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

  // Database additions
  const handleAddThinker = (newThinker: Thinker) => {
    const updated = [...people, newThinker];
    setPeople(updated);
    setOverlapContemps([]);
    setBfsMapNodes([]);
    localStorage.setItem("atlas_people_v6", JSON.stringify(updated));
    setSelectedId(newThinker.id);
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
      localStorage.setItem("atlas_people_v6", JSON.stringify(INITIAL_PEOPLE_DATA));
      localStorage.setItem("atlas_edges_v6", JSON.stringify(INITIAL_EDGES_DATA));
      localStorage.removeItem("atlas_import_queue_v1");
      localStorage.removeItem("atlas_import_audit_log_v1");
      setImportReviewQueue([]);
      setImportAuditLog([]);
    }
  };

  const selectPerson = (id: string) => {
    setSelectedId(id);
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

  const disciplineGroups = TAXONOMY_DOMAINS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => allFields.includes(field)),
  }));

  const groupedFields = new Set(disciplineGroups.flatMap((group) => group.fields));
  const ungroupedFields = allFields.filter((field) => !groupedFields.has(field));
  if (ungroupedFields.length > 0) {
    disciplineGroups.push({ name: "Other Domains", fields: ungroupedFields });
  }

  const subfieldsByField = Object.fromEntries(
    allFields.map((field) => [
      field,
      Array.from(new Set([...(CONTROLLED_TOPICS[field] || []), ...people
        .filter((person) => person.fields?.includes(field))
        .flatMap((person) => person.subfields || [])])).sort(),
    ])
  ) as Record<string, string[]>;
  const topicGroupsByField = Object.fromEntries(
    allFields.map((field) => [field, getTopicGroupsForField(field, subfieldsByField[field] || [])])
  );

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

    // 4. Raw text criteria search matching
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q)) ||
          p.fields?.some((f) => f.toLowerCase().includes(q)) ||
          p.subfields?.some((sf) => sf.toLowerCase().includes(q)) ||
          (p.region && p.region.toLowerCase().includes(q)) ||
          p.works?.some((w) => w.toLowerCase().includes(q))
      );
    }

    // Sorting logic
    const sorters = {
      birth: (a: Thinker, b: Thinker) => a.birth - b.birth,
      field: (a: Thinker, b: Thinker) => (a.fields?.[0] || "").localeCompare(b.fields?.[0] || "") || a.birth - b.birth,
      bridge: (a: Thinker, b: Thinker) => (b.bridge_score ?? 1) - (a.bridge_score ?? 1),
      name: (a: Thinker, b: Thinker) => a.name.localeCompare(b.name),
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

    const nextEdges: InfluenceEdge[] = [
      ...edges,
      {
        source: source.id,
        target: target.id,
        type: "Suggested relationship",
        strength: 2,
        confidence: 0.35,
        note: reason || "Added from Workbench candidate review.",
      },
    ];

    setEdges(nextEdges);
    localStorage.setItem("atlas_edges_v6", JSON.stringify(nextEdges));
    setHighlightPath([source.id, target.id]);
    setSelectedId(target.id);
    setViewMode("split");
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
      setSelectedId(target.id);
      return;
    }

    const nextEdges: InfluenceEdge[] = [
      ...edges,
      {
        source: sourceId,
        target: targetId,
        type: relationshipDraft.type.trim() || "Influence",
        strength: relationshipDraft.strength,
        confidence: relationshipDraft.confidence,
        note: relationshipDraft.note.trim() || null,
      },
    ];

    setEdges(nextEdges);
    localStorage.setItem("atlas_edges_v6", JSON.stringify(nextEdges));
    setHighlightPath([sourceId, targetId]);
    setSelectedId(target.id);
    setRelationshipDraft((prev) => ({ ...prev, targetName: "", note: "" }));
    setViewMode("split");
  };

  const updateThinkerTopics = (id: string, topics: string[]) => {
    const normalizedTopics = Array.from(new Set(topics.map((topic) => topic.trim()).filter(Boolean)));
    const nextPeople = people.map((person) =>
      person.id === id ? { ...person, subfields: normalizedTopics } : person
    );
    setPeople(nextPeople);
    localStorage.setItem("atlas_people_v6", JSON.stringify(nextPeople));
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
    setWorkbenchTab("links");
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

  const normalizeName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tokenizeEvidenceText = (value: string) =>
    Array.from(new Set(value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 4)
      .filter((token) => !["philosopher", "mathematician", "scientist", "writer", "known", "notable", "theory", "school"].includes(token))
    ));

  const getTextOverlap = (candidate: WikidataCandidate, person: Thinker) => {
    const candidateTokens = tokenizeEvidenceText([
      candidate.description,
      candidate.movement || "",
      ...(candidate.works || []),
      ...(candidate.topics || []),
    ].join(" "));
    const personTokens = new Set(tokenizeEvidenceText([
      person.notes || "",
      person.movement || "",
      ...(person.works || []),
      ...(person.subfields || []),
    ].join(" ")));

    return candidateTokens.filter((token) => personTokens.has(token)).slice(0, 4);
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

  const getNameVariants = (name: string) =>
    Array.from(new Set([
      name,
      name.replace(/\([^)]*\)/g, " "),
      ...Array.from(name.matchAll(/\(([^)]*)\)/g)).map((match) => match[1]),
    ].map(normalizeName).filter(Boolean)));

  const yearsAreClose = (left: number | null, right: number | null, tolerance = 2) =>
    left !== null && right !== null && Math.abs(left - right) <= tolerance;

  const getDuplicateIdForCandidate = (candidate: WikidataCandidate) => {
    const candidateNames = new Set([
      ...getNameVariants(candidate.name),
      ...(candidate.aliases || []).flatMap(getNameVariants),
    ]);
    const candidateSourceUrls = [candidate.sourceUrl, candidate.wikipediaUrl].filter(Boolean) as string[];
    const candidateWorks = new Set((candidate.works || []).map(normalizeName).filter(Boolean));

    return people.find((person) => {
      const personNames = getNameVariants(person.name);
      const nameMatches = personNames.some((name) => candidateNames.has(name));
      if (nameMatches) return true;

      const notes = person.notes || "";
      if (candidateSourceUrls.some((url) => notes.includes(url))) return true;

      const sameBirth = yearsAreClose(candidate.birth, person.birth);
      const sameDeath = yearsAreClose(candidate.death, person.death);
      const sharedWorks = (person.works || []).filter((work) => candidateWorks.has(normalizeName(work))).length;
      return sameBirth && (sameDeath || sharedWorks > 0);
    })?.id || null;
  };

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
    const candidateLens = Object.values(inferLensTags(draft)).flat();

    return people
      .map((person) => {
        const personLens = Object.values(inferLensTags(person)).flat();
        const sharedFields = person.fields.filter((field) => draft.fields.includes(field));
        const sharedTopics = (person.subfields || []).filter((topic) => draft.subfields?.includes(topic));
        const sharedLensTags = personLens.filter((tag) => candidateLens.includes(tag));
        const sharedWorks = (person.works || []).filter((work) =>
          (candidate.works || []).some((candidateWork) => normalizeName(candidateWork) === normalizeName(work))
        );
        const textOverlap = getTextOverlap(candidate, person);
        const timeGap = candidate.birth === null
          ? 300
          : Math.min(
              Math.abs(person.birth - (candidate.death ?? candidate.birth)),
              Math.abs(candidate.birth - (person.death ?? person.birth))
            );
        const chronologicalDirection = candidate.birth !== null
          ? person.birth <= candidate.birth ? "candidate may inherit from this node" : "candidate may precede this node"
          : "";
        const chronologyScore = candidate.birth === null
          ? 0
          : timeGap <= 60
          ? 3
          : timeGap <= 150
          ? 2
          : timeGap <= 300
          ? 1
          : -2;
        const movementBonus = candidate.movement && person.movement === candidate.movement ? 4 : 0;
        const eraBonus = candidate.era && person.era === candidate.era ? 2 : 0;
        const regionBonus = candidate.region && person.region === candidate.region ? 1.5 : 0;
        const workBonus = sharedWorks.length * 5;
        const textBonus = Math.min(textOverlap.length, 3) * 1.5;
        const score =
          sharedFields.length * 4 +
          sharedTopics.length * 3 +
          sharedLensTags.length * 2 +
          movementBonus +
          eraBonus +
          regionBonus +
          workBonus +
          textBonus +
          chronologyScore;
        const reasons = [
          ...sharedFields.slice(0, 2).map((field) => `field: ${field}`),
          ...sharedTopics.slice(0, 2).map((topic) => `topic: ${topic}`),
          ...sharedLensTags.slice(0, 2).map((tag) => `lens: ${getLensOptionLabel(tag)}`),
          ...sharedWorks.slice(0, 1).map((work) => `work: ${work}`),
          ...textOverlap.slice(0, 2).map((token) => `source term: ${token}`),
          movementBonus > 0 ? `movement: ${candidate.movement}` : "",
          eraBonus > 0 ? `era: ${candidate.era}` : "",
          regionBonus > 0 ? `region: ${candidate.region}` : "",
          chronologyScore > 0 ? `chronology: ${chronologicalDirection}` : "",
        ].filter(Boolean) as string[];
        const confidence = score >= 12 ? "strong" : score >= 7 ? "medium" : "weak";
        return { person, score, reasons, confidence };
      })
      .filter((item) => item.score >= 4)
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
      localStorage.setItem("atlas_import_queue_v1", JSON.stringify(next));
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
      localStorage.setItem("atlas_import_queue_v1", JSON.stringify(next));
      return next;
    });
    if (draftQueueItemId === id) setDraftQueueItemId(null);
  };

  const getCandidateConfidence = (query: string, candidate: WikidataCandidate | null) => {
    if (!candidate) return 0;
    let score = 0;
    if (normalizeName(query) === normalizeName(candidate.name)) score += 55;
    if (candidate.birth !== null) score += 15;
    if (candidate.description) score += 10;
    if ((candidate.fields || []).length > 0) score += 8;
    if ((candidate.topics || []).length > 0) score += 6;
    if (candidate.wikipediaUrl) score += 6;
    return Math.min(100, score);
  };

  const getImportQualityLabels = (candidate: WikidataCandidate, confidence: number): ImportQualityLabel[] => {
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
          type: "Suggested relationship",
          strength: 2,
          confidence: 0.35,
          note: `Imported with suggested context: ${topSuggestion.reasons.join(", ") || "nearby chronology"}`,
          sourceClaims: [getCandidateSourceUrl(candidate)].filter(Boolean),
        },
      ];
      setEdges(nextEdges);
      localStorage.setItem("atlas_edges_v6", JSON.stringify(nextEdges));
      setHighlightPath([source.id, target.id]);
    }

    setPeople(nextPeople);
    localStorage.setItem("atlas_people_v6", JSON.stringify(nextPeople));
    setSelectedId(newId);
    setViewMode("split");
    removeImportReviewItem(item.id, "accepted", linkTopSuggestion ? "Accepted with top suggested link" : "Accepted from review queue");
    setWorkbenchTab("links");
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
    localStorage.setItem("atlas_import_queue_v1", JSON.stringify(nextQueue));
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
    localStorage.setItem("atlas_people_v6", JSON.stringify(updatedPeople));
    logImportReviewItems([item], "accepted", `Merged duplicate metadata into ${people.find((person) => person.id === duplicateId)?.name || "existing thinker"}`);
    persistImportReviewQueue(importReviewQueue.filter((queueItem) => queueItem.id !== item.id));
    selectPerson(duplicateId);
    setViewMode("split");
    setWorkbenchTab("links");
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
          type: "Suggested relationship",
          strength: 2,
          confidence: 0.35,
          note: `Imported with suggested context: ${topSuggestion.reasons.join(", ") || "nearby chronology"}`,
          sourceClaims: [getCandidateSourceUrl(candidate)].filter(Boolean),
        });
        lastHighlightPath = [source.id, target.id];
      }
    });

    if (acceptedItemIds.size === 0) return;

    setPeople(nextPeople);
    localStorage.setItem("atlas_people_v6", JSON.stringify(nextPeople));
    setEdges(nextEdges);
    localStorage.setItem("atlas_edges_v6", JSON.stringify(nextEdges));
    logImportReviewItems(
      importReviewQueue.filter((item) => acceptedItemIds.has(item.id)),
      "accepted",
      linkTopSuggestion ? "Bulk accepted with top suggested link" : "Bulk accepted from review queue"
    );
    persistImportReviewQueue(importReviewQueue.filter((item) => !acceptedItemIds.has(item.id)));
    if (lastAcceptedId) {
      setSelectedId(lastAcceptedId);
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
      people,
      edges,
      importReviewQueue,
      importAuditLog,
      importConfidenceThreshold,
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
    if (!Array.isArray(parsed.people) || !Array.isArray(parsed.edges)) return;
    const nextPeople = parsed.people.filter(Boolean);
    const nextEdges = parsed.edges.filter(Boolean);
    const nextQueue = Array.isArray(parsed.importReviewQueue) ? parsed.importReviewQueue.filter(Boolean) : [];
    const nextAuditLog = Array.isArray(parsed.importAuditLog) ? parsed.importAuditLog.filter(Boolean).slice(0, 100) : [];
    const nextThreshold = Number.isFinite(Number(parsed.importConfidenceThreshold))
      ? Math.max(0, Math.min(100, Number(parsed.importConfidenceThreshold)))
      : importConfidenceThreshold;

    setPeople(nextPeople);
    setEdges(nextEdges);
    setImportReviewQueue(nextQueue);
    setImportAuditLog(nextAuditLog);
    setImportConfidenceThreshold(nextThreshold);
    localStorage.setItem("atlas_people_v6", JSON.stringify(nextPeople));
    localStorage.setItem("atlas_edges_v6", JSON.stringify(nextEdges));
    localStorage.setItem("atlas_import_queue_v1", JSON.stringify(nextQueue));
    localStorage.setItem("atlas_import_audit_log_v1", JSON.stringify(nextAuditLog));
    localStorage.setItem("atlas_import_confidence_threshold_v1", String(nextThreshold));
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

  const hasActiveFilters = selectedFields.length > 0 || selectedSubfields.length > 0 || selectedLensTags.length > 0 || selectedEras.length > 0 || selectedRegions.length > 0 || minYear !== -650 || maxYear !== 2030;
  const activeFiltersCount = selectedFields.length + selectedSubfields.length + selectedLensTags.length + selectedEras.length + selectedRegions.length + (minYear !== -650 || maxYear !== 2030 ? 1 : 0);
  const selectedThinker = selectedId ? people.find((p) => p.id === selectedId) : null;
  const selectedIncomingCount = selectedId ? edges.filter((e) => e.target === selectedId).length : 0;
  const selectedOutgoingCount = selectedId ? edges.filter((e) => e.source === selectedId).length : 0;
  const formatYear = (year: number | null) => {
    if (year === null) return "present";
    return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
  };
  const selectedLensLabels = selectedThinker
    ? Array.from(new Set(Object.values(inferLensTags(selectedThinker)).flat())).map(getLensOptionLabel).slice(0, 8)
    : [];
  const selectedNearestRelations = selectedId
    ? edges
        .filter((edge) => edge.source === selectedId || edge.target === selectedId)
        .slice(0, 6)
        .map((edge) => {
          const otherId = edge.source === selectedId ? edge.target : edge.source;
          const other = people.find((person) => person.id === otherId);
          return { edge, other, direction: edge.source === selectedId ? "out" : "in" };
        })
        .filter((item) => item.other)
    : [];
  const unlinkedThinkers = people
    .filter((p) => !edges.some((e) => e.source === p.id || e.target === p.id))
    .slice(0, 20);
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

  const contextIndexGroups = [
    selectedThinker ? { title: "Selected", list: [selectedThinker] } : null,
    { title: "Connected", list: connectedIndexPeople },
    { title: "Likely Links", list: likelyIndexPeople },
    { title: "Current Matches", list: currentMatchPeople },
  ].filter(Boolean) as { title: string; list: Thinker[] }[];

  const indexGroups =
    indexMode === "context"
      ? contextIndexGroups
      : indexMode === "cluster"
      ? groupPeopleBy(processedPeople, (person) => getDomainForField(person.fields?.[0] || ""))
      : indexMode === "era"
      ? groupPeopleBy(processedPeople, (person) => person.era || "Unclassified")
      : groupPeopleBy(processedPeople, (person) => person.fields?.[0] || "Unclassified");

  const getIndexContext = (person: Thinker, groupTitle: string) => {
    if (groupTitle === "Selected") {
      return `${formatYear(person.birth)} · current focus`;
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0b10] text-[#dde3f0] font-sans antialiased selection:bg-[#7b9cf5]/30">
      
      {/* ── CENTRALized HEADER BAR ── */}
      <header className="flex h-14 shrink-0 items-center justify-between px-6 bg-[#0f111a] border-b border-[#22273b] z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-serif text-xl font-semibold italic">◈</span>
            <div className="font-serif text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              Intellectual <span className="italic text-amber-400 font-normal">History</span>
              <span className="text-[10px] uppercase font-mono tracking-wider border border-slate-800 bg-[#161926] text-[#8c9bbb] rounded px-1.5 py-0.5 ml-2.5">Atlas</span>
            </div>
          </div>
          
          {/* Quick Global Counters */}
          <div className="hidden xl:flex items-center gap-2 text-[#465175] text-[10px] font-mono select-none">
            <span className="border-r border-[#22273b] pr-2.5">Thinkers: <b className="text-slate-300 font-bold">{people.length}</b></span>
            <span className="border-r border-[#22273b] pr-2.5">Lines: <b className="text-violet-400 font-bold">{edges.length}</b></span>
            <span>Matches: <b className="text-amber-500 font-bold">{processedPeople.length}</b></span>
          </div>
        </div>

        {/* Dynamic Mode Switcher inside Header (Centered & Spaced) */}
        <div className="flex items-center bg-[#07080d] p-0.5 border border-[#22273b] rounded-lg">
          <button
            onClick={() => setViewMode("split")}
            className={`px-3.5 py-1 text-[11px] font-mono tracking-wide rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "split"
                ? "bg-[#1f2438] text-[#9bdaff] font-bold shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Explore</span>
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-3.5 py-1 text-[11px] font-mono tracking-wide rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "timeline"
                ? "bg-[#1f2438] text-[#9bdaff] font-bold shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Timeline</span>
          </button>
          <button
            onClick={() => setViewMode("network")}
            className={`px-3.5 py-1 text-[11px] font-mono tracking-wide rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "network"
                ? "bg-[#1f2438] text-[#9bdaff] font-bold shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-3">
          
          {/* Scriptor Add Button */}
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7b9cf5]/10 border border-[#7b9cf5]/30 text-[#7b9cf5] hover:bg-[#7b9cf5]/20 rounded-md text-xs font-mono transition-all cursor-pointer font-medium"
            title="Add a thinker"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Add Thinker</span>
          </button>

          <button
            onClick={() => setExtensionWorkbenchOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-mono transition-all cursor-pointer ${
              extensionWorkbenchOpen
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-300 font-medium"
                : "border-[#22273b] bg-[#141724]/40 text-slate-400 hover:text-slate-100"
            }`}
            title="Review sparse nodes and taxonomy gaps"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Workbench</span>
          </button>

          {/* Pathways Trigger */}
          <button
            onClick={() => setPathFinderOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-mono transition-all cursor-pointer ${
              pathFinderOpen
                ? "bg-amber-500/10 border-amber-500 text-amber-400 font-medium"
                : "border-[#22273b] bg-[#141724]/40 text-slate-400 hover:text-slate-100"
            }`}
            title="Find a relationship path between two thinkers"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Find Path</span>
          </button>

          {/* Clean Reset Database Button */}
          <button
            onClick={handleResetDatabase}
            className="p-1.5 border border-[#22273b] bg-[#141724]/40 text-slate-500 hover:text-slate-200 hover:border-slate-700 rounded-md transition-all cursor-pointer"
            title="Reset Atlas database to original canon defaults"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── MINIMAL CONTROLS & SEARCH BAR sub-header ── */}
      <div className="flex shrink-0 h-12 items-center justify-between px-6 bg-[#131622] border-b border-[#22273b] z-30">
        
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
              onClick={() => setPathFinderOpen(true)}
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
          {/* Quick Active filter indications */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => {
                  setSelectedFields([]);
                  setSelectedSubfields([]);
                  setSelectedLensTags([]);
                  setSelectedEras([]);
                  setSelectedRegions([]);
                  setMinYear(-650);
                  setMaxYear(2030);
                }}
                className="text-amber-500 hover:text-amber-400 text-[10px] font-mono uppercase tracking-wider cursor-pointer border border-[#c27829]/40 bg-[#c27829]/10 px-2 py-0.5 rounded transition-all flex items-center gap-1"
              >
                <span>Clear Filters</span>
                <span className="w-4 h-4 flex items-center justify-center bg-amber-500/20 text-amber-300 rounded-full text-[8.5px] font-bold font-sans">
                  {activeFiltersCount}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={() => setFilterDrawerOpen((prev) => !prev)}
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

      {/* ── COLLAPSIBLE SLIDE-DOWN DRAWER FOR ADVANCED SEARCH FILTERS ── */}
      <div className="shrink-0 min-h-11 px-6 py-1.5 bg-[#0d1018] border-b border-[#22273b] z-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden md:inline font-mono text-[9px] uppercase tracking-wider text-[#5a6480] shrink-0">Explore</span>
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
            onClick={() => setPathFinderOpen(true)}
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
        </div>

        <div className="hidden xl:flex items-center gap-2 min-w-0 text-[10px] font-mono text-slate-500">
          <span className="uppercase tracking-wider text-[#5a6480] shrink-0">Relationship tools</span>
          <span className="text-slate-600">Use the current focus to trace, bridge, or compare context.</span>
        </div>
      </div>

      {selectedThinker && (
        <div className="shrink-0 px-6 py-3 bg-[#10131d] border-b border-[#22273b] z-20">
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

          <div className="mt-3 grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-2 items-center">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#5a6480]">Connection Radar</span>
              <button
                onClick={() => {
                  setExtensionWorkbenchOpen(true);
                  setWorkbenchTab("links");
                }}
                className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-mono text-emerald-200 hover:border-emerald-300 cursor-pointer"
              >
                Review Queue
              </button>
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
                            selectPerson(person.id);
                          }}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <div className="truncate text-[10.5px] font-semibold text-slate-200">{person.name}</div>
                          <div className="truncate text-[9px] font-mono text-slate-500">
                            {formatYear(person.birth)} · {getSuggestedLinkReason(candidate)}
                          </div>
                        </button>
                        <button
                          onClick={() => addSuggestedRelationship(selectedThinker, person, `Shared context: ${getSuggestedLinkReason(candidate)}`)}
                          className="rounded border border-[#7b9cf5]/40 bg-[#7b9cf5]/10 px-2 py-1 text-[9px] font-mono text-[#9bdaff] hover:border-[#9bdaff] cursor-pointer"
                          title="Add a low-confidence suggested relationship"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-md border border-[#252a3d] bg-[#0b0d14] px-3 py-2 text-[10px] font-mono text-slate-600">
                  No high-signal link suggestions for this focus yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {filterDrawerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="shrink-0 glass-panel border-b border-[#22273b] overflow-hidden z-20 shadow-xl shadow-black/40"
          >
            <div className="p-6 space-y-5 select-none text-xs">
              
              {/* Row 1: Epoch Limits & Timeline Sliders */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start pb-4 border-b border-[#22273b]/60">
                {/* Epoch Shortcuts Selector */}
                <div className="xl:col-span-5 space-y-2">
                  <h4 className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider flex items-center gap-1.5 font-bold mb-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-500/80" />
                    <span>Era Shortcuts</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => applyEpochSnap(-650, 2030)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition-all cursor-pointer"
                    >
                      All Time (-650 to 2030)
                    </button>
                    <button
                      onClick={() => applyEpochSnap(-650, 500)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition-all cursor-pointer"
                    >
                      Antiquity (-650 to 500)
                    </button>
                    <button
                      onClick={() => applyEpochSnap(500, 1500)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition-all cursor-pointer"
                    >
                      Medieval (500 to 1500)
                    </button>
                    <button
                      onClick={() => applyEpochSnap(1500, 1789)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition-all cursor-pointer"
                    >
                      Early Modern (1500 to 1789)
                    </button>
                    <button
                      onClick={() => applyEpochSnap(1789, 1945)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition-all cursor-pointer"
                    >
                      Industrial Era (1789 to 1945)
                    </button>
                    <button
                      onClick={() => applyEpochSnap(1945, 2030)}
                      className="px-2.5 py-1 rounded text-[10px] font-mono border border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-700/60 transition-all cursor-pointer"
                    >
                      Contemporary (1945+)
                    </button>
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
                                        <div className="ml-8 mt-1 space-y-1 border-l border-[#252a3d] pl-2">
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
                    {(["birth", "field", "bridge", "name"] as const).map((mode) => (
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
        {extensionWorkbenchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="shrink-0 bg-[#0d1018] border-b border-[#22273b] overflow-hidden z-20"
          >
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-[10px] text-emerald-300 uppercase tracking-wider font-bold">Extension Workbench</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">Use this queue to keep new additions connected and consistently tagged.</p>
                </div>
                <button
                  onClick={() => setExtensionWorkbenchOpen(false)}
                  className="p-1 text-slate-500 hover:text-white cursor-pointer"
                  title="Close workbench"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#22273b] bg-[#080a0f] p-1">
                {([
                  ["links", `Links ${suggestedLinks.length + unlinkedThinkers.length + sparseThinkers.length}`],
                  ["tags", `Tags ${weaklyTaggedThinkers.length}`],
                  ["imports", `Imports ${importReviewQueue.length} queued`],
                  ["duplicates", `Duplicates ${duplicateCandidates.length}`],
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

              {workbenchTab === "links" && (
                <div className="space-y-3">
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
                      {["Influence", "Critique", "Transmission", "Collaboration", "Conceptual parallel", "Suggested relationship"].map((type) => (
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
                                onClick={() => addSuggestedRelationship(selectedThinker, person, shared.length > 0 ? `Shared context: ${shared.join(", ")}` : "Potential contextual match.")}
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
                        <div className="text-[10px] text-slate-600 italic font-mono py-2">
                          Select a thinker to see possible links.
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {workbenchTab === "tags" && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
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

              {workbenchTab === "imports" && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                  <div className="xl:col-span-7 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Import Review Draft</span>
                        <p className="text-[10px] text-slate-600 font-mono mt-0.5">Normalize an external candidate before it enters the atlas.</p>
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
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Batch Search</span>
                        <span className="font-mono text-[8.5px] text-slate-600">max 25</span>
                      </div>
                      <div className="flex gap-2">
                        <textarea
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
                        <input
                          ref={jsonImportInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={handleJsonImport}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => csvImportInputRef.current?.click()}
                          className="self-stretch rounded-md border border-[#252a3d] bg-[#10131d] px-3 py-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          Import CSV
                        </button>
                        <button
                          type="button"
                          onClick={exportPeopleCsv}
                          className="self-stretch rounded-md border border-[#252a3d] bg-[#10131d] px-3 py-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          Export CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => jsonImportInputRef.current?.click()}
                          className="self-stretch rounded-md border border-[#252a3d] bg-[#10131d] px-3 py-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          Import JSON
                        </button>
                        <button
                          type="button"
                          onClick={exportAtlasJson}
                          className="self-stretch rounded-md border border-[#252a3d] bg-[#10131d] px-3 py-2 text-[10px] font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          Export JSON
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
                      <input value={importDraft.name} onChange={(event) => setImportDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name" className="md:col-span-4 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
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
                      <textarea value={importDraft.notes} onChange={(event) => setImportDraft((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Short review note" className="md:col-span-6 min-h-16 rounded-md border border-[#252a3d] bg-[#0e1119] px-2 py-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600" />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-[9px] font-mono text-slate-600">Accepting creates a local thinker and preserves source context in notes.</div>
                      <div className="flex items-center gap-2">
                        {(importDraft.name.trim() || draftQueueItemId) && (
                          <button onClick={clearImportDraft} className="rounded-md border border-[#252a3d] px-3 py-2 text-[10px] font-mono text-slate-500 hover:text-slate-200 cursor-pointer">
                            Clear Draft
                          </button>
                        )}
                        <button onClick={acceptImportDraft} disabled={!importDraft.name.trim() || Number.isNaN(Number(importDraft.birth))} className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[10px] font-mono text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer">
                          {draftQueueItemId ? "Accept Edited" : "Accept Candidate"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-5 bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                    <div className="mb-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-200">Review Queue</span>
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">Automated links are evidence-weighted suggestions, not confirmed influence claims.</p>
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

                      <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                        {importReviewQueue.length > 0 ? (
                          importReviewQueue.map((item) => {
                            const candidate = item.candidate;
                            const currentDuplicateId = getDuplicateIdForCandidate(candidate);
                            const duplicate = currentDuplicateId ? people.find((person) => person.id === currentDuplicateId) : null;
                            const linkSuggestions = getCandidateLinkSuggestions(candidate);
                            const reviewStatus: ImportReviewStatus = duplicate ? "duplicate" : item.status;
                            const qualityLabels = getImportQualityLabels(candidate, item.confidence);
                            return (
                              <div key={item.id} className="rounded-md border border-[#1d2232] bg-[#0e1119] p-2.5">
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
                                      Merge metadata
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-2 space-y-1">
                                    <div className="font-mono text-[8.5px] uppercase tracking-wider text-slate-600">Suggested Links</div>
                                    {linkSuggestions.length > 0 ? linkSuggestions.map((suggestion) => (
                                      <button
                                        key={`${item.id}-${suggestion.person.id}`}
                                        onClick={() => {
                                          setHighlightPath([suggestion.person.id]);
                                          selectPerson(suggestion.person.id);
                                        }}
                                        className="w-full rounded border border-[#252a3d] bg-[#0b0d14] px-2 py-1 text-left hover:border-[#7b9cf5] cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="truncate text-[9px] font-mono text-slate-300">{suggestion.person.name}</span>
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
                                        <div className="truncate text-[8px] font-mono text-slate-600">
                                          {suggestion.reasons.length > 0 ? suggestion.reasons.join(" / ") : "nearby chronology"}
                                        </div>
                                      </button>
                                    )) : (
                                      <div className="text-[9px] font-mono text-slate-600 italic">No strong link suggestions yet.</div>
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
                                    onClick={() => useWikidataCandidate(candidate, item.id)}
                                    className="rounded border border-[#7b9cf5]/30 bg-[#7b9cf5]/10 px-2 py-1 text-[8.5px] font-mono text-[#9bdaff] hover:bg-[#7b9cf5]/20 cursor-pointer"
                                  >
                                    Edit Draft
                                  </button>
                                  <button
                                    onClick={() => acceptImportReviewItem(item, true)}
                                    disabled={!!duplicate || candidate.birth === null || linkSuggestions.length === 0}
                                    className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8.5px] font-mono text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    Accept + Link
                                  </button>
                                  <button
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
                          <div className="rounded border border-[#1d2232] bg-[#0e1119] px-3 py-4 text-center text-[10px] font-mono text-slate-600">
                            Queue candidates from search or batch results.
                          </div>
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

              {workbenchTab === "duplicates" && (
                <div className="bg-[#090a0f] border border-[#22273b] rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">Duplicate Candidates</span>
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
                      <div className="text-[10px] text-slate-600 italic font-mono py-2">No likely duplicates detected.</div>
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
              className="h-full glass-panel border-r border-[#22273b] flex flex-col shrink-0 overflow-hidden select-none relative"
            >
              {/* Drag resizing handle visual anchor bar */}
              <div
                onMouseDown={handleLeftResizeStart}
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#7b9cf5]/30 active:bg-[#7b9cf5]/80 transition-colors z-50 select-none"
                title="Drag sideways to resize Thinker Index sidebar"
              />

              <div className="h-10 border-b border-[#22273b] flex items-center justify-between px-4 bg-[#141722]/80 pr-6">
                <span className="font-mono text-[9px] text-[#8c9bbb] uppercase tracking-widest font-bold">Thinkers Index</span>
                <span className="font-mono text-[8.5px] text-slate-500">({processedPeople.length})</span>
              </div>
              <div className="border-b border-[#22273b] bg-[#0d1018] px-3 py-2 pr-5">
                <div className="grid grid-cols-4 gap-1 rounded-md border border-[#22273b] bg-[#080a0f] p-0.5">
                  {(["context", "cluster", "era", "field"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setIndexMode(mode)}
                      className={`rounded px-1.5 py-1 text-[9px] font-mono capitalize transition-colors cursor-pointer ${
                        indexMode === mode
                          ? "bg-[#1f2438] text-[#9bdaff] font-bold"
                          : "text-slate-500 hover:text-slate-200"
                      }`}
                    >
                      {mode === "cluster" ? "clusters" : mode}
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
                                      setFilterDrawerOpen(true);
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

                              return (
                                <button
                                  key={`${group.title}-${p.id}`}
                                  onClick={() => selectPerson(p.id)}
                                  className={`w-full text-left px-3.5 py-2 text-[10.5px] border-l-2 transition-all cursor-pointer flex items-center gap-2.5 hover:bg-[#1f243b]/44 ${
                                    isSelected
                                      ? "bg-[#1f2438] border-[#7b9cf5] text-white font-semibold"
                                      : inPath
                                      ? "bg-amber-500/10 border-amber-500 text-amber-500"
                                      : "border-transparent text-slate-400 hover:text-white"
                                  }`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col }} />
                                  <div className="flex-1 overflow-hidden">
                                    <div className="truncate font-sans font-medium">{p.name}</div>
                                    <div className="text-[8.5px] text-slate-500 font-mono mt-0.5 truncate">
                                      {contextText}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {processedPeople.length === 0 && (
                    <div className="p-4 text-center text-[10px] text-slate-500 italic">
                      No thinkers match filters.
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
                edges={edges}
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
              />
            </div>
 
            {/* COSMOS NETWORK FORCE MAP MODE */}
            <div className={`flex-1 min-h-0 relative p-4 ${viewMode === "network" ? "block h-full" : "hidden"}`}>
              <NetworkGraph
                people={processedPeople}
                edges={edges}
                selectedId={selectedId}
                onSelect={selectPerson}
                highlightPath={highlightPath}
              />
            </div>
 
            {/* SPLIT COMBINED VIEW MODE */}
            <div className={`flex-1 min-h-0 divide-y divide-[#22273b] bg-[#090b10] flex flex-col ${viewMode === "split" ? "block h-full" : "hidden"}`}>
              <div style={{ height: `${splitHeightRatio}%` }} className="min-h-[100px] overflow-hidden relative">
                <Timeline
                  people={processedPeople}
                  edges={edges}
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
                />
              </div>

              {/* SPLIT VIEW DRAG RESIZER */}
              <div
                onMouseDown={handleSplitResizeStart}
                className="h-[6px] bg-[#141620] border-t border-b border-[#22273b] cursor-row-resize hover:bg-[#7b9cf5]/30 active:bg-[#7b9cf5]/80 transition-all select-none relative z-40 shrink-0"
                title="Drag vertically to adjust split panel height"
              />

              <div style={{ height: `${100 - splitHeightRatio}%` }} className="min-h-[150px] p-3 relative">
                <NetworkGraph
                  people={processedPeople}
                  edges={edges}
                  selectedId={selectedId}
                  onSelect={selectPerson}
                  highlightPath={highlightPath}
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
            onSelect={selectPerson}
            isOpen={pathFinderOpen}
            onToggle={() => setPathFinderOpen((prev) => !prev)}
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
              className="absolute md:relative top-0 right-0 h-full shrink-0 border-l border-[#22273b] glass-panel-heavy flex flex-col z-30 shadow-2xl overflow-hidden"
            >
              {/* Drag resizing handle visual anchor bar */}
              <div
                onMouseDown={handleRightResizeStart}
                className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[#7b9cf5]/30 active:bg-[#7b9cf5]/80 transition-colors z-50 select-none"
                title="Drag sideways to resize Scholar Dossier drawer"
              />

              {/* Header inside Detail drawer */}
              <div className="shrink-0 px-5 py-3 border-b border-[#22273b] bg-[#141722] flex justify-between items-center pl-6">
                <span className="font-mono text-[9px] text-[#8c9bbb] uppercase tracking-widest font-bold">SCHOLAR DOSSIER</span>
                <button
                  onClick={() => setSelectedId(null)}
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
                  edges={edges}
                  onFindContemporaries={handleFindContemporaries}
                  onShowBFS={handleShowBFS}
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
      <AddThinkerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddThinker}
      />
    </div>
  );
}
