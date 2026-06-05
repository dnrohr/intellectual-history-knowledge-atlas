export type KnowledgeEntityType =
  | "Person"
  | "Work"
  | "Concept"
  | "Movement"
  | "Institution"
  | "SourceClaim"
  | "Relationship";

export interface KnowledgeEntityBase {
  id: string;
  type: KnowledgeEntityType;
  label: string;
  claimIds?: string[];
}

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

export interface PersonEntity extends KnowledgeEntityBase {
  type: "Person";
  thinkerId: string;
  birth: number;
  death: number | null;
  fields: string[];
}

export interface WorkEntity extends KnowledgeEntityBase {
  type: "Work";
  title: string;
  authorIds?: string[];
  date?: number | null;
  identifiers?: Record<string, string>;
}

export interface ConceptEntity extends KnowledgeEntityBase {
  type: "Concept";
  description?: string | null;
  fields?: string[];
}

export interface MovementEntity extends KnowledgeEntityBase {
  type: "Movement";
  start?: number | null;
  end?: number | null;
  fields?: string[];
}

export interface InstitutionEntity extends KnowledgeEntityBase {
  type: "Institution";
  city?: string | null;
  figureIds?: string[];
}

export type RelationshipEndpointType = Exclude<KnowledgeEntityType, "SourceClaim" | "Relationship">;

export interface RelationshipEndpoint {
  entityId: string;
  entityType: RelationshipEndpointType;
}

export type KnownRelationshipType =
  | "person authored work"
  | "work introduced concept"
  | "person influenced person"
  | "person mentored person"
  | "person collaborated with person"
  | "person participated in movement"
  | "person affiliated with institution"
  | "concept shaped movement"
  | "work influenced work";

export interface RelationshipTypeDefinition {
  type: KnownRelationshipType;
  sourceType: RelationshipEndpointType;
  targetType: RelationshipEndpointType;
}

export interface InfluenceEdge {
  id?: string;
  source: string;
  target: string;
  sourceEntityType?: RelationshipEndpointType;
  targetEntityType?: RelationshipEndpointType;
  type: string | KnownRelationshipType;
  strength: number;
  note?: string | null;
  confidence?: number;
  sourceClaims?: string[];
  status?: "suggested" | "accepted" | "rejected" | "needs_source";
}

export interface RelationshipEntity extends KnowledgeEntityBase {
  type: "Relationship";
  source: RelationshipEndpoint;
  target: RelationshipEndpoint;
  relationshipType: string | KnownRelationshipType;
  strength?: number;
  confidence?: number;
  status?: InfluenceEdge["status"];
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

export type SourceClaimStatus = "observed" | "candidate" | "accepted" | "rejected" | "stale" | "conflicting";

export interface SourceClaimEntity extends KnowledgeEntityBase {
  type: "SourceClaim";
  sourceName: string;
  sourceUrl?: string;
  subjectEntityId: string;
  subjectEntityType: Exclude<KnowledgeEntityType, "SourceClaim">;
  field: string;
  value: string;
  confidence: number;
  status: SourceClaimStatus;
}

export interface SourceClaim {
  id: string;
  sourceName: string;
  sourceUrl?: string;
  entityType: Exclude<KnowledgeEntityType, "SourceClaim">;
  entityId: string;
  field: string;
  value: string;
  confidence: number;
  status: SourceClaimStatus;
}

export type KnowledgeEntity =
  | PersonEntity
  | WorkEntity
  | ConceptEntity
  | MovementEntity
  | InstitutionEntity
  | SourceClaimEntity
  | RelationshipEntity;

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
