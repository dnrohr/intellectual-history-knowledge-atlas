import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Thinker, InfluenceEdge } from "../types";
import { FIELD_COLOR, INITIAL_INSTITUTIONS_DATA } from "../data";
import { getDomainForField } from "../taxonomy";

type GraphClusterMode = "none" | "domain" | "movement" | "era" | "institution";
type GraphLayoutMode = "force" | "timeline" | "ego" | "lineage" | "concept";
type GraphLabelDensity = "focus" | "key" | "more" | "all";

interface NetworkGraphProps {
  people: Thinker[];
  edges: InfluenceEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  highlightPath: string[] | null;
  coordinatedFocusDepth?: "all" | 1 | 2 | 3;
}

interface SimulatedNode extends d3.SimulationNodeDatum, Thinker {
  r: number;
}

interface SimulatedLink extends d3.SimulationLinkDatum<SimulatedNode> {
  source: SimulatedNode;
  target: SimulatedNode;
  strength: number;
  type: string;
  confidence?: number;
  sourceClaims?: string[];
  claimIds?: string[];
  status?: InfluenceEdge["status"];
}

const getEdgeVisualState = (edge: Pick<InfluenceEdge, "confidence" | "sourceClaims" | "claimIds" | "status">) => {
  const isSuggested = edge.status === "suggested";
  const hasSources = (edge.sourceClaims?.length || 0) > 0 || (edge.claimIds?.length || 0) > 0;
  const needsSource = edge.status === "needs_source" || !hasSources;
  const lowConfidence = (edge.confidence ?? 1) < 0.5;
  return {
    isSuggested,
    needsSource,
    lowConfidence,
    dash: isSuggested ? [5, 4] : needsSource || lowConfidence ? [2, 4] : [],
  };
};

