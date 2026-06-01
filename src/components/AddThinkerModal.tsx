import React, { useState } from "react";
import { Thinker } from "../types";
import { CONTROLLED_TOPICS, TAXONOMY_DOMAINS, getFieldsForDomain, getTopicGroupsForField } from "../taxonomy";

interface AddThinkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (thinker: Thinker) => void;
}

export default function AddThinkerModal({ isOpen, onClose, onAdd }: AddThinkerModalProps) {
  const [name, setName] = useState("");
  const [birth, setBirth] = useState<number | "">("");
  const [death, setDeath] = useState<number | "">("");
  const [domain, setDomain] = useState("Human Systems");
  const [field, setField] = useState("Philosophy");
  const [topics, setTopics] = useState<string[]>(["Epistemology"]);
  const [region, setRegion] = useState("");
  const [era, setEra] = useState("Modernism");
  const [notes, setNotes] = useState("");
  const [bridge, setBridge] = useState(2);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20) + "_" + Math.random().toString(36).substring(2, 7);
    const newThinker: Thinker = {
      id,
      name,
      birth: Number(birth) || 0,
      death: death === "" ? null : Number(death),
      fields: [field],
      subfields: topics,
      region: region || null,
      era: era || null,
      movement: null,
      bridge_score: bridge,
      works: [],
      influenced: [],
      notes: notes || null,
    };

    onAdd(newThinker);
    setName("");
    setBirth("");
    setDeath("");
    setDomain("Human Systems");
    setField("Philosophy");
    setTopics(["Epistemology"]);
    setRegion("");
    setNotes("");
    setBridge(2);
    onClose();
  };

  const availableFields = getFieldsForDomain(domain);
  const availableTopics = CONTROLLED_TOPICS[field] || [];
  const availableTopicGroups = getTopicGroupsForField(field);

  const handleDomainChange = (nextDomain: string) => {
    const nextFields = getFieldsForDomain(nextDomain);
    const nextField = nextFields[0] || "Philosophy";
    const nextTopics = CONTROLLED_TOPICS[nextField] || [];
    setDomain(nextDomain);
    setField(nextField);
    setTopics(nextTopics.slice(0, 1));
  };

  const handleFieldChange = (nextField: string) => {
    const nextTopics = CONTROLLED_TOPICS[nextField] || [];
    setField(nextField);
    setTopics(nextTopics.slice(0, 1));
  };

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]
    );
  };

  return (
    <div id="modal-overlay" className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div id="modal" className="glass-panel-heavy rounded-xl p-6 w-full max-w-lg shadow-2xl shadow-black/80 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-xl font-bold text-slate-100">Add a Thinker</h3>
          <button id="modal-close" onClick={onClose} className="text-[#5a6480] hover:text-slate-100 text-2xl transition-colors cursor-pointer">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="modal-field">
            <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Name *</label>
            <input
              id="m-name"
              type="text"
              required
              placeholder="e.g. Hypatia of Alexandria"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="modal-field">
              <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Birth Year (BCE negative)</label>
              <input
                id="m-birth"
                type="number"
                placeholder="e.g. -400 or 1912"
                value={birth}
                onChange={(e) => setBirth(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors"
              />
            </div>
            <div className="modal-field">
              <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Death Year (null if living)</label>
              <input
                id="m-death"
                type="number"
                placeholder="e.g. 2024"
                value={death}
                onChange={(e) => setDeath(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="modal-field">
              <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Domain</label>
              <select
                id="m-domain"
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors cursor-pointer"
              >
                {TAXONOMY_DOMAINS.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Field</label>
              <select
                id="m-field"
                value={field}
                onChange={(e) => handleFieldChange(e.target.value)}
                className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors cursor-pointer"
              >
                {availableFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Topics</label>
            <div className="space-y-2 bg-[#111521] border border-[#252a3d] rounded p-2">
              {availableTopicGroups.map((group) => (
                <div key={`${field}-${group.name}`}>
                  <div className="mb-1 font-mono text-[8.5px] uppercase tracking-wider text-slate-600">
                    {group.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.topics.map((topic) => {
                      const active = topics.includes(topic);
                      return (
                        <button
                          type="button"
                          key={topic}
                          onClick={() => toggleTopic(topic)}
                          className={`px-2 py-1 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
                            active
                              ? "border-[#7b9cf5] bg-[#7b9cf5]/15 text-white"
                              : "border-[#252a3d] text-slate-400 hover:text-slate-100"
                          }`}
                        >
                          {topic}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="modal-field">
              <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Region / Location</label>
              <input
                id="m-region"
                type="text"
                placeholder="e.g. Greece, Oxford"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors"
              />
            </div>
            <div className="modal-field">
              <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Historical Era</label>
              <select
                id="m-era"
                value={era}
                onChange={(e) => setEra(e.target.value)}
                className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="Ancient">Ancient</option>
                <option value="Medieval">Medieval</option>
                <option value="Renaissance">Renaissance</option>
                <option value="Scientific Rev.">Scientific Rev.</option>
                <option value="Enlightenment">Enlightenment</option>
                <option value="19th Century">19th Century</option>
                <option value="Modernism">Modernism</option>
                <option value="Postwar">Postwar</option>
                <option value="Contemporary">Contemporary</option>
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Historical Significance / Bridge Score (1-5)</label>
            <div className="flex items-center gap-2">
              <input
                id="m-bridge"
                type="range"
                min="1"
                max="5"
                value={bridge}
                onChange={(e) => setBridge(Number(e.target.value))}
                className="flex-1 accent-[#7b9cf5] cursor-pointer"
              />
              <span className="font-mono font-bold text-[#7b9cf5] w-6 text-center text-sm">{bridge}</span>
            </div>
          </div>

          <div className="modal-field">
            <label className="font-mono text-[10px] text-[#5a6480] uppercase tracking-wider block mb-1">Intellectual Notes & Legacy</label>
            <textarea
              id="m-notes"
              placeholder="Summary of core theories, inventions, or conceptual breakthroughs..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#1c2030] border border-[#252a3d] rounded px-3 py-2 text-slate-100 text-sm focus:border-[#7b9cf5] focus:outline-none transition-colors h-20 resize-none"
            />
          </div>

          <div className="flex justify-end pt-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              id="m-cancel"
              className="px-4 py-2 border border-[#252a3d] rounded text-[#5a6480] hover:text-slate-100 font-mono text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="m-submit"
              className="px-4 py-2 bg-[#7b9cf5]/15 border border-[#7b9cf5] text-[#7b9cf5] hover:bg-[#7b9cf5]/25 rounded font-mono text-xs transition-colors cursor-pointer"
            >
              Add to Atlas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
