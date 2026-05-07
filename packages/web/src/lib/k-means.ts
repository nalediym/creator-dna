/**
 * Tiny K-means for clustering small batches of embeddings (< 5K vectors).
 *
 * Cosine similarity (vectors are L2-normalised). K-means++ init for stability.
 * Sequential, runs inside a Web Worker — performance is not the constraint
 * for the sizes we cluster (a few hundred to a few thousand search terms).
 */

export interface KMeansResult {
  /** For each input vector, the cluster index it was assigned to. */
  assignments: number[];
  /** k centroids (each of dimensionality d). */
  centroids: number[][];
  /** Iterations actually run (early-exits when assignments stabilise). */
  iterations: number;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalise(v: number[]): number[] {
  const norm = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / norm);
}

/** k-means++ seeding — picks far-apart starting centroids. */
function kmeansPlusPlusInit(vectors: number[][], k: number): number[][] {
  const n = vectors.length;
  if (k >= n) return vectors.slice();

  const centroids: number[][] = [];
  const firstIdx = Math.floor(Math.random() * n);
  centroids.push(vectors[firstIdx].slice());

  const minDistSq = new Float64Array(n).fill(Infinity);

  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const cosSim = dot(vectors[i], last);
      const d = 1 - cosSim;
      const dSq = d * d;
      if (dSq < minDistSq[i]) minDistSq[i] = dSq;
      total += minDistSq[i];
    }
    let r = Math.random() * total;
    let pickIdx = n - 1;
    for (let i = 0; i < n; i++) {
      r -= minDistSq[i];
      if (r <= 0) { pickIdx = i; break; }
    }
    centroids.push(vectors[pickIdx].slice());
  }
  return centroids;
}

export function kmeans(
  vectors: number[][],
  k: number,
  opts: { maxIter?: number } = {},
): KMeansResult {
  const maxIter = opts.maxIter ?? 30;
  const n = vectors.length;
  if (n === 0) return { assignments: [], centroids: [], iterations: 0 };
  if (k >= n) {
    return {
      assignments: vectors.map((_, i) => i),
      centroids: vectors.map((v) => v.slice()),
      iterations: 0,
    };
  }

  let centroids = kmeansPlusPlusInit(vectors, k);
  const assignments = new Array<number>(n).fill(-1);
  let iter = 0;

  for (; iter < maxIter; iter++) {
    let changed = false;

    // Assign each vector to nearest centroid (max cosine sim)
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

    // Recompute centroids as mean of assigned vectors, then renormalise
    const dim = vectors[0].length;
    const sums: number[][] = Array.from({ length: k }, () => new Array(dim).fill(0));
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
        // Empty cluster — re-seed from a random vector to avoid dead clusters
        centroids[c] = vectors[Math.floor(Math.random() * n)].slice();
        continue;
      }
      const m = sums[c];
      for (let d = 0; d < dim; d++) m[d] /= counts[c];
      centroids[c] = normalise(m);
    }
  }

  return { assignments, centroids, iterations: iter };
}
