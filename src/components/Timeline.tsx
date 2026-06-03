import React, { useEffect, useRef, useState } from "react";
import { Thinker, InfluenceEdge } from "../types";
import { FIELD_COLOR, ERA_BANDS } from "../data";

interface TimelineProps {
  people: Thinker[];
  edges: InfluenceEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  highlightPath: string[] | null;
  logScale: boolean;
  onToggleLogScale: () => void;
  showMov: boolean;
  showEdges: boolean;
  showWorks: boolean;
  showLabels: boolean;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  searchQuery: string;
  minYear: number;
  maxYear: number;
  timelineBookmarks?: TimelineBookmark[];
  coordinatedNearbyContext?: boolean;
}

interface TimelineBookmark {
  id: string;
  label: string;
  year: number;
  kind: "thread" | "saved";
}

interface CriticalEvent {
  year: number;
  name: string;
  desc: string;
  color: string;
}

type TimelineDensity = "sparse" | "balanced" | "compressed";

const CRITICAL_EVENTS: CriticalEvent[] = [
  { year: -399, name: "Trial of Socrates", desc: "Socrates drank hemlock, establishing the ultimate ideal of free critical inquiry and philosophical martyrdom.", color: "#f87171" },
  { year: -323, name: "Death of Alexander", desc: "Alexander's demise ushered in the Hellenistic period, blending Greek philosophy with ancient Near Eastern science.", color: "#fb923c" },
  { year: 1440, name: "Gutenberg Printing Press", desc: "Inventor Johannes Gutenberg launched dynamic movable type, accelerating human intellectual storage and dissemination.", color: "#c4b5fd" },
  { year: 1453, name: "Fall of Constantinople", desc: "Eastern Byzantine scholars migrated west with rare classical Greek texts, initiating the Renaissance.", color: "#facc15" },
  { year: 1543, name: "Copernicus Heliocentrism", desc: "Nicolaus Copernicus proposed a sun-centered cosmos, triggering the early Scientific Revolution.", color: "#34d399" },
  { year: 1751, name: "The Encyclopédie", desc: "Diderot compiled reasoning records, forming the ultimate intellectual weapon of the European Enlightenment.", color: "#22d3ee" },
  { year: 1789, name: "The French Revolution", desc: "Challenged absolute monarchic rule, establishing radical universal human rights tenets globally.", color: "#f472b6" },
  { year: 1859, name: "Origin of Species", desc: "Charles Darwin formulated the evolutionary principles of natural selection, reshaping planetary biological science.", color: "#fb7185" },
  { year: 1914, name: "Outbreak of World War I", desc: "Shattered progress narratives, giving rise to modernism, disillusionment, and analytical philosophy.", color: "#f87171" },
  { year: 1939, name: "Outbreak of World War II", desc: "Triggered frantic atomic, rocketry, defense systems, and digital computing development.", color: "#ef4444" },
  { year: 1945, name: "The Atomic & Digital Dawn", desc: "First nuclear explosion and early vacuum-tube mainframe systems initiate the high-tech Postwar era.", color: "#ec4899" },
  { year: 1969, name: "ARPANET & Moon Landing", desc: "Pioneered both global computer communication networking and outer-space planetary travel simultaneously.", color: "#60a5fa" },
  { year: 1991, name: "World Wide Web Launch", desc: "Tim Berners-Lee released the public WWW, creating the modern planetary hypermedia interface.", color: "#2dd4bf" }
];

const BASE_PX_YR = 0.55;

