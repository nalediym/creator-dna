/**
 * VectorTable — LanceDB-style facade over a flat list of (id, vector, meta) rows.
 *
 * The interface is intentionally tiny: upsert + search + filter + threshold + limit.
 * That's enough to power §3.1's queries (topics near a seed, underserved-angle
 * gap detection, bridge candidates).
 *
 * Implementations:
 *   - InMemoryVectorTable (this file) — brute-force cosine, used by tests and
 *     the build-time tuner
 *   - DexieVectorTable (packages/web/src/lib/db/vector-store.ts) — wraps the
 *     `embeddings` IDB store, lazy-loads vectors of a given entity_type into
 *     memory the first time `search()` is called, falls back to brute-force
 *     cosine over Float32Array
 *
 * The interface assumes vectors are **L2-normalised** so cosine similarity
 * is a single dot product. Upserts that aren't normalised are normalised on
 * the way in — defensive, cheap.
 */

export interface VectorRow<TMeta> {
  id: string;
  vector: Float32Array;
  meta: TMeta;
}

export interface VectorHit<TMeta> {
  id: string;
  /** Cosine similarity ∈ [-1, 1]. Higher = more similar. */
  score: number;
  meta: TMeta;
}

export interface VectorQuery<TMeta> {
  filter(predicate: (meta: TMeta) => boolean): VectorQuery<TMeta>;
  threshold(minScore: number): VectorQuery<TMeta>;
  limit(n: number): Promise<VectorHit<TMeta>[]>;
}

export interface VectorTable<TMeta> {
  upsert(rows: VectorRow<TMeta>[]): Promise<void>;
  size(): Promise<number>;
  /** Look up a single row by id. Returns null if not present. */
  lookup(id: string): Promise<VectorRow<TMeta> | null>;
  search(query: Float32Array): VectorQuery<TMeta>;
}

// ── In-memory implementation ────────────────────────────────

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normaliseInPlace(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq);
  if (norm === 0 || !Number.isFinite(norm)) return v;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

function isNormalised(v: Float32Array, tol = 1e-3): boolean {
  return Math.abs(dot(v, v) - 1) < tol;
}

class InMemoryVectorQuery<TMeta> implements VectorQuery<TMeta> {
  private filterFn: ((m: TMeta) => boolean) | null = null;
  private minScore = -Infinity;

  constructor(
    private readonly rows: ReadonlyArray<VectorRow<TMeta>>,
    private readonly query: Float32Array,
  ) {}

  filter(predicate: (meta: TMeta) => boolean): VectorQuery<TMeta> {
    const prev = this.filterFn;
    this.filterFn = prev ? (m) => prev(m) && predicate(m) : predicate;
    return this;
  }

  threshold(minScore: number): VectorQuery<TMeta> {
    this.minScore = minScore;
    return this;
  }

  async limit(n: number): Promise<VectorHit<TMeta>[]> {
    const hits: VectorHit<TMeta>[] = [];
    for (const row of this.rows) {
      if (this.filterFn && !this.filterFn(row.meta)) continue;
      const score = dot(this.query, row.vector);
      if (score < this.minScore) continue;
      hits.push({ id: row.id, score, meta: row.meta });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, n);
  }
}

export class InMemoryVectorTable<TMeta> implements VectorTable<TMeta> {
  private byId = new Map<string, VectorRow<TMeta>>();

  async upsert(rows: VectorRow<TMeta>[]): Promise<void> {
    for (const row of rows) {
      const vec = isNormalised(row.vector)
        ? row.vector
        : normaliseInPlace(new Float32Array(row.vector));
      this.byId.set(row.id, { ...row, vector: vec });
    }
  }

  async size(): Promise<number> {
    return this.byId.size;
  }

  async lookup(id: string): Promise<VectorRow<TMeta> | null> {
    return this.byId.get(id) ?? null;
  }

  search(query: Float32Array): VectorQuery<TMeta> {
    const q = isNormalised(query) ? query : normaliseInPlace(new Float32Array(query));
    return new InMemoryVectorQuery(Array.from(this.byId.values()), q);
  }
}
