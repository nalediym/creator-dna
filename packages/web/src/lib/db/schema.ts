/**
 * Creator DNA local database (Dexie / IndexedDB).
 *
 * Privacy invariant: this database is origin-scoped. Nothing here ever
 * crosses the network. The only thing that does is the ≤6KB Composer
 * payload constructed by the pipeline, never raw rows.
 *
 * Schema follows plan §2.3 + §17. Eight tables:
 *   events              append-only behavioural log (the source of truth)
 *   entities            nodes in the taste graph
 *   embeddings          vectors keyed by entity_id+entity_type
 *   edges               relationships between entities
 *   signals             per-run signal scores (§5)
 *   metrics             per-run intermediate metrics (§6)
 *   insights            per-run report insights (Composer input contract)
 *   runs                ingest history (powers idempotent re-upload + longitudinal)
 *   feedback            user thumbs up/down on niche cards (§17.2)
 *   user_weight_overrides   per-user weight overlay (PREMIUM-style)
 */

import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Edge,
  Entity,
  EntityType,
  Event,
} from "@creator-dna/core";

// Re-export the core enums so consumers of the web package can find them
// without crossing the workspace boundary explicitly.
export type { EdgeType, EntityType, EventType, ObjectType } from "@creator-dna/core";

// ── Row types ──────────────────────────────────────────────
// Storage rows = core record + Dexie-managed primary key.

export type EventRow = Event & { id?: number };
export type EntityRow = Entity;
export type EdgeRow = Edge & { id?: number };

export interface EmbeddingRow {
  entity_id: string;
  entity_type: EntityType;
  text: string;
  vector: Float32Array;
  model_name: string;
}

export interface SignalRow {
  id?: number;
  run_id: number;
  entity_id: string;
  signal_type: string;
  strength: number;
  confidence: number;
  evidence_json: string;
  caution?: string;
}

export interface MetricRow {
  id?: number;
  run_id: number;
  entity_id: string;
  metric_name: string;
  metric_value: number;
  window_start?: string;
  window_end?: string;
}

export interface InsightRow {
  id?: number;
  run_id: number;
  insight_type: string;
  title: string;
  explanation: string;
  evidence_json: string;
  confidence_score: number;
  recommended_action?: string;
}

export interface RunRow {
  id?: number;
  ts: string;
  /** Hash of the input ParsedExport so re-uploads of the same export are no-ops. */
  source_hash: string;
  /** Counts of what landed during this run (debug + UX surface). */
  summary: {
    events: number;
    entities: number;
    edges: number;
    skipped_existing?: number;
  };
}

export interface FeedbackRow {
  id?: number;
  ts: string;
  kind: "niche_yes" | "niche_no" | "niche_meh" | "evidence_disputed";
  target_id: string;
  run_id: number;
  note?: string;
}

export interface UserWeightOverrideRow {
  /** "global" or a topic id for per-niche tuning. */
  scope: string;
  /** Signal/metric/weight name (e.g. "attention", "money_potential.affiliate_potential"). */
  key: string;
  value: number;
  updated_at: string;
  sample_count: number;
}

// ── Database class ──────────────────────────────────────────

export class CreatorDnaDb extends Dexie {
  events!: EntityTable<EventRow, "id">;
  entities!: EntityTable<EntityRow, "id">;
  embeddings!: EntityTable<EmbeddingRow, "entity_id">;
  edges!: EntityTable<EdgeRow, "id">;
  signals!: EntityTable<SignalRow, "id">;
  metrics!: EntityTable<MetricRow, "id">;
  insights!: EntityTable<InsightRow, "id">;
  runs!: EntityTable<RunRow, "id">;
  feedback!: EntityTable<FeedbackRow, "id">;
  // Compound primary key [scope+key] — Dexie's EntityTable requires a
  // single keyof, so this store uses the looser Table type.
  user_weight_overrides!: Table<UserWeightOverrideRow, [string, string]>;

  constructor() {
    super("CreatorDNA");

    this.version(1).stores({
      events:
        "++id, event_type, occurred_at, object_type, object_id, [event_type+object_type]",
      entities: "id, entity_type, [entity_type+name]",
      embeddings: "entity_id, [entity_type+entity_id], model_name",
      edges:
        "++id, source_id, target_id, edge_type, [source_id+edge_type], [target_id+edge_type]",
      signals: "++id, [run_id+entity_id+signal_type], run_id, entity_id",
      metrics: "++id, [run_id+entity_id+metric_name], run_id, entity_id",
      insights: "++id, run_id, insight_type, confidence_score",
      runs: "++id, ts, source_hash",
      feedback: "++id, ts, kind, target_id, run_id",
      user_weight_overrides: "[scope+key], scope, key",
    });
  }
}

// ── Lazy singleton (SSR-safe) ──────────────────────────────

let _db: CreatorDnaDb | null = null;

/**
 * Get the database instance. Returns null in SSR — callers must handle that.
 * On the client, opens once and reuses.
 */
export function getDb(): CreatorDnaDb | null {
  if (typeof indexedDB === "undefined") return null;
  if (!_db) _db = new CreatorDnaDb();
  return _db;
}

/**
 * Required-database accessor for code paths that must be client-side.
 * Throws synchronously if called server-side — that's a bug, not a runtime path.
 */
export function requireDb(): CreatorDnaDb {
  const db = getDb();
  if (!db) throw new Error("CreatorDnaDb is browser-only (no IndexedDB available)");
  return db;
}

/**
 * "Forget my DNA" — wipes every table. See plan §15.6.
 * Closes and reopens the DB so new connections see the empty state.
 */
export async function wipeAllData(): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.delete();
  _db = null;
}