export default function NetworkGraph({
  people,
  edges,
  selectedId,
  onSelect,
  highlightPath,
  coordinatedFocusDepth,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  const simulationRef = useRef<d3.Simulation<SimulatedNode, SimulatedLink> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<SimulatedNode[]>([]);
  const linksRef = useRef<SimulatedLink[]>([]);
  const requestRef = useRef<number | null>(null);
  const animTimeRef = useRef<number>(0);
  const clusterCentersRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const layoutTargetsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [hoveredNode, setHoveredNode] = useState<SimulatedNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [focusDepth, setFocusDepth] = useState<"all" | 1 | 2 | 3>(1);
  const [clusterMode, setClusterMode] = useState<GraphClusterMode>("none");
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>("force");
  const [labelDensity, setLabelDensity] = useState<GraphLabelDensity>("key");
  const effectiveFocusDepth = focusDepth;

  useEffect(() => {
    if (coordinatedFocusDepth !== undefined) setFocusDepth(coordinatedFocusDepth);
  }, [coordinatedFocusDepth]);

  const clampGraphPointToViewport = (point: { x: number; y: number }, width: number, height: number, radius = 14) => {
    const topPad = Math.min(116, Math.max(32, height * 0.18));
    const bottomPad = showOverviewNavigator ? 48 : 24;
    const sidePad = Math.max(28, radius + 8);
    return {
      x: Math.max(sidePad, Math.min(Math.max(sidePad, width - sidePad), point.x)),
      y: Math.max(topPad, Math.min(Math.max(topPad, height - bottomPad), point.y)),
    };
  };

  const getClusterKey = (person: Thinker, mode: GraphClusterMode = clusterMode) => {
    if (mode === "domain") return getDomainForField(person.fields?.[0] || "");
    if (mode === "movement") return person.movement || "Unclassified movement";
    if (mode === "era") return person.era || "Unclassified era";
    if (mode === "institution") {
      return INITIAL_INSTITUTIONS_DATA.find((institution) => institution.figures.includes(person.id))?.name || "Unaffiliated";
    }
    return "Network";
  };

  const getClusterCenters = (nodes: SimulatedNode[], width: number, height: number, mode: GraphClusterMode) => {
    if (mode === "none") return new Map<string, { x: number; y: number }>();

    const keys = Array.from(new Set(nodes.map((node) => getClusterKey(node, mode)))).sort();
    const cols = Math.max(1, Math.ceil(Math.sqrt(keys.length)));
    const rows = Math.max(1, Math.ceil(keys.length / cols));
    const xPad = width * 0.12;
    const yPad = height * 0.18;
    const usableWidth = Math.max(120, width - xPad * 2);
    const usableHeight = Math.max(120, height - yPad * 2);

    return new Map(
      keys.map((key, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return [
          key,
          {
            x: xPad + ((col + 0.5) * usableWidth) / cols,
            y: yPad + ((row + 0.5) * usableHeight) / rows,
          },
        ];
      })
    );
  };

  const getConceptKey = (person: Thinker) =>
    person.subfields?.[0]?.split("/")[0]?.trim() || getDomainForField(person.fields?.[0] || "");

  const getGridCenters = (keys: string[], width: number, height: number) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(keys.length)));
    const rows = Math.max(1, Math.ceil(keys.length / cols));
    const xPad = width * 0.12;
    const yPad = height * 0.18;
    const usableWidth = Math.max(120, width - xPad * 2);
    const usableHeight = Math.max(120, height - yPad * 2);

    return new Map(
      keys.map((key, index) => [
        key,
        {
          x: xPad + (((index % cols) + 0.5) * usableWidth) / cols,
          y: yPad + ((Math.floor(index / cols) + 0.5) * usableHeight) / rows,
        },
      ])
    );
  };

  const getGraphDepths = (nodes: SimulatedNode[]) => {
    const depths = new Map<string, number>();
    if (!selectedId || !nodes.some((node) => node.id === selectedId)) return depths;

    depths.set(selectedId, 0);
    const queue = [{ id: selectedId, depth: 0 }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      graphEdges.forEach((edge) => {
        const neighbor = edge.source === current.id ? edge.target : edge.target === current.id ? edge.source : null;
        if (neighbor && !depths.has(neighbor)) {
          depths.set(neighbor, current.depth + 1);
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      });
    }
    return depths;
  };

  const getLayoutTargets = (
    nodes: SimulatedNode[],
    width: number,
    height: number,
    mode: GraphLayoutMode,
    cluster: GraphClusterMode
  ) => {
    if (mode === "force") {
      if (cluster === "none") return new Map(nodes.map((node) => [node.id, { x: width / 2, y: height / 2 }]));
      const centers = getClusterCenters(nodes, width, height, cluster);
      return new Map(nodes.map((node) => [node.id, centers.get(getClusterKey(node, cluster)) || { x: width / 2, y: height / 2 }]));
    }

    const births = nodes.map((node) => node.birth);
    const minBirth = Math.min(...births, -650);
    const maxBirth = Math.max(...births, 2030);
    const span = Math.max(1, maxBirth - minBirth);
    const xForYear = (year: number) => width * 0.08 + ((year - minBirth) / span) * width * 0.84;

    if (mode === "timeline") {
      const lanes = Array.from(new Set(nodes.map((node) => getDomainForField(node.fields?.[0] || "")))).sort();
      return new Map(nodes.map((node) => {
        const laneIndex = Math.max(0, lanes.indexOf(getDomainForField(node.fields?.[0] || "")));
        return [
          node.id,
          {
            x: xForYear(node.birth),
            y: height * 0.16 + ((laneIndex + 0.5) * height * 0.68) / Math.max(1, lanes.length),
          },
        ];
      }));
    }

    if (mode === "ego" && selectedId) {
      const depths = getGraphDepths(nodes);
      const byDepth = new Map<number, SimulatedNode[]>();
      nodes.forEach((node) => {
        const depth = depths.get(node.id) ?? 4;
        const bucket = Math.min(depth, 4);
        byDepth.set(bucket, [...(byDepth.get(bucket) || []), node]);
      });

      return new Map(nodes.map((node) => {
        const depth = Math.min(depths.get(node.id) ?? 4, 4);
        if (node.id === selectedId) return [node.id, { x: width / 2, y: height / 2 }];
        const bucket = byDepth.get(depth) || [node];
        const index = Math.max(0, bucket.findIndex((item) => item.id === node.id));
        const angle = (index / Math.max(1, bucket.length)) * Math.PI * 2 + depth * 0.35;
        const radius = Math.min(width, height) * (0.14 + depth * 0.1);
        return [node.id, { x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius }];
      }));
    }

    if (mode === "lineage") {
      const incoming = new Set(graphEdges.filter((edge) => edge.target === selectedId).map((edge) => edge.source));
      const outgoing = new Set(graphEdges.filter((edge) => edge.source === selectedId).map((edge) => edge.target));
      return new Map(nodes.map((node) => {
        const y = node.id === selectedId
          ? height * 0.5
          : incoming.has(node.id)
          ? height * 0.28
          : outgoing.has(node.id)
          ? height * 0.68
          : height * 0.82;
        return [node.id, { x: xForYear(node.birth), y }];
      }));
    }

    if (mode === "concept") {
      const keys = Array.from(new Set(nodes.map(getConceptKey))).sort();
      const centers = getGridCenters(keys, width, height);
      return new Map(nodes.map((node) => [node.id, centers.get(getConceptKey(node)) || { x: width / 2, y: height / 2 }]));
    }

    return new Map(nodes.map((node) => [node.id, { x: width / 2, y: height / 2 }]));
  };

  const { graphPeople, graphEdges, visibleTotal } = useMemo(() => {
    if (!selectedId || effectiveFocusDepth === "all") {
      return { graphPeople: people, graphEdges: edges, visibleTotal: people.length };
    }

    const visibleIds = new Set<string>([selectedId]);
    const queue: { id: string; depth: number }[] = [{ id: selectedId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= effectiveFocusDepth) continue;

      edges.forEach((edge) => {
        const neighbor =
          edge.source === current.id
            ? edge.target
            : edge.target === current.id
            ? edge.source
            : null;

        if (neighbor && !visibleIds.has(neighbor)) {
          visibleIds.add(neighbor);
          queue.push({ id: neighbor, depth: current.depth + 1 });
        }
      });
    }

    if (highlightPath) {
      highlightPath.forEach((id) => visibleIds.add(id));
    }

    const graphPeople = people.filter((person) => visibleIds.has(person.id));
    const graphEdges = edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
    return { graphPeople, graphEdges, visibleTotal: graphPeople.length };
  }, [edges, effectiveFocusDepth, highlightPath, people, selectedId]);
  const isDenseOverview = graphPeople.length > 180;
  const showOverviewNavigator = graphPeople.length > 0;

  // Init & update nodes/links
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = containerRef.current?.clientWidth || 600;
    const height = containerRef.current?.clientHeight || 260;

    const nodeIds = new Set(graphPeople.map((p) => p.id));

    // Preserve previous positions if already simulated for fluid changes
    const previousMap = new Map<string, SimulatedNode>(nodesRef.current.map((n) => [n.id, n]));

    const newNodes: SimulatedNode[] = graphPeople.map((p) => {
      const prev = previousMap.get(p.id);
      return {
        ...p,
        x: prev?.x ?? width / 2 + (Math.random() - 0.5) * 120,
        y: prev?.y ?? height / 2 + (Math.random() - 0.5) * 120,
        vx: prev?.vx,
        vy: prev?.vy,
        r: 5 + (p.bridge_score ?? 2) * 1.5,
      };
    });

    const newLinks: SimulatedLink[] = graphEdges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => {
        const sourceNode = newNodes.find((n) => n.id === e.source)!;
        const targetNode = newNodes.find((n) => n.id === e.target)!;
        return {
          source: sourceNode,
          target: targetNode,
          strength: e.strength || 3,
          type: e.type,
          confidence: e.confidence,
          sourceClaims: e.sourceClaims,
          claimIds: e.claimIds,
          status: e.status,
        };
      });

    nodesRef.current = newNodes;
    linksRef.current = newLinks;
    clusterCentersRef.current = getClusterCenters(newNodes, width, height, clusterMode);
    layoutTargetsRef.current = getLayoutTargets(newNodes, width, height, layoutMode, clusterMode);

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = d3.forceSimulation<SimulatedNode, SimulatedLink>(newNodes)
      .force("link", d3.forceLink<SimulatedNode, SimulatedLink>(newLinks).id((d) => d.id).distance(75).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimulatedNode>().radius((d) => d.r + 8).iterations(3))
      .force("x", d3.forceX<SimulatedNode>((d) => layoutTargetsRef.current.get(d.id)?.x ?? width / 2).strength(layoutMode === "force" && clusterMode === "none" ? 0.04 : 0.16))
      .force("y", d3.forceY<SimulatedNode>((d) => layoutTargetsRef.current.get(d.id)?.y ?? height / 2).strength(layoutMode === "force" && clusterMode === "none" ? 0.04 : 0.16));

    sim.on("tick", draw);
    simulationRef.current = sim;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    draw();

    return () => {
      sim.stop();
    };
  }, [graphPeople, graphEdges, clusterMode, layoutMode]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const width = containerRef.current?.clientWidth || 600;
      const height = containerRef.current?.clientHeight || 260;

      if (canvas) {
        const ratio = window.devicePixelRatio || 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        if (simulationRef.current) {
          clusterCentersRef.current = getClusterCenters(nodesRef.current, width, height, clusterMode);
          layoutTargetsRef.current = getLayoutTargets(nodesRef.current, width, height, layoutMode, clusterMode);
          simulationRef.current.force("center", d3.forceCenter(width / 2, height / 2));
          simulationRef.current.force("x", d3.forceX<SimulatedNode>((d) => layoutTargetsRef.current.get(d.id)?.x ?? width / 2).strength(layoutMode === "force" && clusterMode === "none" ? 0.04 : 0.16));
          simulationRef.current.force("y", d3.forceY<SimulatedNode>((d) => layoutTargetsRef.current.get(d.id)?.y ?? height / 2).strength(layoutMode === "force" && clusterMode === "none" ? 0.04 : 0.16));
          simulationRef.current.alpha(0.3).restart();
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clusterMode, layoutMode]);

  const getGraphBounds = () => {
    const positionedNodes = nodesRef.current.filter((node) => node.x !== undefined && node.y !== undefined);
    if (positionedNodes.length === 0) return null;

    const minX = Math.min(...positionedNodes.map((node) => node.x!));
    const maxX = Math.max(...positionedNodes.map((node) => node.x!));
    const minY = Math.min(...positionedNodes.map((node) => node.y!));
    const maxY = Math.max(...positionedNodes.map((node) => node.y!));
    const pad = 32;
    return {
      minX: minX - pad,
      maxX: maxX + pad,
      minY: minY - pad,
      maxY: maxY + pad,
    };
  };

  const getMinimapProjection = (width: number, height: number) => {
    const bounds = getGraphBounds();
    if (!bounds) return null;

    const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
    const graphHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(width / graphWidth, height / graphHeight);
    const offsetX = (width - graphWidth * scale) / 2;
    const offsetY = (height - graphHeight * scale) / 2;

    return {
      bounds,
      mapX: (x: number) => offsetX + (x - bounds.minX) * scale,
      mapY: (y: number) => offsetY + (y - bounds.minY) * scale,
      invertX: (x: number) => bounds.minX + (x - offsetX) / scale,
      invertY: (y: number) => bounds.minY + (y - offsetY) / scale,
    };
  };

  const fitGraphToViewport = () => {
    const canvas = canvasRef.current;
    const bounds = getGraphBounds();
    if (!canvas || !bounds) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
    const graphHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.max(0.15, Math.min(2, Math.min(width / graphWidth, height / graphHeight) * 0.86));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    transformRef.current = new d3.ZoomTransform(
      scale,
      width / 2 - centerX * scale,
      height / 2 - centerY * scale
    );
    draw();
  };

  const drawMinimap = () => {
    const minimap = minimapCanvasRef.current;
    const canvas = canvasRef.current;
    if (!showOverviewNavigator || !minimap || !canvas || nodesRef.current.length === 0) return;

    const ratio = window.devicePixelRatio || 1;
    const width = minimap.clientWidth || 160;
    const height = minimap.clientHeight || 96;
    minimap.width = width * ratio;
    minimap.height = height * ratio;

    const ctx = minimap.getContext("2d");
    if (!ctx) return;

    const projection = getMinimapProjection(width, height);
    if (!projection) return;

    ctx.clearRect(0, 0, minimap.width, minimap.height);
    ctx.save();
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "rgba(9, 11, 16, 0.92)";
    ctx.fillRect(0, 0, width, height);

    if (!isDenseOverview) linksRef.current.forEach((link) => {
      if (link.source.x === undefined || link.source.y === undefined || link.target.x === undefined || link.target.y === undefined) return;
      ctx.beginPath();
      ctx.moveTo(projection.mapX(link.source.x), projection.mapY(link.source.y));
      ctx.lineTo(projection.mapX(link.target.x), projection.mapY(link.target.y));
      ctx.strokeStyle = link.status === "suggested" ? "rgba(56, 189, 248, 0.18)" : "rgba(148, 163, 184, 0.14)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    });

    nodesRef.current.forEach((node) => {
      if (node.x === undefined || node.y === undefined) return;
      const isSelected = node.id === selectedId;
      ctx.beginPath();
      ctx.arc(projection.mapX(node.x), projection.mapY(node.y), isSelected ? 3 : isDenseOverview ? 1.2 : 1.7, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#ffffff" : FIELD_COLOR[node.fields?.[0]] || "#94a3b8";
      ctx.globalAlpha = isSelected ? 1 : isDenseOverview ? 0.58 : 0.72;
      ctx.fill();
    });

    const t = transformRef.current;
    const mainWidth = canvas.width / ratio;
    const mainHeight = canvas.height / ratio;
    const viewMinX = -t.x / t.k;
    const viewMinY = -t.y / t.k;
    const viewMaxX = (mainWidth - t.x) / t.k;
    const viewMaxY = (mainHeight - t.y) / t.k;
    const vx = projection.mapX(viewMinX);
    const vy = projection.mapY(viewMinY);
    const vw = projection.mapX(viewMaxX) - vx;
    const vh = projection.mapY(viewMaxY) - vy;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(155, 218, 255, 0.75)";
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(ratio, ratio);

    // Apply Zoom / Pan Matrix transform
    const t = transformRef.current;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    if (clusterMode !== "none" && layoutMode === "force") {
      clusterCentersRef.current.forEach((center, key) => {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(center.x, center.y, 48, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(123, 156, 245, 0.035)";
        ctx.fill();
        ctx.strokeStyle = "rgba(123, 156, 245, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(156, 177, 220, 0.5)";
        ctx.font = "600 8px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(key.slice(0, 28), center.x, center.y - 54);
        ctx.restore();
      });
    }

    if (layoutMode !== "force") {
      ctx.save();
      ctx.fillStyle = "rgba(156, 177, 220, 0.45)";
      ctx.font = "600 8px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      const label =
        layoutMode === "timeline"
          ? "Timeline projection: birth year -> horizontal position"
          : layoutMode === "ego"
          ? "Ego network: rings show distance from current focus"
          : layoutMode === "lineage"
          ? "Lineage tree: predecessors above, successors below"
          : "Concept neighborhood: shared topics gather locally";
      ctx.fillText(label, 16, 22);

      if (layoutMode === "lineage") {
        [
          ["Influenced by", height * 0.28],
          ["Focus", height * 0.5],
          ["Influences", height * 0.68],
        ].forEach(([bandLabel, y]) => {
          ctx.beginPath();
          ctx.moveTo(12, Number(y));
          ctx.lineTo(width - 12, Number(y));
          ctx.strokeStyle = "rgba(123, 156, 245, 0.08)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillText(String(bandLabel), 16, Number(y) - 5);
        });
      }
      ctx.restore();
    }

    // Build active context sets for selective dimming
    const activeSet = new Set<string>();
    const isAnySelected = selectedId !== null || (highlightPath && highlightPath.length > 0);
    
    if (selectedId) {
      activeSet.add(selectedId);
      linksRef.current.forEach((l) => {
        if (l.source.id === selectedId) {
          activeSet.add(l.target.id);
        }
        if (l.target.id === selectedId) {
          activeSet.add(l.source.id);
        }
      });
    }
    if (highlightPath) {
      highlightPath.forEach((id) => activeSet.add(id));
    }

    const focusSet = new Set<string>();
    const focusDepthById = new Map<string, number>();
    if (selectedId && effectiveFocusDepth !== "all") {
      focusSet.add(selectedId);
      focusDepthById.set(selectedId, 0);
      const queue: { id: string; depth: number }[] = [{ id: selectedId, depth: 0 }];
      const visited = new Set<string>([selectedId]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth >= effectiveFocusDepth) continue;

        linksRef.current.forEach((link) => {
          const neighbor =
            link.source.id === current.id
              ? link.target.id
              : link.target.id === current.id
              ? link.source.id
              : null;

          if (neighbor && !visited.has(neighbor)) {
            visited.add(neighbor);
            focusSet.add(neighbor);
            const nextDepth = current.depth + 1;
            focusDepthById.set(neighbor, nextDepth);
            queue.push({ id: neighbor, depth: nextDepth });
          }
        });
      }
    }
    if (highlightPath) {
      highlightPath.forEach((id) => focusSet.add(id));
    }
    const shouldLimitFocus = focusSet.size > 0;
    const highlightedEdgeKeys = new Set<string>();
    if (highlightPath) {
      for (let i = 0; i < highlightPath.length - 1; i += 1) {
        highlightedEdgeKeys.add(`${highlightPath[i]}->${highlightPath[i + 1]}`);
      }
    }
    const getDepthContextAlpha = (depth: number) => {
      if (depth <= 1) return 1;
      if (depth === 2) return 0.58;
      return 0.34;
    };

    // Helper to calculate coordinates along quadratic bezier curves
    const getQuadraticPoint = (valT: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
      const mt = 1 - valT;
      const mt2 = mt * mt;
      const t2 = valT * valT;
      return {
        x: mt2 * x0 + 2 * mt * valT * x1 + t2 * x2,
        y: mt2 * y0 + 2 * mt * valT * y1 + t2 * y2
      };
    };

    // 1. Draw Links
    linksRef.current.forEach((l) => {
      if (shouldLimitFocus && (!focusSet.has(l.source.id) || !focusSet.has(l.target.id))) {
        return;
      }

      const isSourceSelected = l.source.id === selectedId;
      const isTargetSelected = l.target.id === selectedId;
      const isEdgeActive = isSourceSelected || isTargetSelected;
      const inHighlightPath = highlightedEdgeKeys.has(`${l.source.id}->${l.target.id}`);
      const sourceDepth = focusDepthById.get(l.source.id);
      const targetDepth = focusDepthById.get(l.target.id);
      const focusEdgeDepth = Math.max(sourceDepth ?? 0, targetDepth ?? 0);
      const isFocusedContextEdge =
        Boolean(selectedId) &&
        focusDepth !== "all" &&
        focusDepth !== 1 &&
        shouldLimitFocus &&
        !isEdgeActive &&
        sourceDepth !== undefined &&
        targetDepth !== undefined &&
        focusEdgeDepth > 0;
      const edgeVisual = getEdgeVisualState(l);

      ctx.save();
      // Faint out inactive lines if there's a selection
      if (isAnySelected && !isEdgeActive && !inHighlightPath) {
        ctx.globalAlpha = isFocusedContextEdge ? getDepthContextAlpha(focusEdgeDepth) : 0.28;
      }
      if (edgeVisual.isSuggested && !isEdgeActive && !inHighlightPath) {
        ctx.globalAlpha *= 0.78;
      }
      ctx.setLineDash(edgeVisual.dash);

      ctx.beginPath();
      ctx.moveTo(l.source.x!, l.source.y!);

      // Curved link flow representation
      const mx = (l.source.x! + l.target.x!) / 2;
      const my = (l.source.y! + l.target.y!) / 2 - 12;
      ctx.quadraticCurveTo(mx, my, l.target.x!, l.target.y!);

      if (inHighlightPath) {
        ctx.strokeStyle = "rgba(232, 184, 75, 0.9)";
        ctx.lineWidth = edgeVisual.isSuggested ? 2 : 2.4;
      } else if (isEdgeActive) {
        ctx.strokeStyle = edgeVisual.isSuggested
          ? "rgba(56, 189, 248, 0.78)"
          : edgeVisual.needsSource || edgeVisual.lowConfidence
          ? "rgba(251, 191, 36, 0.72)"
          : isSourceSelected ? "rgba(123, 156, 245, 0.9)" : "rgba(167, 139, 250, 0.9)";
        ctx.lineWidth = edgeVisual.isSuggested ? 1.25 : 1.8;
      } else if (isFocusedContextEdge) {
        const focusWeight = focusEdgeDepth === 2 ? 1.2 : 1;
        ctx.strokeStyle = edgeVisual.isSuggested ? "rgba(56, 189, 248, 0.48)" : "rgba(123, 156, 245, 0.58)";
        ctx.lineWidth = (edgeVisual.isSuggested ? 0.7 : 0.9) * focusWeight;
      } else {
        ctx.strokeStyle = edgeVisual.isSuggested
          ? "rgba(56, 189, 248, 0.14)"
          : edgeVisual.needsSource || edgeVisual.lowConfidence
          ? "rgba(251, 191, 36, 0.1)"
          : "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = edgeVisual.isSuggested ? 0.55 : 0.6;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Indicator arrow flow
      if (isEdgeActive || inHighlightPath || isFocusedContextEdge) {
        const angle = Math.atan2(l.target.y! - my, l.target.x! - mx);
        const arrowLength = isFocusedContextEdge ? 4.5 : 6;
        ctx.fillStyle = inHighlightPath
          ? "rgba(232, 184, 75, 0.95)"
          : edgeVisual.isSuggested
          ? "rgba(56, 189, 248, 0.7)"
          : edgeVisual.needsSource || edgeVisual.lowConfidence
          ? "rgba(251, 191, 36, 0.72)"
          : isFocusedContextEdge
          ? focusEdgeDepth === 2 ? "rgba(123, 156, 245, 0.68)" : "rgba(123, 156, 245, 0.45)"
          : "rgba(123, 156, 245, 0.95)";
        ctx.beginPath();
        const startX = l.target.x! - l.target.r * Math.cos(angle);
        const startY = l.target.y! - l.target.r * Math.sin(angle);
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX - arrowLength * Math.cos(angle - 0.4), startY - arrowLength * Math.sin(angle - 0.4));
        ctx.lineTo(startX - arrowLength * Math.cos(angle + 0.4), startY - arrowLength * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // ── Directional Flow Particles Animation ──
      if (isAnySelected && (isEdgeActive || inHighlightPath || isFocusedContextEdge)) {
        const numParticles = isFocusedContextEdge ? 1 : 2;
        const col = FIELD_COLOR[l.source.fields?.[0]] || "#7b9cf5";
        for (let i = 0; i < numParticles; i++) {
          const pT = (animTimeRef.current + (i / numParticles)) % 1.0;
          const pt = getQuadraticPoint(pT, l.source.x!, l.source.y!, mx, my, l.target.x!, l.target.y!);
          
          ctx.save();
          if (isFocusedContextEdge && !inHighlightPath) {
            ctx.globalAlpha = focusEdgeDepth === 2 ? 0.58 : 0.32;
          }
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isFocusedContextEdge ? 1.5 : 2.2, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = col;
          ctx.shadowBlur = isFocusedContextEdge ? 3 : 6;
          ctx.fill();
          ctx.restore();
        }
      }
    });

    // 2. Draw Nodes
    nodesRef.current.forEach((n) => {
      if (shouldLimitFocus && !focusSet.has(n.id)) {
        return;
      }

      const col = FIELD_COLOR[n.fields?.[0]] || "#94a3b8";
      const isSelected = n.id === selectedId;
      const inHighlightPath = highlightPath && highlightPath.includes(n.id);
      const isHover = hoveredNode?.id === n.id;
      const focusDepth = focusDepthById.get(n.id);

      ctx.save();
      // Faint out inactive nodes if there's a selection
      if (isAnySelected && !activeSet.has(n.id)) {
        ctx.globalAlpha = focusDepth !== undefined ? getDepthContextAlpha(focusDepth) : 0.38;
      }

      // Outer rings representation (Premium glowing halo aura!)
      if (isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, n.r + 6, 0, Math.PI * 2);
        ctx.fillStyle = col + "15";
        ctx.fill();
        ctx.shadowColor = col;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(n.x!, n.y!, n.r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected || inHighlightPath || isHover ? col : col + "af";
      ctx.fill();

      // Outline
      ctx.strokeStyle = isSelected ? "#ffffff" : inHighlightPath ? "#e8b84b" : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = isSelected ? 1.8 : 1;
      ctx.stroke();

      // Context labels rendering
      const isImportantBridge = (n.bridge_score ?? 1) >= 4;
      const isNearbyFocusNode = selectedId ? activeSet.has(n.id) : false;
      const isSmallGraph = nodesRef.current.length <= 35;
      const isMediumGraph = nodesRef.current.length <= 120;
      const shouldShowLabel =
        isSelected ||
        inHighlightPath ||
        isHover ||
        labelDensity === "all" ||
        (labelDensity === "more" && (isNearbyFocusNode || isImportantBridge || isMediumGraph)) ||
        (labelDensity === "key" && (isImportantBridge || (isSmallGraph && isNearbyFocusNode)));

      if (shouldShowLabel) {
        ctx.fillStyle = isSelected ? "#ffffff" : inHighlightPath ? "#e8b84b" : "rgba(255, 255, 255, 0.75)";
        ctx.font = `${isSelected ? "600" : "500"} 8px 'IBM Plex Mono', monospace`;
        ctx.textAlign = "left";
        const shortName = n.name.split(" ").slice(-1)[0];
        ctx.fillText(shortName, n.x! + n.r + 4, n.y! + 3);
      }
      ctx.restore();
    });

    ctx.restore();
    drawMinimap();
  };

  // Animation frame effect hook for glowing traveling flows
  useEffect(() => {
    const renderAnim = () => {
      animTimeRef.current = (animTimeRef.current + 0.006) % 1.0;
      draw();
      requestRef.current = requestAnimationFrame(renderAnim);
    };

    if (selectedId || (highlightPath && highlightPath.length > 0)) {
      requestRef.current = requestAnimationFrame(renderAnim);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      draw();
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [selectedId, highlightPath, effectiveFocusDepth, clusterMode, labelDensity]);

  useEffect(() => {
    if (effectiveFocusDepth === "all") {
      fitGraphToViewport();
      const settleTimer = window.setTimeout(fitGraphToViewport, 450);
      return () => window.clearTimeout(settleTimer);
    }

    if (!selectedId) return;

    const centerSelectedNode = () => {
      const canvas = canvasRef.current;
      const selectedNode = nodesRef.current.find((node) => node.id === selectedId);
      if (!canvas || !selectedNode || selectedNode.x === undefined || selectedNode.y === undefined) return;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const currentK = transformRef.current.k;
      const nextK = Math.max(1.05, Math.min(2.2, currentK));

      transformRef.current = new d3.ZoomTransform(
        nextK,
        width / 2 - selectedNode.x * nextK,
        height / 2 - selectedNode.y * nextK
      );
      draw();
    };

    centerSelectedNode();
    const settleTimer = window.setTimeout(centerSelectedNode, 350);
    return () => window.clearTimeout(settleTimer);
  }, [selectedId, graphPeople, effectiveFocusDepth, layoutMode]);

  // Convert client coordinate into Graph Coordinate space
  const screenToGraph = (sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;
    return {
      x: (sx - rect.left - t.x) / t.k,
      y: (sy - rect.top - t.y) / t.k,
    };
  };

  // Drag listeners
  const dragSubjectRef = useRef<SimulatedNode | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = screenToGraph(e.clientX, e.clientY);
    const hit = nodesRef.current.find(
      (n) => Math.hypot(n.x! - pos.x, n.y! - pos.y) < n.r + 5
    );

    if (hit) {
      dragSubjectRef.current = hit;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      hit.fx = hit.x;
      hit.fy = hit.y;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0.3).restart();
      }
    } else {
      // Setup background panning
      const startX = e.clientX;
      const startY = e.clientY;
      const startTransformX = transformRef.current.x;
      const startTransformY = transformRef.current.y;

      const handlePanMove = (event: MouseEvent) => {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        transformRef.current = new d3.ZoomTransform(
          transformRef.current.k,
          startTransformX + dx,
          startTransformY + dy
        );
        draw();
      };

      const handlePanUp = () => {
        window.removeEventListener("mousemove", handlePanMove);
        window.removeEventListener("mouseup", handlePanUp);
      };

      window.addEventListener("mousemove", handlePanMove);
      window.addEventListener("mouseup", handlePanUp);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = screenToGraph(e.clientX, e.clientY);

    if (dragSubjectRef.current) {
      const canvas = canvasRef.current;
      const ratio = window.devicePixelRatio || 1;
      const width = canvas ? canvas.width / ratio : 600;
      const height = canvas ? canvas.height / ratio : 260;
      const clampedPos = clampGraphPointToViewport(pos, width, height, dragSubjectRef.current.r);
      dragSubjectRef.current.fx = clampedPos.x;
      dragSubjectRef.current.fy = clampedPos.y;
      return;
    }

    // Node Hovering
    const hit = nodesRef.current.find(
      (n) => Math.hypot(n.x! - pos.x, n.y! - pos.y) < n.r + 5
    );

    if (hit) {
      setHoveredNode(hit);
      setTooltipPos({ x: e.clientX + 16, y: e.clientY - 12 });
    } else {
      setHoveredNode(null);
    }
    draw();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragSubjectRef.current) {
      const start = dragStartPosRef.current;
      const dist = start ? Math.hypot(e.clientX - start.x, e.clientY - start.y) : 0;
      if (dist < 4) {
        onSelect(dragSubjectRef.current.id);
      }

      dragSubjectRef.current.fx = null;
      dragSubjectRef.current.fy = null;
      dragSubjectRef.current = null;
      dragStartPosRef.current = null;
      if (simulationRef.current) {
        simulationRef.current.alphaTarget(0);
      }
    } else {
      // Check for simple selection tap
      const pos = screenToGraph(e.clientX, e.clientY);
      const hit = nodesRef.current.find(
        (n) => Math.hypot(n.x! - pos.x, n.y! - pos.y) < n.r + 6
      );
      if (hit) {
        onSelect(hit.id);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextK = Math.max(0.15, Math.min(8.0, transformRef.current.k * factor));

    const nextX = mx - (mx - transformRef.current.x) * nextK / transformRef.current.k;
    const nextY = my - (my - transformRef.current.y) * nextK / transformRef.current.k;

    transformRef.current = new d3.ZoomTransform(nextK, nextX, nextY);
    draw();
  };

  const handleMinimapClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const minimap = minimapCanvasRef.current;
    const canvas = canvasRef.current;
    if (!minimap || !canvas) return;

    const rect = minimap.getBoundingClientRect();
    const projection = getMinimapProjection(rect.width, rect.height);
    if (!projection) return;

    const graphX = projection.invertX(event.clientX - rect.left);
    const graphY = projection.invertY(event.clientY - rect.top);
    const ratio = window.devicePixelRatio || 1;
    const mainWidth = canvas.width / ratio;
    const mainHeight = canvas.height / ratio;
    const currentK = transformRef.current.k;

    transformRef.current = new d3.ZoomTransform(
      currentK,
      mainWidth / 2 - graphX * currentK,
      mainHeight / 2 - graphY * currentK
    );
    draw();
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#0d0e12] relative overflow-hidden select-none border border-[#252a3d] rounded-lg"
    >
      <div className="absolute top-2.5 left-3.5 font-mono text-[9px] text-slate-500 uppercase tracking-widest pointer-events-none z-10 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Influence Network ({visibleTotal})
      </div>

      <div className="absolute top-8 left-3.5 z-10 flex items-center gap-1 bg-[#141721]/90 border border-[#252a3d] rounded-md p-1">
        {([1, 2, 3, "all"] as const).map((depth) => (
          <button
            key={depth}
            data-testid={`network-hop-${depth}`}
            onClick={() => {
              setFocusDepth(depth);
              requestAnimationFrame(draw);
            }}
            className={`px-2 py-0.5 text-[9px] font-mono rounded cursor-pointer transition-colors ${
              effectiveFocusDepth === depth
                ? "bg-[#7b9cf5]/20 text-[#9bdaff]"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            {depth === "all" ? "All" : `${depth} hop`}
          </button>
        ))}
      </div>

      <div className="absolute top-8 right-2.5 z-10 flex max-w-[calc(100%-11rem)] items-center gap-1 overflow-x-auto scrollbar-thin bg-[#141721]/90 border border-[#252a3d] rounded-md p-1">
        {([
          ["none", "Free"],
          ["domain", "Domain"],
          ["movement", "Movement"],
          ["era", "Era"],
          ["institution", "Institution"],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => {
              setClusterMode(mode);
              if (simulationRef.current) simulationRef.current.alpha(0.8).restart();
            }}
            className={`shrink-0 px-2 py-0.5 text-[9px] font-mono rounded cursor-pointer transition-colors ${
              clusterMode === mode
                ? "bg-amber-400/15 text-amber-200"
                : "text-slate-500 hover:text-slate-200"
            }`}
            title={`Cluster graph by ${label.toLowerCase()}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        data-testid="network-layout-toolbar"
        className="absolute top-[3.9rem] left-3.5 z-10 flex max-w-[min(32rem,calc(100%-2rem))] items-center gap-1 overflow-x-auto scrollbar-thin bg-[#10131d]/90 border border-[#252a3d] rounded-md p-1"
      >
        {([
          ["force", "Force"],
          ["timeline", "Timeline"],
          ["ego", "Ego"],
          ["lineage", "Lineage"],
          ["concept", "Concept"],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            data-testid={`network-layout-${mode}`}
            onClick={() => {
              setLayoutMode(mode);
              if (simulationRef.current) simulationRef.current.alpha(0.9).restart();
            }}
            disabled={(mode === "ego" || mode === "lineage") && !selectedId}
            className={`shrink-0 px-2 py-0.5 text-[9px] font-mono rounded cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
              layoutMode === mode
                ? "bg-[#7b9cf5]/20 text-[#9bdaff]"
                : "text-slate-500 hover:text-slate-200"
            }`}
            title={`${label} graph layout`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="absolute top-[6.05rem] left-3.5 z-10 flex max-w-[calc(100%-2rem)] items-center gap-1 overflow-x-auto scrollbar-thin rounded-md border border-[#252a3d] bg-[#10131d]/90 p-1">
        <span className="shrink-0 px-1.5 font-mono text-[8.5px] uppercase tracking-wider text-slate-600">Labels</span>
        {([
          ["focus", "Focus"],
          ["key", "Key"],
          ["more", "More"],
          ["all", "All"],
        ] as const).map(([density, label]) => (
          <button
            key={density}
            data-testid={`network-label-${density}`}
            onClick={() => {
              setLabelDensity(density);
              requestAnimationFrame(draw);
            }}
            className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-mono transition-colors cursor-pointer ${
              labelDensity === density
                ? "bg-cyan-400/15 text-cyan-200"
                : "text-slate-500 hover:text-slate-200"
            }`}
            title={`${label} label density`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 z-10">
        <button
          onClick={() => {
            if (simulationRef.current) {
              simulationRef.current.alpha(1).restart();
            }
          }}
          className="px-2 py-1 text-[9px] font-mono border border-[#252a3d] bg-[#141721] text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
        >
          Re-align
        </button>
        <button
          onClick={() => {
            transformRef.current = d3.zoomIdentity;
            draw();
          }}
          className="px-2 py-1 text-[9px] font-mono border border-[#252a3d] bg-[#141721] text-slate-400 hover:text-slate-100 rounded transition-colors cursor-pointer"
        >
          Reset View
        </button>
      </div>

      {showOverviewNavigator && (
      <div className="absolute bottom-10 left-3.5 z-10 hidden rounded-md border border-[#252a3d] bg-[#10131d]/90 p-1 shadow-lg shadow-black/30 sm:block">
        <div className="mb-0.5 flex items-center justify-between gap-3 px-1 font-mono text-[8px] uppercase tracking-wider text-slate-600">
          <span>{isDenseOverview ? "Dense Overview" : "Overview"}</span>
          <span>{graphPeople.length}</span>
        </div>
        <canvas
          ref={minimapCanvasRef}
          onClick={handleMinimapClick}
          width={160}
          height={96}
          className="block h-24 w-40 cursor-crosshair rounded border border-[#1d2232]"
          title="Click overview to recenter graph"
        />
      </div>
      )}

      {showOverviewNavigator && (
      <div className="absolute bottom-2.5 left-3.5 z-10 hidden items-center gap-2 rounded-md border border-[#252a3d] bg-[#10131d]/90 px-2 py-1 font-mono text-[8.5px] text-slate-500 sm:flex">
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-5 bg-[#7b9cf5]" />
          Confirmed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-5 border-t border-dashed border-cyan-300" />
          Suggested
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-px w-5 border-t border-dotted border-amber-300" />
          Needs source
        </span>
      </div>
      )}

      <canvas
        data-testid="network-canvas"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="block w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Node Tooltip rendering */}
      {hoveredNode && (
        <div
          className="fixed z-50 bg-[#141721] border border-[#252a3d] rounded-lg p-2.5 shadow-2xl max-w-[200px] pointer-events-none"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: "translateY(-100%)",
          }}
        >
          <div className="font-serif text-xs font-bold text-slate-100 mb-0.5">{hoveredNode.name}</div>
          <div className="text-[9px] font-mono tracking-wide" style={{ color: FIELD_COLOR[hoveredNode.fields?.[0]] }}>
            {hoveredNode.fields?.join(", ")}
          </div>
          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
            Legacy score: {hoveredNode.bridge_score}/5
          </div>
        </div>
      )}
    </div>
  );
}
