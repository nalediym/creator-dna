/**
 * Embed an array of strings client-side, then group them into k semantic
 * clusters. Returns one row per cluster: a label (the longest representative
 * string), member count, and 2-3 example strings.
 *
 * Built for the Creator DNA pipeline where we want to compress 1000+ search
 * terms into ~30 semantic groups before feeding them to a small LLM.
 *
 * Architecture mirrors what Cursor does for codebases — embed locally, cluster
 * locally, send only the cluster centroids to the model. Per Creator DNA's
 * SOTA research: typical compression ratio is 10-50× on long-tail data.
 */

import { kmeans } from "@/lib/k-means";

export interface CountedTerm {
  /** The term itself, e.g. "amber bakhoor". */
  term: string;
  /** How many times this term appears in the source data. */
  count: number;
}

export interface SemanticCluster {
  /** Best representative string for the cluster (the most frequent member). */
  label: string;
  /** Sum of `count` across all members. */
  totalCount: number;
  /** Up to 3 example strings (most frequent first). */
  representatives: string[];
  /** Number of distinct terms in the cluster. */
  size: number;
}

export interface EmbedClusterProgress {
  status: string;
  fraction?: number;
}

export interface EmbedClusterCallbacks {
  onProgress?: (p: EmbedClusterProgress) => void;
}

interface WorkerProgressMessage {
  type: "progress";
  status: string;
  fraction?: number;
}
interface WorkerResultMessage {
  type: "result";
  vectors: number[][];
  ms: number;
}
interface WorkerErrorMessage {
  type: "error";
  message: string;
}
type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

/**
 * Embed every input string in a Web Worker.
 */
function embedInWorker(
  texts: string[],
  cb: EmbedClusterCallbacks,
): Promise<{ vectors: number[][]; ms: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("@/workers/embed-worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        cb.onProgress?.({ status: msg.status, fraction: msg.fraction });
      } else if (msg.type === "result") {
        worker.terminate();
        resolve({ vectors: msg.vectors, ms: msg.ms });
      } else {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(`Embed worker crashed: ${e.message}`));
    };
    worker.postMessage({ type: "embed", texts });
  });
}

/**
 * The main entry point. Takes counted terms (with frequency), embeds them,
 * clusters into `k` groups, and returns one row per cluster.
 *
 * Auto-clamps k to be reasonable for the input size — for fewer than ~10
 * terms, clustering is pointless and we return them as singletons.
 */
export async function clusterTerms(
  terms: CountedTerm[],
  options: { k?: number } & EmbedClusterCallbacks = {},
): Promise<SemanticCluster[]> {
  const targetK = options.k ?? Math.min(30, Math.max(5, Math.ceil(terms.length / 4)));

  // Skip the model load entirely for tiny corpora — would be wasteful.
  if (terms.length <= targetK || terms.length <= 10) {
    return terms.map((t) => ({
      label: t.term,
      totalCount: t.count,
      representatives: [t.term],
      size: 1,
    }));
  }

  const texts = terms.map((t) => t.term);
  const { vectors } = await embedInWorker(texts, options);

  const { assignments } = kmeans(vectors, targetK, { maxIter: 30 });

  // Group terms back by their cluster assignment, sort within each cluster
  // by frequency so the most-frequent term becomes the label.
  const groups = new Map<number, CountedTerm[]>();
  for (let i = 0; i < terms.length; i++) {
    const c = assignments[i];
    const arr = groups.get(c) ?? [];
    arr.push(terms[i]);
    groups.set(c, arr);
  }

  const clusters: SemanticCluster[] = [];
  for (const members of groups.values()) {
    members.sort((a, b) => b.count - a.count);
    clusters.push({
      label: members[0].term,
      totalCount: members.reduce((s, m) => s + m.count, 0),
      representatives: members.slice(0, 3).map((m) => m.term),
      size: members.length,
    });
  }

  // Sort clusters by total count descending — biggest niches first.
  clusters.sort((a, b) => b.totalCount - a.totalCount);
  return clusters;
}
