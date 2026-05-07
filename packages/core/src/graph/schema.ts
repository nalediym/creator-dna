/**
 * Taste-graph schema for Creator DNA. Canonical types live here in @creator-dna/core
 * so they can be used by the build-time tuner (Node), tests (vitest), and the
 * browser storage layer (Dexie) without circular deps.
 *
 * See plan §2.1 (nodes), §2.2 (edges).
 *
 * Design notes:
 *   - Entity IDs are deterministic slugs (`topic:colour-analysis`,
 *     `creator:cecredbeauty`) so re-uploads are idempotent and IDs are
 *     debuggable in DevTools.
 *   - Edges don't carry their own ID at the schema level — the storage
 *     layer assigns one. The tuple `(source_id, edge_type, target_id, ts?)`
 *     is the dedupe key.
 */

// ── Enums ──────────────────────────────────────────────────

export const EVENT_TYPES = [
  "watch",
  "like",
  "favorite",
  "search",
  "share",
  "follow",
  "product_view",
  "favorite_sound",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const OBJECT_TYPES = [
  "video",
  "creator",
  "search",
  "product",
  "hashtag",
  "sound",
  "topic",
] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const ENTITY_TYPES = [
  "User",
  "Topic",
  "Creator",
  "Video",
  "Search",
  "Hashtag",
  "Sound",
  "Product",
  "Format",
  "Skill",
  "Audience",
  "Offer",
  "ImpactArea",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const EDGE_TYPES = [
  "WATCHED",
  "LIKED",
  "FAVORITED",
  "SHARED",
  "SEARCHED",
  "FOLLOWS",
  "VIEWED_PRODUCT",
  "FAVED_SOUND",
  "BY",
  "USES_SOUND",
  "TAGGED_WITH",
  "ABOUT",
  "OPERATES_IN",
  "LED_TO",
  "CO_OCCURS_WITH",
  "BRIDGES_TO",
  "ADJACENT",
  "MAPS_TO_AUDIENCE",
  "MAPS_TO_OFFER",
  "MAPS_TO_IMPACT",
  "MONETIZES_VIA",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

// ── Core records ───────────────────────────────────────────

/**
 * The append-only behavioural log. The ParsedExport flattens into events
 * before anything else happens. Re-running ingest on the same export is a
 * no-op because Run.source_hash dedupes.
 */
export interface Event {
  event_type: EventType;
  occurred_at: string | null;
  object_type: ObjectType;
  object_id: string;
  raw_text?: string;
  url?: string;
  source_section: string;
  privacy_level: "raw" | "derived";
}

/**
 * A node in the taste graph. Use `entity_type` to discriminate. `attrs`
 * carries type-specific fields (e.g. Search.specificity, Sound.title).
 */
export interface Entity {
  id: string;
  entity_type: EntityType;
  name: string;
  description?: string;
  source: string;
  attrs?: Record<string, unknown>;
}

/**
 * An edge between two entities. `weight` and `evidence_count` are the
 * raw signal magnitude (e.g. how many WATCHED events back this edge).
 */
export interface Edge {
  source_id: string;
  target_id: string;
  edge_type: EdgeType;
  weight: number;
  evidence_count: number;
  first_seen: string | null;
  last_seen: string | null;
  attrs?: Record<string, unknown>;
}

// ── ID helpers ─────────────────────────────────────────────

const USER_ID = "user:me";
export const userId = (): string => USER_ID;

/** Slugify free-form text into a stable, debuggable ID component. */
export function slug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const entityId = {
  user: () => USER_ID,
  topic: (name: string) => `topic:${slug(name)}`,
  creator: (handle: string) => `creator:${slug(handle)}`,
  video: (videoId: string) => `video:${videoId}`,
  search: (query: string) => `search:${slug(query)}`,
  hashtag: (tag: string) => `hashtag:${slug(tag.replace(/^#/, ""))}`,
  sound: (soundId: string) => `sound:${soundId}`,
  product: (name: string) => `product:${slug(name)}`,
  format: (name: string) => `format:${slug(name)}`,
  skill: (name: string) => `skill:${slug(name)}`,
  audience: (name: string) => `audience:${slug(name)}`,
  offer: (name: string) => `offer:${slug(name)}`,
  impactArea: (name: string) => `impact:${slug(name)}`,
};

/**
 * Deterministic 64-bit-ish hash for content fingerprinting. Cheap, no crypto
 * import. We use it for `Run.source_hash` to dedupe re-uploads.
 *
 * NOT cryptographic — do not use for security purposes.
 */
export function fingerprint(input: string): string {
  // FNV-1a 32-bit, doubled for collision resistance over our small inputs.
  let h1 = 2166136261;
  let h2 = 4294967295;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 1099511628211 & 0xffffffff);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0")
  );
}
