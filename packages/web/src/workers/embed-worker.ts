/**
 * Web Worker that loads a small embedding model and embeds an array of strings.
 *
 * Model: `Xenova/all-MiniLM-L6-v2` — 22 MB ONNX, 384-dim, mean-pooled +
 * L2-normalised. Production-grade quality for short strings and tiny enough
 * that the first-load tax is acceptable.
 *
 * Cached automatically by Transformers.js in the browser cache after first
 * load, so subsequent visits skip the download.
 */

import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export interface EmbedRequest {
  type: "embed";
  texts: string[];
}

export interface EmbedProgressMessage {
  type: "progress";
  status: string;
  fraction?: number;
}

export interface EmbedResultMessage {
  type: "result";
  vectors: number[][];
  ms: number;
}

export interface EmbedErrorMessage {
  type: "error";
  message: string;
}

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (extractor) return extractor;
  extractor = (await pipeline("feature-extraction", MODEL_ID, {
    progress_callback: (p: { status?: string; progress?: number }) => {
      const msg: EmbedProgressMessage = {
        type: "progress",
        status: p.status ?? "loading",
        fraction: typeof p.progress === "number" ? p.progress / 100 : undefined,
      };
      self.postMessage(msg);
    },
  })) as FeatureExtractionPipeline;
  return extractor;
}

self.onmessage = async (event: MessageEvent<EmbedRequest>) => {
  if (event.data.type !== "embed") return;
  const { texts } = event.data;

  try {
    const extract = await getExtractor();
    const t0 = performance.now();

    const output = await extract(texts, { pooling: "mean", normalize: true });
    // The pipeline returns a Tensor; convert to plain number[][] for postMessage.
    const data = output.data as Float32Array;
    const dims = output.dims as number[]; // [batch, dim]
    const dim = dims[1];

    const vectors: number[][] = new Array(texts.length);
    for (let i = 0; i < texts.length; i++) {
      const start = i * dim;
      const slice = new Array<number>(dim);
      for (let d = 0; d < dim; d++) slice[d] = data[start + d];
      vectors[i] = slice;
    }

    const result: EmbedResultMessage = {
      type: "result",
      vectors,
      ms: performance.now() - t0,
    };
    self.postMessage(result);
  } catch (err) {
    const msg: EmbedErrorMessage = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(msg);
  }
};
