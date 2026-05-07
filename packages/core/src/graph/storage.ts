/**
 * GraphStorage — the read interface the query DSL runs against.
 *
 * Three implementations live downstream:
 *   - InMemoryGraphStorage (this file) — used by tests and the future
 *     build-time tuner that runs over fixture exports
 *   - DexieGraphStorage (packages/web/src/lib/db/graph-storage.ts) — wraps
 *     the Dexie tables for the browser
 *   - (later) ModalGraphStorage if we ever want to run signal queries on
 *     a Modal worker against a serialised graph
 *
 * The interface is intentionally small. Anything more elaborate (joins,
 * indices, aggregations) belongs in the query DSL on top, not here.
 */

import type { Edge, Entity, EdgeType, EntityType } from "./schema";

export interface GraphStorage {
  /** Get a node by id, or null if missing. */
  node(id: string): Promise<Entity | null>;

  /** All nodes (optionally filtered by entity type). */
  nodes(type?: EntityType): Promise<Entity[]>;

  /** Outgoing edges from `srcId`, optionally narrowed by edge type. */
  outgoing(srcId: string, type?: EdgeType): Promise<Edge[]>;

  /** Incoming edges to `dstId`, optionally narrowed by edge type. */
  incoming(dstId: string, type?: EdgeType): Promise<Edge[]>;

  /** All edges of a given type (used by global computations like CO_OCCURS_WITH). */
  edgesOfType(type: EdgeType): Promise<Edge[]>;
}

/**
 * In-memory implementation. Used by tests and any build-time pipeline that
 * loads a fixture export end-to-end. Not optimised — linear scans.
 *
 * For real workloads we use the Dexie-backed adapter in the web package,
 * which exploits the [source_id+edge_type] / [target_id+edge_type]
 * compound indices defined in db/schema.ts.
 */
export class InMemoryGraphStorage implements GraphStorage {
  private nodesById: Map<string, Entity>;

  constructor(
    private readonly entities: ReadonlyArray<Entity>,
    private readonly edges: ReadonlyArray<Edge>,
  ) {
    this.nodesById = new Map(entities.map((e) => [e.id, e]));
  }

  async node(id: string): Promise<Entity | null> {
    return this.nodesById.get(id) ?? null;
  }

  async nodes(type?: EntityType): Promise<Entity[]> {
    return type ? this.entities.filter((e) => e.entity_type === type) : [...this.entities];
  }

  async outgoing(srcId: string, type?: EdgeType): Promise<Edge[]> {
    return this.edges.filter(
      (e) => e.source_id === srcId && (!type || e.edge_type === type),
    );
  }

  async incoming(dstId: string, type?: EdgeType): Promise<Edge[]> {
    return this.edges.filter(
      (e) => e.target_id === dstId && (!type || e.edge_type === type),
    );
  }

  async edgesOfType(type: EdgeType): Promise<Edge[]> {
    return this.edges.filter((e) => e.edge_type === type);
  }
}
