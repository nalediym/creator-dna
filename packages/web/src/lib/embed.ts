/**
 * Browser Embedder — wraps the existing embed-worker so callers can use the
 * core `Embedder` interface without thinking about Web Workers.
 *
 * Singleton worker: created on first .embed() call, reused for every
 * subsequent call. Avoids paying the model-load cost per request.
 *
 * Output is `Float32Array[]` (not `number[][]`) so it can drop straight into
 * the `embeddings` IDB table without conversion.
 */

import type { Embedder } from "@creator-dna/core";

interface EmbedRequest {
  type: "embed";
  texts: string[];
}
interface EmbedProgressMessage {
  type: "progress";
  status: string;
  fraction?: number;
}
interface EmbedResultMessage {
  type: "result";
  vectors: number[][];
  ms: number;
}
interface EmbedErrorMessage {
  type: "error";
  message: string;
}
type WorkerMessage = EmbedProgressMessage | EmbedResultMessage | EmbedErrorMessage;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const DIM = 384;

let worker: Worker | null = null;
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL("@/workers/embed-worker.ts", import.meta.url),
    { type: "module" },
  );
  return worker;
}

export type ProgressFn = (p: { status: string; fraction?: number }) => void;

/**
 * Build the browser Embedder. Pass an `onProgress` callback to surface
 * model-load progress (fires only the first time the model is fetched).
 */
export function createBrowserEmbedder(onProgress?: ProgressFn): Embedder {
  return {
    dim: DIM,
    modelName: MODEL_NAME,
    embed(texts: string[]): Promise<Float32Array[]> {
      return new Promise((resolve, reject) => {
        const w = getWorker();
        const onMessage = (e: MessageEvent<WorkerMessage>) => {
          const msg = e.data;
          if (msg.type === "progress") {
            onProgress?.({ status: msg.status, fraction: msg.fraction });
            return;
          }
          w.removeEventListener("message", onMessage);
          if (msg.type === "result") {
            // Convert number[][] from postMessage → Float32Array[] for IDB.
            resolve(msg.vectors.map((v) => Float32Array.from(v)));
          } else {
            reject(new Error(msg.message));
          }
        };
        w.addEventListener("message", onMessage);
        const req: EmbedRequest = { type: "embed", texts };
        w.postMessage(req);
      });
    },
  };
}

/**
 * Tear down the singleton worker — useful if the user invokes "Forget my
 * DNA" and we want to release the loaded model from memory.
 */
export function disposeBrowserEmbedder(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
