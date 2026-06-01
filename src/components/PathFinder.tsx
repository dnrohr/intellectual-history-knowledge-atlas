import { useEffect, useMemo, useState } from "react";
import { Thinker, InfluenceEdge } from "../types";
import { FIELD_COLOR } from "../data";

interface PathFinderProps {
  people: Thinker[];
  edges: InfluenceEdge[];
  selectedId: string | null;
  onFindPath: (path: string[] | null) => void;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  highlightPath: string[] | null;
}

export default function PathFinder({
  people,
  edges,
  selectedId,
  onFindPath,
  onSelect,
  isOpen,
  onToggle,
  highlightPath,
}: PathFinderProps) {
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [errorWord, setErrorWord] = useState("");

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people]
  );

  const edgeByStep = useMemo(() => {
    const map = new Map<string, InfluenceEdge>();
    edges.forEach((edge) => {
      map.set(`${edge.source}->${edge.target}`, edge);
    });
    return map;
  }, [edges]);

  useEffect(() => {
    if (!isOpen || fromQuery.trim() || !selectedId) return;
    const selectedPerson = peopleById.get(selectedId);
    if (selectedPerson) {
      setFromQuery(selectedPerson.name);
    }
  }, [fromQuery, isOpen, peopleById, selectedId]);

  const searchPerson = (q: string): Thinker | undefined => {
    const qNorm = q.toLowerCase().trim();
    if (!qNorm) return undefined;
    return people.find(
      (p) =>
        p.id === qNorm ||
        p.name.toLowerCase() === qNorm ||
        p.name.toLowerCase().includes(qNorm)
    );
  };

  const handleSearch = () => {
    setErrorWord("");
    const fromPerson = searchPerson(fromQuery);
    const toPerson = searchPerson(toQuery);

    if (!fromPerson || !toPerson) {
      setErrorWord("Choose two thinkers from the suggestions.");
      onFindPath(null);
      return;
    }

    if (fromPerson.id === toPerson.id) {
      setErrorWord("Start and destination are the same thinker.");
      onFindPath(null);
      return;
    }

    const adj: Record<string, string[]> = {};
    people.forEach((p) => {
      adj[p.id] = [];
    });

    edges.forEach((edge) => {
      if (adj[edge.source] && adj[edge.target] !== undefined) {
        adj[edge.source].push(edge.target);
      }
    });

    const queue: string[] = [fromPerson.id];
    const visited: Record<string, string | null> = { [fromPerson.id]: null };

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === toPerson.id) break;

      for (const next of adj[cur] || []) {
        if (!(next in visited)) {
          visited[next] = cur;
          queue.push(next);
        }
      }
    }

    if (!(toPerson.id in visited)) {
      setErrorWord(`No mapped influence path from ${fromPerson.name} to ${toPerson.name}.`);
      onFindPath(null);
      return;
    }

    const path: string[] = [];
    let curr: string | null = toPerson.id;
    while (curr !== null) {
      path.unshift(curr);
      curr = visited[curr];
    }

    onFindPath(path);
  };

  return (
    <div
      id="path-panel"
      className={`absolute bottom-3 left-3 z-30 glass-panel rounded-lg p-4 w-[320px] shadow-2xl shadow-black/60 transition-all duration-300 ${
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      }`}
    >
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold">Find Relationship Path</h4>
        <button
          onClick={onToggle}
          className="text-[#5a6480] hover:text-slate-100 text-sm font-bold cursor-pointer"
          aria-label="Close path finder"
        >
          x
        </button>
      </div>

      <div className="space-y-2.5">
        <input
          id="path-from"
          type="text"
          list="path-thinkers"
          placeholder="From thinker"
          value={fromQuery}
          onChange={(e) => setFromQuery(e.target.value)}
          className="w-full bg-[#0d0e12] border border-[#252a3d] rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-[#7b9cf5] focus:outline-none transition-colors"
        />
        <input
          id="path-to"
          type="text"
          list="path-thinkers"
          placeholder="To thinker"
          value={toQuery}
          onChange={(e) => setToQuery(e.target.value)}
          className="w-full bg-[#0d0e12] border border-[#252a3d] rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-[#7b9cf5] focus:outline-none transition-colors"
        />
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-600">
          <span>Paths follow directed influence links.</span>
          {selectedId && (
            <button
              onClick={() => {
                const selectedPerson = peopleById.get(selectedId);
                if (selectedPerson) setFromQuery(selectedPerson.name);
              }}
              className="text-[#7b9cf5] hover:text-[#9bdaff] cursor-pointer"
            >
              Use selected
            </button>
          )}
        </div>
        <datalist id="path-thinkers">
          {people.map((person) => (
            <option key={person.id} value={person.name} />
          ))}
        </datalist>

        <button
          id="path-btn"
          onClick={handleSearch}
          className="w-full py-1.5 bg-[#7b9cf5]/15 hover:bg-[#7b9cf5]/25 border border-[#7b9cf5] rounded text-[#7b9cf5] font-mono text-[10px] transition-colors cursor-pointer block text-center"
        >
          Find Path
        </button>

        {errorWord && (
          <p className="text-[10px] text-rose-400 italic leading-snug pt-1">{errorWord}</p>
        )}

        {highlightPath && highlightPath.length > 0 && (
          <div className="border-t border-[#252a3d] pt-3 mt-1.5 space-y-2 max-h-[190px] overflow-y-auto scrollbar-thin">
            <div className="text-[9px] font-mono text-[#5a6480] uppercase tracking-wide">
              {highlightPath.length - 1} relationship step{highlightPath.length === 2 ? "" : "s"}
            </div>
            <div id="path-result" className="space-y-1.5">
              {highlightPath.map((stepId, i) => {
                const stepNode = peopleById.get(stepId);
                if (!stepNode) return null;
                const col = FIELD_COLOR[stepNode.fields?.[0] || "Philosophy"] || "#94a3b8";
                const prevId = highlightPath[i - 1];
                const incomingEdge = prevId ? edgeByStep.get(`${prevId}->${stepId}`) : null;

                return (
                  <button
                    key={`${stepId}-${i}`}
                    onClick={() => onSelect(stepId)}
                    className="w-full text-left hover:bg-[#1c2030] p-1.5 rounded cursor-pointer transition-colors"
                  >
                    {incomingEdge && (
                      <div className="pl-2 mb-1 text-[8.5px] text-slate-500 font-mono border-l border-[#252a3d]">
                        {incomingEdge.type}
                        {incomingEdge.note ? <span className="text-slate-400"> - {incomingEdge.note}</span> : null}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[#5a6480] font-mono w-4">{i + 1}</span>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} />
                      <span className="text-[10px] text-slate-300 font-serif font-bold truncate">{stepNode.name}</span>
                      <span className="text-[8px] text-slate-500 font-mono">({stepNode.fields?.[0] || "Field"})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
