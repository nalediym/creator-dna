/**
 * K-means over Float32Array vectors with cosine similarity.
 *
 * Ported from packages/web/src/lib/k-means.ts (which uses number[]); this
 * version stays in core so topic derivation can run in tests + Node + browser.
 *
 * Cosine similarity: vectors are assumed L2-normalised on input. Centroids
 * are renormalised after each update so the dot product remains a valid
 * cosine sim throughout the loop.
 *
 * Determinism note: seeding uses Math.random() by default. Tests pass a
 * `seed` to get repeatable runs (a tiny LCG, good enough for stability
 * snapshots).
 */

export interface KMeansResult {
  assignments: number[];
  centroids: Float32Array[];
  iterations: number;
}

export interface KMeansOpts {
  maxIter?: number;
  /** Optional integer seed for repeatable initialisation. */
  seed?: number;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normaliseInPlace(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  const norm = Math.sqrt(sumSq);
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

/** Cheap LCG for deterministic test runs. Not for anything cryptographic. */
function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let s = seed | 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) % 0xffffffff) / 0xffffffff;
  };
}

function kmeansPlusPlusInit(
  vectors: Float32Array[],
  k: number,
  rng: () => number,
): Float32Array[] {
  const n = vectors.length;
  if (k >= n) return vectors.map((v) => new Float32Array(v));

  const centroids: Float32Array[] = [new Float32Array(vectors[Math.floor(rng() * n)])];
  const minDistSq = new Float64Array(n).fill(Infinity);

  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = 1 - dot(vectors[i], last);
      const dSq = d * d;
      if (dSq < minDistSq[i]) minDistSq[i] = dSq;
      total += minDistSq[i];
    }
    let r = rng() * total;
    let pickIdx = n - 1;
    for (let i = 0; i < n; i++) {
      r -= minDistSq[i];
      if (r <= 0) {
        pickIdx = i;
        break;
      }
    }
    centroids.push(new Float32Array(vectors[pickIdx]));
  }
  return centroids;
}

export function kmeans(
  vectors: Float32Array[],
  k: number,
  opts: KMeansOpts = {},
): KMeansResult {
  const maxIter = opts.maxIter ?? 30;
  const rng = makeRng(opts.seed);
  const n = vectors.length;
  if (n === 0) return { assignments: [], centroids: [], iterations: 0 };
  if (k >= n) {
    return {
      assignments: vectors.map((_, i) => i),
      centroids: vectors.map((v) => new Float32Array(v)),
      iterations: 0,
    };
  }

  let centroids = kmeansPlusPlusInit(vectors, k, rng);
  const assignments = new Array<number>(n).fill(-1);
  let iter = 0;

  for (; iter < maxIter; iter++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c++) {
        const s = dot(vectors[i], centroids[c]);
        if (s > bestSim) {
          bestSim = s;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    if (!changed && iter > 0) break;

    const dim = vectors[0].length;
    const sums: Float32Array[] = Array.from({ length: k }, () => new Float32Array(dim));
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      const v = vectors[i];
      const sum = sums[c];
      for (let d = 0; d < dim; d++) sum[d] += v[d];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        centroids[c] = new Float32Array(vectors[Math.floor(rng() * n)]);
        continue;
      }
      const m = sums[c];
      for (let d = 0; d < dim; d++) m[d] /= counts[c];
      centroids[c] = normaliseInPlace(m);
    }
  }

  return { assignments, centroids, iterations: iter };
}
