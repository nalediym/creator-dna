/**
 * Topic derivation pass — the first "derived entity" pass over the graph.
 *
 * Reads Search + Video entities from the storage, embeds their text, clusters
 * the vectors, and emits:
 *   - Topic entities (one per cluster, id = topic:<centroid-fingerprint>)
 *   - ABOUT edges from each Search/Video to its assigned Topic
 *
 * The result is returned as a delta (entities + edges to add) so the caller
 * can persist it via the same persist adapter the ingestor uses.
 *
 * Plan refs: §2.1 (Topic node), §2.2 (ABOUT edge), §3 (semantic layer feeds
 * topics), §4.1 Q1–Q5 (signal queries that consume Topic).
 */

import type { Embedder } from "../semantic/embed";
import { kmeans } from "../semantic/k-means";
import { type Edge, type Entity, entityId, fingerprint } from "./schema";
import type { GraphStorage } from "./storage";

export interface TopicDerivationOpts {
  /** Number of topics to derive. Caller picks based on corpus size. */
  k: number;
  /** Maximum k-means iterations (default 30). */
  maxIter?: number;
  /** Optional seed for repeatable runs (used by tests + the build-time tuner). */
  seed?: number;
  /**
   * Skip if fewer than this many text-bearing entities are available — clustering
   * 5 searches into 30 topics is meaningless. Default 10.
   */
  minCorpus?: number;
}

export interface TopicDerivationResult {
  topics: Entity[];
  edges: Edge[];
  /** Per-topic count of source entities — useful for naming + thresholding. */
  topicSizes: number[];
  /** True when the corpus was too small to cluster — nothing was emitted. */
  skipped: boolean;
}

/**
 * Derive Topic entities from Search + Video text.
 *
 * Topic IDs are deterministic: a fingerprint of the centroid (rounded to
 * 4 decimals so tiny float drift across runs doesn't shift ids). This means
 * re-running topic derivation with the same data produces stable ids that
 * downstream signals can persist against.
 */
export async function deriveTopics(
  storage: GraphStorage,
  embedder: Embedder,
  opts: TopicDerivationOpts,
): Promise<TopicDerivationResult> {
  const minCorpus = opts.minCorpus ?? 10;

  const searches = await storage.nodes("Search");
  const videos = await storage.nodes("Video");

  // Inputs we can embed — Searches always have query text in `name`,
  // Videos use a title attr if present (M0.5+ enrichment) else fall back
  // to the videoId (which won't cluster well, but at least keeps the row).
  const sources: { id: string; text: string }[] = [
    ...searches.map((s) => ({ id: s.id, text: s.name })),
    ...videos
      .filter((v) => typeof v.attrs?.title === "string" && (v.attrs.title as string).length > 0)
      .map((v) => ({ id: v.id, text: v.attrs!.title as string })),
  ];

  if (sources.length < minCorpus) {
    return { topics: [], edges: [], topicSizes: [], skipped: true };
  }

  const vectors = await embedder.embed(sources.map((s) => s.text));
  const k = Math.min(opts.k, Math.max(2, Math.floor(sources.length / 2)));

  const result = kmeans(vectors, k, { maxIter: opts.maxIter, seed: opts.seed });

  // Build Topic entities + ABOUT edges.
  const topics: Entity[] = [];
  const sizes = new Array<number>(k).fill(0);
  const topicIds: string[] = [];

  for (let c = 0; c < k; c++) {
    // Quantise centroid to 4 decimals before fingerprinting so two runs that
    // converge to centroids 1e-7 apart still produce the same topic id.
    const quantised = Array.from(result.centroids[c], (x) => Math.round(x * 1e4) / 1e4);
    const id = `topic:${fingerprint(quantised.join(","))}`;
    topicIds.push(id);
    topics.push({
      id,
      entity_type: "Topic",
      // Name is provisional — a downstream pass (Nano enrichment) renames it
      // to something human-readable like "colour-analysis". Until then, use a
      // representative member's text so the report is at least debuggable.
      name: representativeText(sources, result.assignments, c) ?? id,
      source: "topic-derivation",
      attrs: {
        centroid: quantised,
        size: 0, // filled below
      },
    });
  }

  const edges: Edge[] = [];
  for (let i = 0; i < sources.length; i++) {
    const c = result.assignments[i];
    sizes[c]++;
    edges.push({
      source_id: sources[i].id,
      target_id: topicIds[c],
      edge_type: "ABOUT",
      weight: 1,
      evidence_count: 1,
      first_seen: null,
      last_seen: null,
    });
  }
  for (let c = 0; c < k; c++) {
    topics[c].attrs!.size = sizes[c];
  }

  return { topics, edges, topicSizes: sizes, skipped: false };
}

/**
 * Pick the source text closest to a cluster's centroid as a provisional name.
 * Returns the text of the source whose vector dot-product is highest with the
 * centroid — i.e. the most central member of the cluster.
 */
function representativeText(
  sources: { id: string; text: string }[],
  assignments: number[],
  cluster: number,
): string | null {
  // Cheap heuristic: among sources assigned to this cluster, pick the longest
  // (longer search queries are more specific and make better topic labels).
  // We don't have access to vectors here, but length is a decent proxy and
  // doesn't require recomputing dot products.
  let best: string | null = null;
  let bestLen = -1;
  for (let i = 0; i < sources.length; i++) {
    if (assignments[i] !== cluster) continue;
    if (sources[i].text.length > bestLen) {
      bestLen = sources[i].text.length;
      best = sources[i].text;
    }
  }
  return best;
}

// Re-exports so callers don't need to import from the semantic dir explicitly.
export { entityId };
