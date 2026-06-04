import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Thinker, InfluenceEdge } from "../types";
import { FIELD_COLOR, INITIAL_INSTITUTIONS_DATA } from "../data";
import { getDomainForField } from "../taxonomy";

type GraphClusterMode = "none" | "domain" | "movement" | "era" | "institution";

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
}

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

  const simulationRef = useRef<d3.Simulation<SimulatedNode, SimulatedLink> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<SimulatedNode[]>([]);
  const linksRef = useRef<SimulatedLink[]>([]);
  const requestRef = useRef<number | null>(null);
  const animTimeRef = useRef<number>(0);
  const clusterCentersRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const [hoveredNode, setHoveredNode] = useState<SimulatedNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [focusDepth, setFocusDepth] = useState<"all" | 1 | 2 | 3>(1);
  const [clusterMode, setClusterMode] = useState<GraphClusterMode>("none");
  const effectiveFocusDepth = coordinatedFocusDepth ?? focusDepth;

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
        };
      });

    nodesRef.current = newNodes;
    linksRef.current = newLinks;
    clusterCentersRef.current = getClusterCenters(newNodes, width, height, clusterMode);

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = d3.forceSimulation<SimulatedNode, SimulatedLink>(newNodes)
      .force("link", d3.forceLink<SimulatedNode, SimulatedLink>(newLinks).id((d) => d.id).distance(75).strength(0.35))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimulatedNode>().radius((d) => d.r + 8).iterations(3))
      .force("x", d3.forceX<SimulatedNode>((d) => clusterCentersRef.current.get(getClusterKey(d))?.x ?? width / 2).strength(clusterMode === "none" ? 0.04 : 0.14))
      .force("y", d3.forceY<SimulatedNode>((d) => clusterCentersRef.current.get(getClusterKey(d))?.y ?? height / 2).strength(clusterMode === "none" ? 0.04 : 0.14));

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
  }, [graphPeople, graphEdges, clusterMode]);

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
          simulationRef.current.force("center", d3.forceCenter(width / 2, height / 2));
          simulationRef.current.force("x", d3.forceX<SimulatedNode>((d) => clusterCentersRef.current.get(getClusterKey(d))?.x ?? width / 2).strength(clusterMode === "none" ? 0.04 : 0.14));
          simulationRef.current.force("y", d3.forceY<SimulatedNode>((d) => clusterCentersRef.current.get(getClusterKey(d))?.y ?? height / 2).strength(clusterMode === "none" ? 0.04 : 0.14));
          simulationRef.current.alpha(0.3).restart();
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clusterMode]);

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

    if (clusterMode !== "none") {
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

      ctx.save();
      // Faint out inactive lines if there's a selection
      if (isAnySelected && !isEdgeActive && !inHighlightPath) {
        ctx.globalAlpha = 0.28;
      }

      ctx.beginPath();
      ctx.moveTo(l.source.x!, l.source.y!);

      // Curved link flow representation
      const mx = (l.source.x! + l.target.x!) / 2;
      const my = (l.source.y! + l.target.y!) / 2 - 12;
      ctx.quadraticCurveTo(mx, my, l.target.x!, l.target.y!);

      if (inHighlightPath) {
        ctx.strokeStyle = "rgba(232, 184, 75, 0.9)";
        ctx.lineWidth = 2.4;
      } else if (isEdgeActive) {
        ctx.strokeStyle = isSourceSelected ? "rgba(123, 156, 245, 0.9)" : "rgba(167, 139, 250, 0.9)";
        ctx.lineWidth = 1.8;
      } else if (isFocusedContextEdge) {
        ctx.strokeStyle = "rgba(123, 156, 245, 0.42)";
        ctx.lineWidth = 0.9;
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 0.6;
      }
      ctx.stroke();

      // Indicator arrow flow
      if (isEdgeActive || inHighlightPath || isFocusedContextEdge) {
        const angle = Math.atan2(l.target.y! - my, l.target.x! - mx);
        const arrowLength = isFocusedContextEdge ? 4.5 : 6;
        ctx.fillStyle = inHighlightPath
          ? "rgba(232, 184, 75, 0.95)"
          : isFocusedContextEdge
          ? "rgba(123, 156, 245, 0.45)"
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
            ctx.globalAlpha = focusEdgeDepth > 2 ? 0.28 : 0.42;
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

      ctx.save();
      // Faint out inactive nodes if there's a selection
      if (isAnySelected && !activeSet.has(n.id)) {
        ctx.globalAlpha = 0.38;
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
      const shouldShowLabel = isSelected || inHighlightPath || isHover || isImportantBridge || nodesRef.current.length < 35;

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
  }, [selectedId, highlightPath, effectiveFocusDepth, clusterMode]);

  useEffect(() => {
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
  }, [selectedId, graphPeople]);

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
      dragSubjectRef.current.fx = pos.x;
      dragSubjectRef.current.fy = pos.y;
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

      <canvas
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