export default function Timeline({
  people,
  edges,
  selectedId,
  onSelect,
  highlightPath,
  logScale,
  onToggleLogScale,
  showMov,
  showEdges,
  showWorks,
  showLabels,
  zoom,
  setZoom,
  searchQuery,
  minYear,
  maxYear,
  timelineBookmarks = [],
  coordinatedNearbyContext = false,
}: TimelineProps) {
  const YEAR_MIN = minYear;
  const YEAR_MAX = maxYear;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hoveredPerson, setHoveredPerson] = useState<Thinker | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<CriticalEvent | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [packedPeople, setPackedPeople] = useState<(Thinker & { row: number })[]>([]);
  const [showEvents, setShowEvents] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [timelineDensity, setTimelineDensity] = useState<TimelineDensity>("balanced");
  const [fieldLanesOpen, setFieldLanesOpen] = useState(false);
  const [nearbyContextOnly, setNearbyContextOnly] = useState(false);

  const ROW_H = timelineDensity === "compressed" ? 12 : timelineDensity === "sparse" ? 24 : 18;
  const HDR_H = 52;
  const densityButtonLabel: Record<TimelineDensity, string> = {
    sparse: "S",
    balanced: "B",
    compressed: "C",
  };
  const semanticZoomTier = zoom < 0.75 ? "overview" : zoom > 2.25 ? "detail" : "balanced";
  const formatYearLabel = (year: number) => year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
  const selectedPerson = selectedId ? packedPeople.find((person) => person.id === selectedId) : null;
  const eraBookmarks = ERA_BANDS.filter((band) => band.e >= YEAR_MIN && band.s <= YEAR_MAX).slice(0, 8);

  // Drag scrolling state
  const isDraggingRef = useRef(false);
  const startDragXRef = useRef(0);
  const startDragYRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const startScrollTopRef = useRef(0);

  const getWorldSize = () => {
    const paddingBottom = 40;
    const maxRow = packedPeople.reduce((max, p) => Math.max(max, p.row), 0);
    const latestPersonYear = people.reduce((max, p) => Math.max(max, p.birth, p.death ?? 2026), YEAR_MAX);
    const height = HDR_H + (maxRow + 1) * ROW_H + paddingBottom;
    const width = Math.max(yearToX(Math.max(YEAR_MAX, latestPersonYear)) + 220, 1800);
    return { width, height };
  };

  const clampPan = (next: { x: number; y: number }) => {
    const world = getWorldSize();
    return {
      x: Math.max(0, Math.min(next.x, Math.max(0, world.width - dimensions.width))),
      y: Math.max(0, Math.min(next.y, Math.max(0, world.height - dimensions.height))),
    };
  };

  const centerOnPerson = (person: Thinker & { row: number }) => {
    const birthX = yearToX(person.birth);
    const deathX = yearToX(person.death ?? 2024);
    const centerX = birthX + Math.max(deathX - birthX, 8) / 2;
    const centerY = HDR_H + person.row * ROW_H + ROW_H / 2;
    setPan(clampPan({
      x: centerX - dimensions.width / 2,
      y: centerY - dimensions.height / 2,
    }));
  };

  const jumpToYear = (year: number) => {
    setPan((current) => clampPan({
      ...current,
      x: yearToX(year) - dimensions.width * 0.18,
    }));
  };

  const resetToFullRange = () => {
    setZoom(1);
    setPan(clampPan({ x: 0, y: 0 }));
  };

  const frameSelectedLifespan = () => {
    if (!selectedPerson) return;
    const span = Math.max(80, (selectedPerson.death ?? 2024) - selectedPerson.birth);
    const targetZoom = Math.max(0.45, Math.min(5, dimensions.width / (span * BASE_PX_YR * 2.2)));
    setZoom(targetZoom);
    window.setTimeout(() => centerOnPerson(selectedPerson), 0);
  };

  useEffect(() => {
    const outer = containerRef.current;
    if (!outer) return;

    const updateSize = () => {
      setDimensions({
        width: Math.max(320, outer.clientWidth),
        height: Math.max(240, outer.clientHeight),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(outer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPan((prev) => clampPan(prev));
  }, [dimensions.width, dimensions.height, packedPeople.length, zoom, minYear, maxYear, timelineDensity]);

  useEffect(() => {
    if (!selectedId || dimensions.width <= 0 || dimensions.height <= 0) return;
    const selectedPerson = packedPeople.find((person) => person.id === selectedId);
    if (!selectedPerson) return;

    const birthX = yearToX(selectedPerson.birth);
    const deathX = yearToX(selectedPerson.death ?? 2024);
    const centerX = birthX + Math.max(deathX - birthX, 8) / 2;
    const centerY = HDR_H + selectedPerson.row * ROW_H + ROW_H / 2;

    setPan(clampPan({
      x: centerX - dimensions.width / 2,
      y: centerY - dimensions.height / 2,
    }));
  }, [selectedId, packedPeople, dimensions.width, dimensions.height, zoom, minYear, maxYear, timelineDensity]);

  // Swimlane packing algorithm
  useEffect(() => {
    const rows: number[] = [];
    const minGap = 20; // safe horizontal years buffer count

    if (fieldLanesOpen) {
      const byField = new Map<string, Thinker[]>();
      people.forEach((person) => {
        const field = person.fields?.[0] || "Unclassified";
        byField.set(field, [...(byField.get(field) || []), person]);
      });

      const packedByField: (Thinker & { row: number })[] = [];
      let baseRow = 0;
      Array.from(byField.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .forEach(([, fieldPeople]) => {
          const fieldRows: number[] = [];
          fieldPeople
            .sort((a, b) => a.birth - b.birth)
            .forEach((p) => {
              const birthWithBuffer = p.birth - minGap;
              const deathVal = p.death ?? 2024;
              const deathWithBuffer = deathVal + minGap;
              let placedRow = -1;

              for (let r = 0; r < fieldRows.length; r++) {
                if (birthWithBuffer >= fieldRows[r]) {
                  placedRow = r;
                  fieldRows[r] = deathWithBuffer;
                  break;
                }
              }

              if (placedRow === -1) {
                placedRow = fieldRows.length;
                fieldRows.push(deathWithBuffer);
              }

              packedByField.push({ ...p, row: baseRow + placedRow });
            });
          baseRow += fieldRows.length + 1;
        });

      setPackedPeople(packedByField);
      return;
    }

    const sortedByBirth = [...people].sort((a, b) => a.birth - b.birth);
    const packed = sortedByBirth.map((p) => {
      const birthWithBuffer = p.birth - minGap;
      const deathVal = p.death ?? 2024;
      const deathWithBuffer = deathVal + minGap;

      let placedRow = -1;
      for (let r = 0; r < rows.length; r++) {
        if (birthWithBuffer >= rows[r]) {
          placedRow = r;
          rows[r] = deathWithBuffer;
          break;
        }
      }

      if (placedRow === -1) {
        placedRow = rows.length;
        rows.push(deathWithBuffer);
      }

      return {
        ...p,
        row: placedRow,
      };
    });

    setPackedPeople(packed);
  }, [people, fieldLanesOpen]);

  // Scaler formulas
  const getLinearWidth = () => (YEAR_MAX - YEAR_MIN) * BASE_PX_YR * zoom;

  const historicalScale = (year: number) => {
    if (year <= 500) {
      return (year + 500) * 0.18;
    }
    if (year <= 1400) {
      return 200 + (year - 500) * 0.35;
    }
    if (year <= 1800) {
      return 515 + (year - 1400) * 0.95;
    }
    return 895 + (year - 1800) * 1.75;
  };

  const yearToX = (year: number) => {
    if (!logScale) {
      return (year - YEAR_MIN) * BASE_PX_YR * zoom;
    }
    const scaled = historicalScale(year) - historicalScale(YEAR_MIN);
    return scaled * zoom * 1.8;
  };

  const xToYear = (x: number) => {
    if (!logScale) {
      return x / (BASE_PX_YR * zoom) + YEAR_MIN;
    }
    const baseVal = x / (zoom * 1.8) + historicalScale(YEAR_MIN);
    if (baseVal < historicalScale(YEAR_MIN)) {
      return YEAR_MIN;
    }
    if (baseVal <= 200) {
      return (baseVal / 0.18) - 500;
    }
    if (baseVal <= 515) {
      return ((baseVal - 200) / 0.35) + 500;
    }
    if (baseVal <= 895) {
      return ((baseVal - 515) / 0.95) + 1400;
    }
    return ((baseVal - 895) / 1.75) + 1800;
  };

  const visibleStartYear = Math.round(Math.max(YEAR_MIN, xToYear(pan.x)));
  const visibleEndYear = Math.round(Math.min(YEAR_MAX, xToYear(pan.x + dimensions.width)));

  // Redraw hook
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const canvasW = dimensions.width;
    const canvasH = dimensions.height;
    const world = getWorldSize();

    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvasW * ratio;
    canvas.height = canvasH * ratio;
    canvas.style.width = canvasW + "px";
    canvas.style.height = canvasH + "px";
    ctx.scale(ratio, ratio);

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();
    ctx.translate(-pan.x, -pan.y);

    // ── 1. Era bands rendering ──
    if (showMov) {
      ERA_BANDS.forEach((b) => {
        const x1 = yearToX(b.s);
        const x2 = yearToX(b.e);
        ctx.fillStyle = b.fill;
        ctx.fillRect(x1, 0, x2 - x1, world.height);
      });
    }

    if (fieldLanesOpen) {
      const laneMap = new Map<string, { minRow: number; maxRow: number; color: string }>();
      packedPeople.forEach((person) => {
        const field = person.fields?.[0] || "Unclassified";
        const current = laneMap.get(field);
        const color = FIELD_COLOR[field] || "#94a3b8";
        laneMap.set(field, {
          minRow: current ? Math.min(current.minRow, person.row) : person.row,
          maxRow: current ? Math.max(current.maxRow, person.row) : person.row,
          color,
        });
      });

      Array.from(laneMap.entries()).forEach(([field, lane]) => {
        const y = HDR_H + lane.minRow * ROW_H;
        const height = (lane.maxRow - lane.minRow + 1) * ROW_H;
        ctx.fillStyle = `${lane.color}12`;
        ctx.fillRect(0, y, world.width, height);
        ctx.strokeStyle = `${lane.color}35`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(world.width, y);
        ctx.stroke();
        ctx.fillStyle = `${lane.color}cc`;
        ctx.font = "600 8px 'IBM Plex Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(field, pan.x + 8, y + 11);
      });
    }

    // ── 2. Structural Grid lines ──
    let ticks: number[] = [];
    if (logScale) {
      ticks = [
        -600, -500, -400, -300, -200, -100, 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300,
        1400, 1450, 1500, 1550, 1600, 1625, 1650, 1675, 1700, 1725, 1750, 1775, 1800, 1820, 1840, 1860, 1880, 1900,
        1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030
      ];
    } else {
      let gridStep = 100;
      if (zoom < 0.3) gridStep = 250;
      else if (zoom < 0.6) gridStep = 200;
      else if (zoom > 3) gridStep = 25;
      else if (zoom > 6) gridStep = 10;

      for (let y = Math.ceil(YEAR_MIN / gridStep) * gridStep; y <= YEAR_MAX; y += gridStep) {
        ticks.push(y);
      }
    }

    const majorTimelineInterval = logScale ? new Set([-600, -400, -200, 0, 500, 1000, 1400, 1500, 1600, 1700, 1800, 1900, 1950, 2000, 2020]) : null;

    ticks.forEach((y) => {
      const x = yearToX(y);
      const isMajor = majorTimelineInterval ? majorTimelineInterval.has(y) : y % 500 === 0 || y % 100 === 0;

      ctx.strokeStyle = isMajor ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = isMajor ? 1.2 : 0.6;

      ctx.beginPath();
      ctx.moveTo(x, HDR_H);
      ctx.lineTo(x, world.height);
      ctx.stroke();

      // Tick Text Labels
      ctx.fillStyle = isMajor ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.22)";
      ctx.font = `${isMajor ? "600" : "400"} ${isMajor ? "10" : "8"}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "left";
      ctx.fillText(y < 0 ? `${Math.abs(y)} BCE` : String(y), x + 3, HDR_H - 8);
    });

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HDR_H);
    ctx.lineTo(world.width, HDR_H);
    ctx.stroke();

    // ── 2b. Historical Critical Event Overlays ──
    if (showEvents) {
      CRITICAL_EVENTS.forEach((ev) => {
        const evX = yearToX(ev.year);
        if (evX < pan.x - 60 || evX > pan.x + canvasW + 60) return;

        // Draw vertical ribbon/line
        ctx.strokeStyle = `${ev.color}25`;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(evX, HDR_H);
        ctx.lineTo(evX, world.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Event pin on top header line
        ctx.fillStyle = ev.color;
        ctx.beginPath();
        ctx.arc(evX, HDR_H, 4, 0, Math.PI * 2);
        ctx.fill();

        if (semanticZoomTier === "overview") return;

        // Label flag tag card
        ctx.fillStyle = "#10121a";
        ctx.strokeStyle = `${ev.color}80`;
        ctx.lineWidth = 1;

        const tagText = `${ev.year < 0 ? `${Math.abs(ev.year)} BCE` : ev.year}: ${ev.name}`;
        ctx.font = "500 8.5px 'IBM Plex Mono', monospace";
        const txtMargin = 3;
        const txtWidth = ctx.measureText(tagText).width;

        ctx.beginPath();
        ctx.roundRect?.(evX - txtWidth / 2 - txtMargin, HDR_H - 24, txtWidth + txtMargin * 2, 13, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = ev.color;
        ctx.textAlign = "center";
        ctx.fillText(tagText, evX, HDR_H - 15);
      });
    }

    // Build active context sets for selective timeline dimming
    const activeSet = new Set<string>();
    const isAnySelected = selectedId !== null || (highlightPath && highlightPath.length > 0);
    
    if (selectedId) {
      activeSet.add(selectedId);
      edges.forEach((e) => {
        if (e.source === selectedId) {
          activeSet.add(e.target);
        }
        if (e.target === selectedId) {
          activeSet.add(e.source);
        }
      });
    }
    if (highlightPath) {
      highlightPath.forEach((id) => activeSet.add(id));
    }

    // ── 3. Influence connectors edges ──
    const highlightedEdgeKeys = new Set<string>();
    if (highlightPath) {
      for (let i = 0; i < highlightPath.length - 1; i += 1) {
        highlightedEdgeKeys.add(`${highlightPath[i]}->${highlightPath[i + 1]}`);
      }
    }

    if (showEdges) {
      edges.forEach((e) => {
        const src = packedPeople.find((p) => p.id === e.source);
        const tgt = packedPeople.find((p) => p.id === e.target);
        if (!src || !tgt) return;

        const isHighlightedPathEdge = highlightedEdgeKeys.has(`${e.source}->${e.target}`);
        const isCurrentlySelected = src.id === selectedId || tgt.id === selectedId;

        // Skip connection if a selection is active and this link is unrelated
        if (isAnySelected && !isCurrentlySelected && !isHighlightedPathEdge) {
          return;
        }

        // Skip faint connections if there is search active
        if (!isCurrentlySelected && !isHighlightedPathEdge && searchQuery.trim() !== "" && packedPeople.length > 50) {
          return;
        }

        const srcBirthYr = Math.max(src.birth, YEAR_MIN);
        const srcDeathYr = Math.min(src.death ?? 2024, YEAR_MAX);
        const tgtBirthYr = Math.max(tgt.birth, YEAR_MIN);
        const tgtDeathYr = Math.min(tgt.death ?? 2024, YEAR_MAX);

        // Skip if either is completely clipped out of the current scope
        if (srcBirthYr > srcDeathYr || tgtBirthYr > tgtDeathYr) {
          return;
        }

        const sx = yearToX(srcBirthYr + (srcDeathYr - srcBirthYr) * 0.5);
        const tx = yearToX(tgtBirthYr + (tgtDeathYr - tgtBirthYr) * 0.5);
        const sy = HDR_H + src.row * ROW_H + ROW_H / 2;
        const ty = HDR_H + tgt.row * ROW_H + ROW_H / 2;

        ctx.strokeStyle = isCurrentlySelected ? "#7b9cf5" : isHighlightedPathEdge ? "#e8b84b" : "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = isCurrentlySelected ? 1.6 : isHighlightedPathEdge ? 2.2 : (e.strength || 3) * 0.2;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx, sy - 20, tx, ty - 20, tx, ty);
        ctx.stroke();
      });
    }

    // ── 4. Lifespan timelines ──
    const relationCounts = new Map<string, number>();
    edges.forEach((edge) => {
      relationCounts.set(edge.source, (relationCounts.get(edge.source) || 0) + 1);
      relationCounts.set(edge.target, (relationCounts.get(edge.target) || 0) + 1);
    });
    const normalizedSearch = searchQuery.trim().toLowerCase();

    packedPeople.forEach((p) => {
      const birthYr = Math.max(p.birth, YEAR_MIN);
      const deathYr = Math.min(p.death ?? 2024, YEAR_MAX);

      if (birthYr > deathYr) {
        return; // Filtered fully out of view range
      }

      const x1 = yearToX(birthYr);
      const x2 = yearToX(deathYr);
      const barW = Math.max(x2 - x1, 4);

      const y0 = HDR_H + p.row * ROW_H;
      const primaryField = p.fields?.[0] || "Philosophy";
      const col = FIELD_COLOR[primaryField] || "#94a3b8";
      const isSel = p.id === selectedId;
      const isHover = hoveredPerson?.id === p.id;
      const inPath = highlightPath && highlightPath.includes(p.id);
      const isSearchMatch = normalizedSearch.length > 0 && (
        p.name.toLowerCase().includes(normalizedSearch) ||
        (p.works || []).some((work) => work.toLowerCase().includes(normalizedSearch)) ||
        (p.topics || []).some((topic) => topic.toLowerCase().includes(normalizedSearch))
      );
      const isHighBridge = (relationCounts.get(p.id) || 0) >= 5;

      const bh = isSel ? ROW_H - 1 : ROW_H - 5;
      const by = y0 + (ROW_H - bh) / 2;

      ctx.save();
      if ((timelineDensity === "compressed" || nearbyContextOnly || coordinatedNearbyContext) && isAnySelected && !activeSet.has(p.id) && !isSearchMatch && !isHighBridge) {
        const markerX = x1 + barW / 2;
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = col;
        ctx.fillRect(markerX, y0 + ROW_H / 2 - 2, 1.5, 4);
        ctx.restore();
        return;
      }

      // Fade out timeline bar if a selection is active and this node is inactive
      if (isAnySelected && !activeSet.has(p.id)) {
        ctx.globalAlpha = 0.32;
      }

      if (isSel) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = isSel ? col : inPath ? "#e8b84b" : isHover ? col + "ee" : col + "af";

      ctx.beginPath();
      const radius = 2;
      ctx.roundRect?.(x1, by, barW, bh, radius);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSel || inPath) {
        ctx.save();
        ctx.shadowColor = isSel ? col : "#e8b84b";
        ctx.shadowBlur = 8;
        ctx.strokeStyle = isSel ? "#ffffff" : "#e8b84b";
        ctx.lineWidth = isSel ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.roundRect?.(x1, by, barW, bh, radius);
        ctx.stroke();
        ctx.restore();
      }

      // Major works indicators
      if (showWorks && semanticZoomTier !== "overview" && p.works && p.works.length > 0) {
        p.works.slice(0, 3).forEach((_, wi) => {
          const dotX = x1 + 8 + wi * 8;
          if (dotX < x2 - 4) {
            ctx.fillStyle = isSel ? "#ffffff" : "rgba(255, 255, 255, 0.6)";
            ctx.beginPath();
            ctx.arc(dotX, y0 + ROW_H / 2, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Text Labels
      const shouldShowLabel =
        timelineDensity === "compressed"
          ? (isSel || isHover || inPath || isSearchMatch || isHighBridge) && barW > (semanticZoomTier === "detail" ? 30 : 42)
          : timelineDensity === "sparse"
          ? (showLabels || semanticZoomTier !== "overview" || isSel || isHover || inPath || isSearchMatch) && barW > (semanticZoomTier === "detail" ? 18 : 24)
          : (showLabels || semanticZoomTier === "detail" || isSel || isHover || inPath || isSearchMatch || isHighBridge) && barW > (semanticZoomTier === "detail" ? 26 : 35);

      if (shouldShowLabel) {
        ctx.fillStyle = isSel ? "#ffffff" : "rgba(255, 255, 255, 0.95)";
        ctx.font = `600 ${zoom > 2.5 ? "9" : "8"}px 'IBM Plex Mono', monospace`;
        ctx.textAlign = "left";
        const trimmedName = p.name.split(" ").slice(-1)[0];
        ctx.fillText(trimmedName, x1 + 4, y0 + ROW_H / 2 + 3);
      }
      ctx.restore();
    });
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(16, 18, 26, 0.92)";
    ctx.fillRect(0, 0, canvasW, 28);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 27.5);
    ctx.lineTo(canvasW, 27.5);
    ctx.stroke();

    ticks.forEach((year) => {
      const x = yearToX(year) - pan.x;
      if (x < -80 || x > canvasW + 80) return;
      const isMajor = majorTimelineInterval ? majorTimelineInterval.has(year) : year % 500 === 0 || year % 100 === 0;
      ctx.fillStyle = isMajor ? "rgba(255, 255, 255, 0.72)" : "rgba(255, 255, 255, 0.32)";
      ctx.font = `${isMajor ? "600" : "400"} ${isMajor ? "10" : "8"}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "left";
      ctx.fillText(year < 0 ? `${Math.abs(year)} BCE` : String(year), x + 3, 18);
    });
    ctx.restore();
  }, [packedPeople, selectedId, hoveredPerson, hoveredEvent, highlightPath, logScale, showMov, showEdges, showWorks, showLabels, showEvents, zoom, edges, searchQuery, minYear, maxYear, pan.x, pan.y, dimensions.width, dimensions.height, timelineDensity, semanticZoomTier, fieldLanesOpen, nearbyContextOnly, coordinatedNearbyContext]);

  const findPersonAtClientPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const outer = containerRef.current;
    if (!canvas || !outer) return null;

    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left + pan.x;
    const cy = clientY - rect.top + pan.y;

    const idx = Math.floor((cy - HDR_H) / ROW_H);

    return packedPeople.find((p) => {
      if (p.row !== idx) return false;
      const x1 = yearToX(p.birth);
      const x2 = yearToX(p.death ?? 2024);
      return cx >= x1 && cx <= x2;
    }) || null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const outer = containerRef.current;
    if (!outer) return;

    isDraggingRef.current = true;
    setIsPanning(true);
    startDragXRef.current = e.clientX;
    startDragYRef.current = e.clientY;
    startScrollLeftRef.current = pan.x;
    startScrollTopRef.current = pan.y;
    setHoveredPerson(null);
    setHoveredEvent(null);

    const handleDocumentPointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      moveEvent.preventDefault();

      const dx = moveEvent.clientX - startDragXRef.current;
      const dy = moveEvent.clientY - startDragYRef.current;
      setPan(clampPan({
        x: startScrollLeftRef.current - dx,
        y: startScrollTopRef.current - dy,
      }));
    };

    const handleDocumentPointerUp = (upEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsPanning(false);
      document.removeEventListener("pointermove", handleDocumentPointerMove);
      document.removeEventListener("pointerup", handleDocumentPointerUp);
      document.removeEventListener("pointercancel", handleDocumentPointerCancel);

      const dx = Math.abs(upEvent.clientX - startDragXRef.current);
      const dy = Math.abs(upEvent.clientY - startDragYRef.current);
      if (dx < 4 && dy < 4) {
        const clicked = findPersonAtClientPoint(upEvent.clientX, upEvent.clientY);
        if (clicked) onSelect(clicked.id);
      }
    };

    const handleDocumentPointerCancel = () => {
      isDraggingRef.current = false;
      setIsPanning(false);
      document.removeEventListener("pointermove", handleDocumentPointerMove);
      document.removeEventListener("pointerup", handleDocumentPointerUp);
      document.removeEventListener("pointercancel", handleDocumentPointerCancel);
    };

    document.addEventListener("pointermove", handleDocumentPointerMove, { passive: false });
    document.addEventListener("pointerup", handleDocumentPointerUp);
    document.addEventListener("pointercancel", handleDocumentPointerCancel);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const outer = containerRef.current;
    if (!canvas || !outer) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - startDragXRef.current;
      const dy = e.clientY - startDragYRef.current;
      setPan(clampPan({
        x: startScrollLeftRef.current - dx,
        y: startScrollTopRef.current - dy,
      }));
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left + pan.x;
    const cy = e.clientY - rect.top + pan.y;

    // Check if hovering a Critical Event
    if (showEvents) {
      const hitEvent = CRITICAL_EVENTS.find((ev) => {
        const evX = yearToX(ev.year);
        // Expand collision width a little bit around the dotted line & flag
        return Math.abs(cx - evX) < 12 && cy < DimensionsPaddingHOffset(outer);
      });

      if (hitEvent) {
        setHoveredEvent(hitEvent);
        setHoveredPerson(null);
        setTooltipPos({ x: e.clientX + 16, y: e.clientY - 12 });
        return;
      } else {
        setHoveredEvent(null);
      }
    }

    // Hover Collision Detection for People bars
    const ROW_H = 18;
    const HDR_H = 52;
    const idx = Math.floor((cy - HDR_H) / ROW_H);

    const hit = packedPeople.find((p) => {
      if (p.row !== idx) return false;
      const x1 = yearToX(p.birth);
      const x2 = yearToX(p.death ?? 2024);
      return cx >= x1 && cx <= x2;
    });

    if (hit) {
      setHoveredPerson(hit);
      setTooltipPos({ x: e.clientX + 16, y: e.clientY - 12 });
    } else {
      setHoveredPerson(null);
    }
  };

  // Helper to bound collision queries to header flags
  const DimensionsPaddingHOffset = (el: HTMLDivElement) => {
    return 64; 
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const outer = containerRef.current;
    if (!outer) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();

      const rect = outer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + pan.x;
      const yearAtMouse = xToYear(mouseX);

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((prev) => {
        const next = Math.max(0.15, Math.min(8.0, prev * factor));
        setTimeout(() => {
          const newMouseX = yearToX(yearAtMouse);
          setPan((current) => clampPan({ ...current, x: newMouseX - (e.clientX - rect.left) }));
        }, 0);
        return next;
      });
      return;
    }

    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      setPan((current) => clampPan({ ...current, x: current.x + (e.shiftKey ? e.deltaY : e.deltaX) }));
      return;
    }

    setPan((current) => clampPan({ ...current, y: current.y + e.deltaY }));
  };

  const panTimeline = (direction: -1 | 1) => {
    const outer = containerRef.current;
    if (!outer) return;
    setPan((current) => clampPan({ ...current, x: current.x + direction * Math.max(260, dimensions.width * 0.65) }));
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0b0f] border-b border-[#252a3d] relative">
      {/* Dynamic Controls Header inside timeline */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#252a3d] bg-[#10121a]">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xs italic text-amber-500 font-bold">Timeline</span>
          <div className="flex items-center rounded border border-[#252a3d] bg-[#080a0f] p-0.5">
            {(["sparse", "balanced", "compressed"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimelineDensity(mode)}
                className={`rounded px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
                  timelineDensity === mode ? "bg-[#1f2438] text-[#9bdaff]" : "text-slate-500 hover:text-slate-200"
                }`}
                title={`${mode} timeline density`}
              >
                {densityButtonLabel[mode]}
              </button>
            ))}
          </div>
          
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 select-none hover:text-slate-200">
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(e) => setShowEvents(e.target.checked)}
              className="accent-[#e8b84b] rounded"
            />
            <span className="font-mono">Critical Event Overlays</span>
          </label>
          <button
            onClick={() => setFieldLanesOpen((prev) => !prev)}
            className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer ${
              fieldLanesOpen ? "border-[#7b9cf5] bg-[#7b9cf5]/15 text-[#9bdaff]" : "border-[#252a3d] text-slate-500 hover:text-slate-200"
            }`}
            title="Toggle field lanes"
          >
            Lanes
          </button>
          <button
            onClick={() => setNearbyContextOnly((prev) => !prev)}
            disabled={!selectedId && !highlightPath}
            className={`rounded border px-2 py-1 text-[9px] font-mono transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-35 ${
              nearbyContextOnly || coordinatedNearbyContext ? "border-emerald-400 bg-emerald-400/15 text-emerald-200" : "border-[#252a3d] text-slate-500 hover:text-slate-200"
            }`}
            title="Show nearby context"
          >
            Nearby
          </button>
        </div>
        
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <button
              onClick={() => panTimeline(-1)}
              className="w-6 h-5 flex items-center justify-center border border-[#252a3d] rounded text-slate-400 hover:border-slate-500 hover:text-slate-100 cursor-pointer"
              title="Pan timeline left"
            >
              ←
            </button>
            <button
              onClick={() => panTimeline(1)}
              className="w-6 h-5 flex items-center justify-center border border-[#252a3d] rounded text-slate-400 hover:border-slate-500 hover:text-slate-100 cursor-pointer"
              title="Pan timeline right"
            >
              →
            </button>
          </div>

          <button
            onClick={onToggleLogScale}
            className={`px-2.5 py-1 text-[10px] font-mono rounded border transition-all cursor-pointer ${
              logScale ? "bg-[#7b9cf5]/15 border-[#7b9cf5] text-[#7b9cf5]" : "border-[#252a3d] text-slate-500 hover:text-slate-200"
            }`}
            title="Adjusts represented density in ancient epochs relative to modern eras"
          >
            {logScale ? "Scale" : "Linear"}
          </button>
          
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <button
              onClick={() => setZoom((z) => Math.max(0.15, z / 1.3))}
              className="w-5 h-5 flex items-center justify-center border border-[#252a3d] rounded text-slate-400 hover:border-slate-500 cursor-pointer"
            >
              -
            </button>
            <span className="w-12 text-center text-slate-400">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(8.0, z * 1.3))}
              className="w-5 h-5 flex items-center justify-center border border-[#252a3d] rounded text-slate-400 hover:border-slate-500 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#252a3d] bg-[#0d1018] px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[9px] text-slate-500">
            <span className="uppercase tracking-wider text-[#5a6480]">Window</span>
            <span className="rounded border border-[#252a3d] bg-[#080a0f] px-2 py-1 text-slate-300">
              {formatYearLabel(visibleStartYear)} to {formatYearLabel(visibleEndYear)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => selectedPerson && centerOnPerson(selectedPerson)}
              disabled={!selectedPerson}
              className="rounded border border-[#252a3d] bg-[#10121a] px-2 py-1 text-[9px] font-mono text-slate-400 hover:text-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              title="Jump to selected thinker"
            >
              Selected
            </button>
            <button
              onClick={frameSelectedLifespan}
              disabled={!selectedPerson}
              className="rounded border border-[#252a3d] bg-[#10121a] px-2 py-1 text-[9px] font-mono text-slate-400 hover:text-slate-100 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              title="Frame selected thinker lifespan"
            >
              Lifespan
            </button>
            <button
              onClick={resetToFullRange}
              className="rounded border border-[#252a3d] bg-[#10121a] px-2 py-1 text-[9px] font-mono text-slate-400 hover:text-slate-100 cursor-pointer"
              title="Reset timeline to full range"
            >
              Full
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#5a6480]">Scrub</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, getWorldSize().width - dimensions.width)}
            value={Math.min(pan.x, Math.max(0, getWorldSize().width - dimensions.width))}
            onChange={(event) => setPan((current) => clampPan({ ...current, x: Number(event.target.value) }))}
            className="w-full accent-[#7b9cf5]"
            title="Mini timeline range scrubber"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
          {eraBookmarks.map((era) => (
            <button
              key={`${era.label}-${era.s}-${era.e}`}
              onClick={() => jumpToYear(era.s)}
              className="shrink-0 rounded border border-[#252a3d] bg-[#090b10] px-2 py-1 text-[9px] font-mono text-slate-500 hover:border-[#7b9cf5] hover:text-slate-200 cursor-pointer"
              title={`Jump to ${era.label}`}
            >
              {era.label}
            </button>
          ))}
          {timelineBookmarks.map((bookmark) => (
            <button
              key={`${bookmark.kind}-${bookmark.id}`}
              onClick={() => jumpToYear(bookmark.year)}
              className={`shrink-0 rounded border px-2 py-1 text-[9px] font-mono cursor-pointer ${
                bookmark.kind === "thread"
                  ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:border-cyan-300"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300"
              }`}
              title={`Jump to ${bookmark.label}`}
            >
              {bookmark.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Right timeline canvas scroll parent */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerCancel={handlePointerCancel}
          className={`flex-1 min-w-0 max-w-full overflow-auto relative scrollbar-thin select-none touch-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        >
          <div
            className="relative"
            style={{
              width: `${dimensions.width}px`,
              minWidth: `${dimensions.width}px`,
              height: `${dimensions.height}px`,
            }}
          >
            <canvas
              ref={canvasRef}
              className="block pointer-events-none"
              style={{
                width: `${dimensions.width}px`,
                height: `${dimensions.height}px`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Thinker Tooltip Overlay */}
      {hoveredPerson && (
        <div
          className="fixed z-50 bg-[#141721] border border-[#252a3d] rounded-lg p-3 shadow-2xl max-w-xs font-sans text-xs pointer-events-none transition-transform duration-75"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className="font-serif text-sm font-bold text-slate-100 mb-1">{hoveredPerson.name}</div>
          <div className="font-mono text-[9px] font-bold mb-1" style={{ color: FIELD_COLOR[hoveredPerson.fields?.[0] || "Philosophy"] }}>
            {hoveredPerson.fields?.join(", ")} {hoveredPerson.subfields?.length ? `• ${hoveredPerson.subfields.join(', ')}` : ""}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mb-2">
            {hoveredPerson.birth < 0 ? `${Math.abs(hoveredPerson.birth)} BCE` : hoveredPerson.birth} – {hoveredPerson.death ?? "present"} · Era: {hoveredPerson.era}
          </div>
          {hoveredPerson.notes && (
            <p className="text-slate-300 leading-relaxed text-[11px] font-[350] border-t border-[#252a3d] pt-1.5 mt-1.5 italic">
              {hoveredPerson.notes.length > 120 ? `${hoveredPerson.notes.slice(0, 120)}...` : hoveredPerson.notes}
            </p>
          )}
        </div>
      )}

      {/* Historical Critical Event Tooltip Overlay */}
      {hoveredEvent && (
        <div
          className="fixed z-50 bg-[#161a29] border border-[#e8b84b]/60 rounded-lg p-3.5 shadow-2xl max-w-xs font-sans text-xs pointer-events-none transition-transform duration-75"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className="font-serif text-[12px] font-bold text-[#e8b84b] mb-1 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredEvent.color }} />
            <span>Critical Historical Event</span>
          </div>
          <div className="font-mono text-[11px] font-bold text-slate-100 mb-1">
            {hoveredEvent.name} ({hoveredEvent.year < 0 ? `${Math.abs(hoveredEvent.year)} BCE` : hoveredEvent.year})
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px] border-t border-[#252a3d] pt-1.5 mt-1.5 italic">
            {hoveredEvent.desc}
          </p>
        </div>
      )}
    </div>
  );
}
