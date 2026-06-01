import { useState } from "react";
import { Thinker, InfluenceEdge } from "../types";
import { FIELD_COLOR } from "../data";
import { ChevronRight, GitBranch, Info, BookOpen, Users } from "lucide-react";

interface DetailPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  people: Thinker[];
  edges: InfluenceEdge[];
  onFindContemporaries: (id: string) => void;
  onShowBFS: (id: string) => void;
}

interface GenealogyNode {
  thinker: Thinker;
  relationType?: string;
  depth: number;
}

export default function DetailPanel({
  selectedId,
  onSelect,
  people,
  edges,
  onFindContemporaries,
  onShowBFS,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"info" | "context" | "genealogy">("info");
  
  const thinker = people.find((p) => p.id === selectedId);

  if (!thinker) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#5a6480]">
        <div className="text-3xl mb-2 opacity-30">◈</div>
        <p className="font-serif italic text-sm">Select a thinker or node on the timeline or network to view intellectual lineage.</p>
      </div>
    );
  }

  const primaryField = thinker.fields?.[0] || "Philosophy";
  const col = FIELD_COLOR[primaryField] || "#94a3b8";

  // Compute inputs and outputs cleanly in real-time
  const directInfluences = edges.filter((e) => e.source === thinker.id);
  const directInfluencedBy = edges.filter((e) => e.target === thinker.id);

  const lifespan = thinker.death !== null && thinker.birth !== null 
    ? thinker.death - thinker.birth 
    : "present";

  // --- RECURSIVE GENEALOGY COMPILERS ---
  // Build a flat list with depth of ancestors up to 3 generations
  const compileAncestors = (nodeId: string, currentDepth: number, maxDepth: number, visited: Set<string>): GenealogyNode[] => {
    if (currentDepth > maxDepth) return [];
    
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const nodes: GenealogyNode[] = [];
    
    incomingEdges.forEach((edge) => {
      const parent = people.find((p) => p.id === edge.source);
      if (parent && !visited.has(parent.id)) {
        visited.add(parent.id);
        nodes.push({ thinker: parent, relationType: edge.type, depth: currentDepth });
        // Recurse
        const children = compileAncestors(parent.id, currentDepth + 1, maxDepth, visited);
        nodes.push(...children);
      }
    });
    
    return nodes;
  };

  // Build a flat list with depth of descendants up to 3 generations
  const compileDescendants = (nodeId: string, currentDepth: number, maxDepth: number, visited: Set<string>): GenealogyNode[] => {
    if (currentDepth > maxDepth) return [];
    
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    const nodes: GenealogyNode[] = [];
    
    outgoingEdges.forEach((edge) => {
      const child = people.find((p) => p.id === edge.target);
      if (child && !visited.has(child.id)) {
        visited.add(child.id);
        nodes.push({ thinker: child, relationType: edge.type, depth: currentDepth });
        // Recurse
        const children = compileDescendants(child.id, currentDepth + 1, maxDepth, visited);
        nodes.push(...children);
      }
    });
    
    return nodes;
  };

  const ancestorsList = compileAncestors(thinker.id, 1, 3, new Set([thinker.id]));
  const descendantsList = compileDescendants(thinker.id, 1, 3, new Set([thinker.id]));

  const contemporaries = people
    .filter((p) => {
      if (p.id === thinker.id) return false;
      const overlapStart = Math.max(thinker.birth, p.birth);
      const overlapEnd = Math.min(thinker.death ?? 2026, p.death ?? 2026);
      return overlapEnd - overlapStart > 20;
    })
    .sort((a, b) => {
      const overlapA = Math.min(thinker.death ?? 2026, a.death ?? 2026) - Math.max(thinker.birth, a.birth);
      const overlapB = Math.min(thinker.death ?? 2026, b.death ?? 2026) - Math.max(thinker.birth, b.birth);
      return overlapB - overlapA;
    })
    .slice(0, 8);

  const fieldPeers = people
    .filter((p) => p.id !== thinker.id && p.fields?.some((field) => thinker.fields?.includes(field)))
    .sort((a, b) => (b.bridge_score ?? 1) - (a.bridge_score ?? 1))
    .slice(0, 8);

  const eraPeers = people
    .filter((p) => p.id !== thinker.id && p.era && p.era === thinker.era)
    .sort((a, b) => Math.abs(a.birth - thinker.birth) - Math.abs(b.birth - thinker.birth))
    .slice(0, 8);

  const renderPeerButton = (peer: Thinker) => {
    const peerCol = FIELD_COLOR[peer.fields?.[0] || "Philosophy"] || "#94a3b8";
    return (
      <button
        key={peer.id}
        onClick={() => onSelect(peer.id)}
        className="px-2 py-1 bg-[#1c2030] border border-[#252a3d] hover:border-[#7b9cf5] rounded text-[10px] font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: peerCol }} />
        <span className="truncate max-w-[180px]">{peer.name}</span>
      </button>
    );
  };

  // Render a single genealogy node card
  const renderGenealogyCard = (node: GenealogyNode, direction: "up" | "down") => {
    const nodeCol = FIELD_COLOR[node.thinker.fields?.[0] || "Philosophy"] || "#94a3b8";
    
    return (
      <div 
        key={`${direction}-${node.thinker.id}-${node.depth}`}
        style={{ marginLeft: `${(node.depth - 1) * 16}px` }}
        className="group relative flex items-center gap-2 py-1.5 px-2 hover:bg-[#1a1e2d] border border-transparent hover:border-[#252a3d] rounded-md transition-all duration-150"
      >
        {/* Hierarchical connector guide lines */}
        {node.depth > 1 && (
          <div className="absolute top-0 bottom-0 -left-2 w-[1px] bg-[#252a3d] group-hover:bg-[#475175]" />
        )}
        
        <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 group-hover:text-slate-300" />
        
        <button
          onClick={() => onSelect(node.thinker.id)}
          className="text-left flex-1"
        >
          <span 
            className="font-serif font-bold text-[11.5px] hover:underline cursor-pointer"
            style={{ color: nodeCol }}
          >
            {node.thinker.name}
          </span>
          <span className="font-mono text-[8px] text-slate-500 ml-2">
            ({node.thinker.birth < 0 ? `${Math.abs(node.thinker.birth)} BCE` : node.thinker.birth})
          </span>
          {node.relationType && (
            <div className="text-[8.5px] text-slate-400 font-mono italic flex items-center gap-1 mt-0.5">
              <span>{direction === "up" ? "Influenced by" : "Influenced as"}</span>
              <span className="text-[#e2ebf5] bg-slate-800 px-1 rounded-sm text-[7.5px] not-italic">{node.relationType}</span>
              <span>at Gen {node.depth}</span>
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto flex flex-col bg-[#10121a]">
      {/* Upper Title Block */}
      <div className="px-5 pt-6 pb-4 shrink-0 border-b border-[#252a3d]">
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-1" style={{ color: col }}>
          {thinker.name}
        </h2>
        <div className="font-mono text-[10px] text-slate-400 space-x-1.5 flex flex-wrap items-center">
          <span>{thinker.birth < 0 ? `${Math.abs(thinker.birth)} BCE` : thinker.birth}</span>
          <span>&mdash;</span>
          <span>{thinker.death !== null ? (thinker.death < 0 ? `${Math.abs(thinker.death)} BCE` : thinker.death) : "present"}</span>
          <span className="text-[#5a6480]">•</span>
          <span>{lifespan} {typeof lifespan === "number" ? "years" : ""}</span>
          {thinker.region && (
            <>
              <span className="text-[#5a6480]">•</span>
              <span>{thinker.region}</span>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-[#141721] border-b border-[#252a3d] px-3">
        <button
          onClick={() => setActiveTab("info")}
          className={`px-4 py-2 text-[10px] uppercase font-mono tracking-wider font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "info"
              ? "border-[#7b9cf5] text-slate-100 bg-[#10121a]"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Info className="w-3 h-3" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("context")}
          className={`px-4 py-2 text-[10px] uppercase font-mono tracking-wider font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "context"
              ? "border-emerald-400 text-slate-100 bg-[#10121a]"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <Users className="w-3 h-3" />
          <span>Context</span>
        </button>
        <button
          onClick={() => setActiveTab("genealogy")}
          className={`relative px-4 py-2 text-[10px] uppercase font-mono tracking-wider font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "genealogy"
              ? "border-[#e8b84b] text-slate-100 bg-[#10121a]"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          <GitBranch className="w-3 h-3" />
          <span>Influences</span>
          <span className="absolute top-1.5 right-1 px-1 bg-[#e8b84b]/15 text-[#e8b84b] text-[7px] rounded-full scale-90 border border-[#e8b84b]/30">3 hop</span>
        </button>
      </div>

      {/* Main Tabbed Content Panel */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {activeTab === "info" ? (
          <div className="space-y-5">
            {/* Badges row */}
            <div className="flex flex-wrap gap-2">
              {thinker.fields?.map((f) => {
                const fCol = FIELD_COLOR[f] || "#94a3b8";
                return (
                  <span
                    key={f}
                    className="px-2.5 py-0.5 rounded text-[10px] font-mono border font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${fCol}15`,
                      borderColor: fCol,
                      color: fCol,
                    }}
                  >
                    {f}
                  </span>
                );
              })}
              {thinker.subfields?.map((sf) => (
                <span key={sf} className="px-2.5 py-0.5 rounded text-[10px] font-mono border border-slate-700 bg-slate-800 text-slate-400">
                  {sf}
                </span>
              ))}
              {thinker.era && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono border border-[#252a3d] bg-[#1c2030] text-slate-400">
                  {thinker.era}
                </span>
              )}
              {thinker.movement && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono border border-purple-500/10 bg-[#a78bfa]/10 text-[#a78bfa]">
                  {thinker.movement}
                </span>
              )}
            </div>

            {/* Legacy rating Bridge score */}
            <div className="space-y-1 pt-1.5 border-t border-[#1e2235]">
              <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider block">Historical Significance</span>
              <div className="flex gap-1.5 items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full border border-current ${
                      i < (thinker.bridge_score ?? 2) ? "" : "opacity-20"
                    }`}
                    style={{ color: col }}
                  />
                ))}
                <span className="text-[10px] font-mono text-slate-400 ml-1.5">Rating: {thinker.bridge_score}/5</span>
              </div>
            </div>

            {/* Detailed Notes */}
            {thinker.notes && (
              <div className="space-y-1">
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider block">Legacy Summary</span>
                <p className="text-slate-200 text-xs leading-relaxed font-light italic bg-[#151824] p-3 rounded-md border border-[#23283c]">
                  &ldquo;{thinker.notes}&rdquo;
                </p>
              </div>
            )}

            {/* Major works */}
            {thinker.works && thinker.works.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider block flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-amber-500" />
                  <span>Crucial Works & Discoveries</span>
                </span>
                <div className="space-y-1 bg-[#0c0d13] p-2.5 rounded-md border border-slate-900">
                  {thinker.works.map((work, idx) => (
                    <div key={idx} className="font-mono text-[10px] text-slate-300 flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">&#8728;</span>
                      <span>{work}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local Direct Influence lists */}
            <div className="space-y-4 pt-3 border-t border-[#1e2235]">
              <div>
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider block mb-2">
                  &larr; Influenced By (Immediate Predecessors)
                </span>
                {directInfluencedBy.length === 0 ? (
                  <div className="text-[10px] text-[#5a6480] italic">No directly mapped predecessors.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {directInfluencedBy.map((e) => {
                      const s = people.find((p) => p.id === e.source);
                      if (!s) return null;
                      const fieldCol = FIELD_COLOR[s.fields?.[0] || "Philosophy"] || "#94a3b8";
                      return (
                        <button
                          key={s.id}
                          onClick={() => onSelect(s.id)}
                          className="px-2 py-1 bg-[#1c2030] border border-[#252a3d] hover:border-[#7b9cf5] rounded text-[10px] font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={`${e.type}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: fieldCol }} />
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider block mb-2">
                  Influenced &arr; (Immediate Successors)
                </span>
                {directInfluences.length === 0 ? (
                  <div className="text-[10px] text-[#5a6480] italic">No directly mapped successors.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {directInfluences.map((e) => {
                      const t = people.find((p) => p.id === e.target);
                      if (!t) return null;
                      const fieldCol = FIELD_COLOR[t.fields?.[0] || "Philosophy"] || "#94a3b8";
                      return (
                        <button
                          key={t.id}
                          onClick={() => onSelect(t.id)}
                          className="px-2 py-1 bg-[#1c2030] border border-[#252a3d] hover:border-[#7b9cf5] rounded text-[10px] font-mono text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={`${e.type}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: fieldCol }} />
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "context" ? (
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#252a3d] bg-[#0c0d13] rounded-md p-3">
                <div className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider mb-1">Era</div>
                <div className="font-serif text-sm font-bold text-slate-100">{thinker.era || "Unclassified"}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">{eraPeers.length} nearby figures</div>
              </div>
              <div className="border border-[#252a3d] bg-[#0c0d13] rounded-md p-3">
                <div className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider mb-1">Field Neighborhood</div>
                <div className="font-serif text-sm font-bold text-slate-100">{thinker.fields?.join(", ") || "Unclassified"}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">{fieldPeers.length} high-signal peers</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider font-bold">Contemporaries</span>
                <span className="text-[9px] text-slate-600 font-mono">20+ year overlap</span>
              </div>
              <div className="flex flex-wrap gap-1.5 bg-[#0c0d13] border border-[#252a3d] rounded-md p-2">
                {contemporaries.length > 0 ? (
                  contemporaries.map(renderPeerButton)
                ) : (
                  <div className="text-[10px] text-[#5a6480] italic px-1 py-2">No strong lifetime overlaps found.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider font-bold">Same Field</span>
                <span className="text-[9px] text-slate-600 font-mono">ranked by significance</span>
              </div>
              <div className="flex flex-wrap gap-1.5 bg-[#0c0d13] border border-[#252a3d] rounded-md p-2">
                {fieldPeers.length > 0 ? (
                  fieldPeers.map(renderPeerButton)
                ) : (
                  <div className="text-[10px] text-[#5a6480] italic px-1 py-2">No field peers mapped.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider font-bold">Same Era</span>
                <span className="text-[9px] text-slate-600 font-mono">nearest by birth year</span>
              </div>
              <div className="flex flex-wrap gap-1.5 bg-[#0c0d13] border border-[#252a3d] rounded-md p-2">
                {eraPeers.length > 0 ? (
                  eraPeers.map(renderPeerButton)
                ) : (
                  <div className="text-[10px] text-[#5a6480] italic px-1 py-2">No era peers mapped.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between border-b border-[#252a3d] pb-2">
              <span className="font-serif text-sm font-bold text-slate-200">Relationship Map</span>
              <span className="font-mono text-[9px] text-[#7b9cf5] uppercase tracking-wide">
                {directInfluencedBy.length} in / {directInfluences.length} out
              </span>
            </div>

            {/* SVG Interactive Chart */}
            {(() => {
              // Gather direct influences (Predecessors)
              const parents = directInfluencedBy
                .map((e) => people.find((p) => p.id === e.source))
                .filter(Boolean) as Thinker[];

              // Gather direct influenced (Successors)
              const children = directInfluences
                .map((e) => people.find((p) => p.id === e.target))
                .filter(Boolean) as Thinker[];

              // Sort by legacy bridge score and slice to prevent congestion
              const displayedParents = parents.sort((a, b) => (b.bridge_score ?? 2) - (a.bridge_score ?? 2)).slice(0, 5);
              const displayedChildren = children.sort((a, b) => (b.bridge_score ?? 2) - (a.bridge_score ?? 2)).slice(0, 5);

              const maxNodes = Math.max(displayedParents.length, displayedChildren.length, 1);
              const svgHeight = Math.max(180, maxNodes * 46 + 30);
              const centerY = svgHeight / 2;

              const getParentY = (idx: number, total: number) => {
                if (total === 1) return centerY;
                return 25 + (idx * (svgHeight - 50)) / (total - 1);
              };

              const getChildY = (idx: number, total: number) => {
                if (total === 1) return centerY;
                return 25 + (idx * (svgHeight - 50)) / (total - 1);
              };

              return (
                <div className="border border-[#252a3d] bg-[#0c0d12] rounded-lg overflow-hidden relative shadow-inner">
                  <svg width="100%" height={svgHeight} viewBox={`0 0 340 ${svgHeight}`} className="block">
                    <defs>
                      <marker
                        id="genealogy-arrow"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 2.5 L 7 5 L 0 7.5 z" fill="rgba(123, 156, 245, 0.75)" />
                      </marker>
                    </defs>

                    {/* Predecessors Connections (Gen -1 ➔ Gen 0) */}
                    {displayedParents.map((p, idx) => {
                      const yVal = getParentY(idx, displayedParents.length);
                      return (
                        <path
                          key={`link-p-${p.id}`}
                          d={`M 92 ${yVal} C 110 ${yVal}, 105 ${centerY}, 120 ${centerY}`}
                          fill="none"
                          stroke="rgba(167, 139, 250, 0.4)"
                          strokeWidth="1.2"
                          markerEnd="url(#genealogy-arrow)"
                          className="transition-colors duration-200 hover:stroke-purple-400"
                        />
                      );
                    })}

                    {/* Successors Connections (Gen 0 ➔ Gen +1) */}
                    {displayedChildren.map((c, idx) => {
                      const yVal = getChildY(idx, displayedChildren.length);
                      return (
                        <path
                          key={`link-c-${c.id}`}
                          d={`M 220 ${centerY} C 230 ${centerY}, 225 ${yVal}, 242 ${yVal}`}
                          fill="none"
                          stroke="rgba(123, 156, 245, 0.4)"
                          strokeWidth="1.2"
                          markerEnd="url(#genealogy-arrow)"
                          className="transition-colors duration-200 hover:stroke-blue-400"
                        />
                      );
                    })}

                    {/* 1. Predecessors Column Nodes */}
                    {displayedParents.length === 0 ? (
                      <g transform={`translate(10, ${centerY - 14})`}>
                        <rect x="0" y="0" width="82" height="28" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
                        <text x="41" y="16" fill="rgba(255,255,255,0.25)" fontSize="7.5" fontFamily="monospace" textAnchor="middle">Unknown Roots</text>
                      </g>
                    ) : (
                      displayedParents.map((p, idx) => {
                        const yVal = getParentY(idx, displayedParents.length);
                        const pCol = FIELD_COLOR[p.fields?.[0] || "Philosophy"] || "#94a3b8";
                        const shortName = p.name.split(" ").slice(-1)[0];
                        return (
                          <g
                            key={`node-p-${p.id}`}
                            transform={`translate(10, ${yVal - 14})`}
                            onClick={() => onSelect(p.id)}
                            className="cursor-pointer select-none group"
                          >
                            <rect
                              x="0"
                              y="0"
                              width="82"
                              height="28"
                              rx="4"
                              fill="#151722"
                              stroke={`${pCol}7f`}
                              strokeWidth="1"
                              className="transition-all duration-200 group-hover:fill-[#1d2030] group-hover:stroke-white group-hover:translate-x-0.5"
                            />
                            <text
                              x="41"
                              y="12"
                              fill={pCol}
                              fontSize="8"
                              fontWeight="600"
                              fontFamily="sans-serif"
                              textAnchor="middle"
                              className="group-hover:fill-white transition-colors"
                            >
                              {shortName.length > 12 ? `${shortName.slice(0, 10)}..` : shortName}
                            </text>
                            <text
                              x="41"
                              y="21"
                              fill="rgba(255,255,255,0.4)"
                              fontSize="6.5"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {p.birth < 0 ? `${Math.abs(p.birth)}BCE` : p.birth}
                            </text>
                            <title>{p.name} ({p.fields?.join(", ")})</title>
                          </g>
                        );
                      })
                    )}

                    {/* 2. Selected Core Node (Gen 0) */}
                    <g
                      transform={`translate(122, ${centerY - 16})`}
                      className="select-none"
                    >
                      {/* Glow ring backing */}
                      <rect
                        x="-2"
                        y="-2"
                        width="100"
                        height="36"
                        rx="6"
                        fill="none"
                        stroke={col}
                        strokeWidth="1.5"
                        opacity="0.3"
                        className="animate-pulse"
                      />
                      <rect
                        x="0"
                        y="0"
                        width="96"
                        height="32"
                        rx="5"
                        fill="#1a1e2e"
                        stroke={col}
                        strokeWidth="1.8"
                      />
                      <text
                        x="48"
                        y="13"
                        fill="#ffffff"
                        fontSize="8.5"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                      >
                        {thinker.name.split(" ").slice(-1)[0]}
                      </text>
                      <text
                        x="48"
                        y="23"
                        fill="rgba(255,255,255,0.5)"
                        fontSize="6.5"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {thinker.birth < 0 ? `${Math.abs(thinker.birth)} BCE` : thinker.birth} – {thinker.death ?? "present"}
                      </text>
                    </g>

                    {/* 3. Successors Column Nodes */}
                    {displayedChildren.length === 0 ? (
                      <g transform={`translate(248, ${centerY - 14})`}>
                        <rect x="0" y="0" width="82" height="28" rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeDasharray="3,3" />
                        <text x="41" y="16" fill="rgba(255,255,255,0.25)" fontSize="7.5" fontFamily="monospace" textAnchor="middle">End of Line</text>
                      </g>
                    ) : (
                      displayedChildren.map((c, idx) => {
                        const yVal = getChildY(idx, displayedChildren.length);
                        const cCol = FIELD_COLOR[c.fields?.[0] || "Philosophy"] || "#94a3b8";
                        const shortName = c.name.split(" ").slice(-1)[0];
                        return (
                          <g
                            key={`node-c-${c.id}`}
                            transform={`translate(248, ${yVal - 14})`}
                            onClick={() => onSelect(c.id)}
                            className="cursor-pointer select-none group"
                          >
                            <rect
                              x="0"
                              y="0"
                              width="82"
                              height="28"
                              rx="4"
                              fill="#151722"
                              stroke={`${cCol}7f`}
                              strokeWidth="1"
                              className="transition-all duration-200 group-hover:fill-[#1d2030] group-hover:stroke-white group-hover:-translate-x-0.5"
                            />
                            <text
                              x="41"
                              y="12"
                              fill={cCol}
                              fontSize="8"
                              fontWeight="600"
                              fontFamily="sans-serif"
                              textAnchor="middle"
                              className="group-hover:fill-white transition-colors"
                            >
                              {shortName.length > 12 ? `${shortName.slice(0, 10)}..` : shortName}
                            </text>
                            <text
                              x="41"
                              y="21"
                              fill="rgba(255,255,255,0.4)"
                              fontSize="6.5"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {c.birth < 0 ? `${Math.abs(c.birth)}BCE` : c.birth}
                            </text>
                            <title>{c.name} ({c.fields?.join(", ")})</title>
                          </g>
                        );
                      })
                    )}
                  </svg>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider font-bold">Upstream Influences</span>
                  <span className="text-[9px] text-slate-600 font-mono">{ancestorsList.length} mapped</span>
                </div>
                <div className="space-y-1.5 bg-[#0c0d13] border border-[#252a3d] rounded-md p-2">
                  {ancestorsList.length > 0 ? (
                    ancestorsList.map((node) => renderGenealogyCard(node, "up"))
                  ) : (
                    <div className="text-[10px] text-[#5a6480] italic px-1 py-2">No upstream influences mapped.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-[#5a6480] uppercase tracking-wider font-bold">Downstream Influence</span>
                  <span className="text-[9px] text-slate-600 font-mono">{descendantsList.length} mapped</span>
                </div>
                <div className="space-y-1.5 bg-[#0c0d13] border border-[#252a3d] rounded-md p-2">
                  {descendantsList.length > 0 ? (
                    descendantsList.map((node) => renderGenealogyCard(node, "down"))
                  ) : (
                    <div className="text-[10px] text-[#5a6480] italic px-1 py-2">No downstream influence mapped.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Explorer Tools Actions buttons block */}
      <div className="shrink-0 p-4 border-t border-[#252a3d] bg-[#0d0f17] grid grid-cols-2 gap-2.5">
        <button
          onClick={() => onFindContemporaries(thinker.id)}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-[#1c2030] hover:bg-[#252a3d] border border-[#252a3d] text-slate-300 font-mono text-[10px] font-semibold rounded transition-colors text-center cursor-pointer"
          title="Detect thinkers with prominent life timeline overlaps"
        >
          <Users className="w-3 h-3 text-amber-500" />
          <span>Contemporaries</span>
        </button>
        <button
          onClick={() => onShowBFS(thinker.id)}
          className="flex items-center justify-center gap-1 px-3 py-2 bg-[#1c2030] hover:bg-[#252a3d] border border-[#252a3d] text-slate-300 font-mono text-[10px] font-semibold rounded transition-colors text-center cursor-pointer"
          title="Visualize downstream influence reach tree maps"
        >
          <GitBranch className="w-3 h-3 text-[#7b9cf5]" />
          <span>Successors Map</span>
        </button>
      </div>
    </div>
  );
}
