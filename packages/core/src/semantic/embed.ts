/**
 * Embedder — the contract for any text → vector mapping.
 *
 * Real implementation: packages/web/src/lib/embed.ts wraps the existing
 * embed-worker.ts (Xenova/all-MiniLM-L6-v2, 384-dim, L2-normalised).
 *
 * For tests and the build-time tuner we use deterministicEmbedder() — a
 * cheap hash-based embedder that produces stable vectors from text. Not
 * semantic, but deterministic and ~free, which is what tests need.
 */

export interface Embedder {
  /** Map a batch of texts to L2-normalised vectors. */
  embed(texts: string[]): Promise<Float32Array[]>;
  /** The vector dimensionality this embedder produces. */
  readonly dim: number;
  /** Identifier stored in the embeddings table for invalidation on model swap. */
  readonly modelName: string;
}

/**
 * Deterministic, content-addressed embedder for tests. Bytes from the input
 * text feed an FNV-1a hash that's spread across `dim` slots, then L2-normalised.
 *
 * Same input → same vector, every time. NOT semantic — "cat" and "kitten"
 * land far apart. Use only for plumbing tests.
 */
export function deterministicEmbedder(dim = 32): Embedder {
  return {
    dim,
    modelName: `deterministic-fnv-${dim}`,
    async embed(texts: string[]): Promise<Float32Array[]> {
      return texts.map((t) => hashToVector(t, dim));
    },
  };
}

function hashToVector(text: string, dim: number): Float32Array {
  const v = new Float32Array(dim);
  // Multiple FNV-1a passes with different seeds, distributed across dims.
  // Cheap and produces decent variance for tests.
  for (let pass = 0; pass < 4; pass++) {
    let hash = 2166136261 ^ pass;
    for (let i = 0; i < text.length; i++) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    }
    for (let d = 0; d < dim; d++) {
      hash = Math.imul(hash ^ d, 16777619);
      // Map 32-bit hash to [-1, 1]
      v[d] += ((hash >>> 0) / 0xffffffff) * 2 - 1;
    }
  }
  // L2-normalise
  let sumSq = 0;
  for (let i = 0; i < dim; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq);
  if (norm > 0) for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}
