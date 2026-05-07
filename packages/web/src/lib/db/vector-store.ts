/**
 * DexieVectorTable — VectorTable backed by the IndexedDB `embeddings` store.
 *
 * Strategy: lazy-load all vectors of one entity_type into memory on first
 * .search() call, cache them, brute-force cosine. Re-load when the row count
 * changes (cheap dirty check — we don't track individual upserts, just count).
 *
 * Why this shape: the `embeddings` table is small (≤100k rows × 384 floats =
 * ~150MB worst case, but typically 10–30k rows = 15–45MB). Loading once into
 * a Float32Array array and brute-forcing cosine is faster than any IDB-backed
 * vector index until we cross ~50k vectors. When that happens, swap this for
 * an HNSW-backed implementation behind the same VectorTable interface.
 */

import type { Entity, EntityType, VectorRow, VectorTable, VectorQuery } from "@creator-dna/core";
import { InMemoryVectorTable } from "@creator-dna/core";
import type { CreatorDnaDb } from "./schema";

export interface DexieVectorTableOpts {
  /** Entity type to scope this table to (e.g. "Topic", "Search", "Video"). */
  entityType: EntityType;
  /**
   * Optional model name guard — only load vectors whose `model_name` matches.
   * Defaults to "any model name" — useful when only one embedder is in use.
   */
  modelName?: string;
}

export class DexieVectorTable implements VectorTable<Entity> {
  private cached: InMemoryVectorTable<Entity> | null = null;
  private cachedCount = -1;

  constructor(
    private readonly db: CreatorDnaDb,
    private readonly opts: DexieVectorTableOpts,
  ) {}

  async upsert(rows: VectorRow<Entity>[]): Promise<void> {
    if (rows.length === 0) return;
    await this.db.embeddings.bulkPut(
      rows.map((r) => ({
        entity_id: r.id,
        entity_type: r.meta.entity_type,
        text: r.meta.name,
        vector: r.vector,
        model_name: this.opts.modelName ?? "unknown",
      })),
    );
    // Append to the in-memory cache too if it's already loaded (saves a reload).
    if (this.cached) {
      await this.cached.upsert(rows);
      this.cachedCount += rows.length;
    }
  }

  async size(): Promise<number> {
    return this.db.embeddings
      .where("entity_type")
      .equals(this.opts.entityType)
      .count();
  }

  async lookup(id: string): Promise<VectorRow<Entity> | null> {
    const emb = await this.db.embeddings.get(id);
    if (!emb) return null;
    if (this.opts.modelName && emb.model_name !== this.opts.modelName) return null;
    const entity = await this.db.entities.get(id);
    if (!entity) return null;
    return { id, vector: emb.vector, meta: entity };
  }

  /**
   * Build a deferred query — accumulates filter / threshold up front, only
   * touches IDB at the terminal .limit() call.
   */
  search(query: Float32Array): VectorQuery<Entity> {
    const filters: Array<(m: Entity) => boolean> = [];
    let minScore = -Infinity;

    const chain: VectorQuery<Entity> = {
      filter: (pred) => {
        filters.push(pred);
        return chain;
      },
      threshold: (min) => {
        minScore = min;
        return chain;
      },
      limit: async (n) => {
        await this.ensureCacheFresh();
        if (!this.cached) throw new Error("DexieVectorTable: cache not initialised");
        let q = this.cached.search(query);
        for (const f of filters) q = q.filter(f);
        if (minScore > -Infinity) q = q.threshold(minScore);
        return q.limit(n);
      },
    };
    return chain;
  }

  private async ensureCacheFresh(): Promise<void> {
    const currentCount = await this.size();
    if (this.cached && this.cachedCount === currentCount) return;

    const embRows = await this.db.embeddings
      .where("entity_type")
      .equals(this.opts.entityType)
      .toArray();

    const filtered = this.opts.modelName
      ? embRows.filter((r) => r.model_name === this.opts.modelName)
      : embRows;

    const ids = filtered.map((r) => r.entity_id);
    const entities = await this.db.entities.bulkGet(ids);

    const rows: VectorRow<Entity>[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const e = entities[i];
      if (!e) continue; // entity deleted but embedding lingered — skip
      rows.push({ id: filtered[i].entity_id, vector: filtered[i].vector, meta: e });
    }

    this.cached = new InMemoryVectorTable<Entity>();
    await this.cached.upsert(rows);
    this.cachedCount = rows.length;
  }

  /** Drop the in-memory cache. Next search() reloads from IDB. */
  invalidate(): void {
    this.cached = null;
    this.cachedCount = -1;
  }
}

