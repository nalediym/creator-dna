export { parseTikTokExport, parseDate, extractVideoId, detectSections } from "./parser";
export { aggregate, checkDataSufficiency } from "./aggregator";
export { computeSchedule } from "./schedule";
export {
  nicheSchema,
  qualificationSchema,
  contentIdeasSchema,
  buildClusteringPrompt,
  buildQualificationPrompt,
  buildContentGapPrompt,
} from "./prompts";
export type * from "./types";

// Graph schema + storage interface (plan §2 + §4)
export * from "./graph/schema";
export { ingest, type IngestResult } from "./graph/ingest";
export {
  type GraphStorage,
  InMemoryGraphStorage,
} from "./graph/storage";
export {
  deriveTopics,
  type TopicDerivationOpts,
  type TopicDerivationResult,
} from "./graph/topics";

// Semantic layer (plan §3)
export {
  type Embedder,
  deterministicEmbedder,
} from "./semantic/embed";
export {
  type VectorTable,
  type VectorRow,
  type VectorHit,
  type VectorQuery,
  InMemoryVectorTable,
} from "./semantic/store";
export { kmeans, type KMeansResult, type KMeansOpts } from "./semantic/k-means";
