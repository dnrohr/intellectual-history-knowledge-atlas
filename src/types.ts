export interface Thinker {
  id: string;
  name: string;
  birth: number;
  death: number | null;
  fields: string[];
  subfields?: string[];
  region?: string | null;
  era?: string | null;
  movement?: string | null;
  bridge_score?: number;
  works?: string[];
  influenced?: string[];
  notes?: string | null;
}

export interface InfluenceEdge {
  source: string;
  target: string;
  type: string;
  strength: number;
  note?: string | null;
  confidence?: number;
  sourceClaims?: string[];
}

export interface CanonicalThread {
  id: string;
  title: string;
  field: string;
  purpose: string;
  people: string[];
  concepts: string[];
  edgeTypes: string[];
  confidence: "high" | "medium" | "needs-review";
}

export interface SourceClaim {
  id: string;
  sourceName: string;
  sourceUrl?: string;
  entityType: "person" | "work" | "concept" | "movement" | "institution" | "relationship";
  entityId: string;
  field: string;
  value: string;
  confidence: number;
  status: "suggested" | "accepted" | "rejected";
}

export interface Movement {
  name: string;
  start: number;
  end: number;
  core: string;
  fields: string[];
}

export interface Institution {
  name: string;
  city: string;
  peak_start: number;
  peak_end: number;
  figures: string[];
}

export interface AppState {
  fieldFilter: Set<string>;
  eraFilter: Set<string>;
  sortMode: "birth" | "field" | "bridge" | "name";
  search: string;
  showMov: boolean;
  showEdges: boolean;
  showWorks: boolean;
  showLabels: boolean;
  logScale: boolean;
  zoom: number;
  scrollX: number;
  scrollY: number;
  selectedId: string | null;
  highlightPath: string[] | null;
}
