/**
 * Ingestor: ParsedExport → { events, entities, edges }.
 *
 * Pure, deterministic, browser-agnostic. The web layer wraps this with a
 * Dexie persist call (packages/web/src/lib/db/persist.ts).
 *
 * Idempotency: re-running on the same ParsedExport produces the same output.
 * The persist adapter checks Run.source_hash to skip a no-op re-ingest.
 *
 * Scope (M0): events + first-class entities (User, Creator, Video, Search) +
 * direct edges (WATCHED, LIKED, FAVORITED, SHARED, SEARCHED, FOLLOWS, BY).
 * Derived entities (Topic, Hashtag, Sound, Product, Format, Audience,
 * Offer, ImpactArea) and derived edges (ABOUT, OPERATES_IN, CO_OCCURS_WITH,
 * BRIDGES_TO, MAPS_TO_*) are produced by later passes (M0.5 + M1).
 */

import type { ParsedExport } from "../types";
import {
  type Edge,
  type Entity,
  type Event,
  entityId,
  fingerprint,
  userId,
} from "./schema";

// ── Public types ───────────────────────────────────────────

export interface IngestResult {
  events: Event[];
  entities: Entity[];
  edges: Edge[];
  /** Stable hash of the input — used by persist adapter to dedupe re-uploads. */
  source_hash: string;
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Extract a TikTok creator handle from a video URL.
 * Pattern: https://www.tiktok.com/@username/video/12345
 */
function creatorFromLink(link: string): string | null {
  const m = link.match(/tiktok\.com\/@([^/?#]+)/i);
  return m ? m[1] : null;
}

/**
 * Token count for a search query. Multi-word queries are more specific
 * than single-word ones.
 */
function tokenCount(query: string): number {
  return query.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Specificity ∈ [0,1] for a search query, computed against the user's own
 * corpus. Combines token count (more words = more specific) with rarity
 * (less common = more specific). Cheap, no embeddings needed.
 */
function computeSpecificity(query: string, count: number, totalDistinct: number): number {
  const tc = tokenCount(query);
  // Token component: 1 word ≈ 0.2, 2 words ≈ 0.5, 3 ≈ 0.7, 4+ ≈ 0.85+
  const tokenScore = 1 - 1 / (1 + 0.5 * tc);
  // Rarity component: queries that appear once are more specific than the
  // top-frequency ones. Normalised against total distinct queries.
  const rarityScore = 1 - count / Math.max(1, totalDistinct);
  return Math.max(0, Math.min(1, 0.6 * tokenScore + 0.4 * rarityScore));
}

class EntityRegistry {
  private byId = new Map<string, Entity>();

  upsert(entity: Entity): void {
    const existing = this.byId.get(entity.id);
    if (!existing) {
      this.byId.set(entity.id, entity);
      return;
    }
    // Merge attrs, prefer existing name/description (first-write wins for stability).
    if (entity.attrs) {
      existing.attrs = { ...(existing.attrs ?? {}), ...entity.attrs };
    }
  }

  values(): Entity[] {
    return Array.from(this.byId.values());
  }
}

class EdgeRegistry {
  private byKey = new Map<string, Edge>();

  add(edge: Omit<Edge, "weight" | "evidence_count">, ts: string | null): void {
    const key = `${edge.source_id}|${edge.edge_type}|${edge.target_id}`;
    const existing = this.byKey.get(key);
    if (!existing) {
      this.byKey.set(key, {
        ...edge,
        weight: 1,
        evidence_count: 1,
        first_seen: ts,
        last_seen: ts,
      });
      return;
    }
    existing.weight += 1;
    existing.evidence_count += 1;
    if (ts) {
      if (!existing.first_seen || ts < existing.first_seen) existing.first_seen = ts;
      if (!existing.last_seen || ts > existing.last_seen) existing.last_seen = ts;
    }
    if (edge.attrs) {
      existing.attrs = { ...(existing.attrs ?? {}), ...edge.attrs };
    }
  }

  values(): Edge[] {
    return Array.from(this.byKey.values());
  }
}

// ── Main ingest ────────────────────────────────────────────

export function ingest(parsed: ParsedExport): IngestResult {
  const events: Event[] = [];
  const entities = new EntityRegistry();
  const edges = new EdgeRegistry();

  // 1. User node (singleton)
  entities.upsert({
    id: userId(),
    entity_type: "User",
    name: "me",
    source: "implicit",
  });

  // 2. Watch history → events + Video/Creator entities + WATCHED/BY edges
  for (const w of parsed.watchHistory) {
    if (!w.videoId) continue;
    const vid = entityId.video(w.videoId);
    entities.upsert({
      id: vid,
      entity_type: "Video",
      name: w.videoId,
      source: "watch_history",
      attrs: { url: w.link, hour: w.hour, day: w.dayOfWeek },
    });

    events.push({
      event_type: "watch",
      occurred_at: w.date,
      object_type: "video",
      object_id: vid,
      url: w.link,
      source_section: "Watch History",
      privacy_level: "raw",
    });

    edges.add(
      { source_id: userId(), target_id: vid, edge_type: "WATCHED", first_seen: w.date, last_seen: w.date },
      w.date,
    );

    const handle = creatorFromLink(w.link);
    if (handle) {
      const cid = entityId.creator(handle);
      entities.upsert({ id: cid, entity_type: "Creator", name: handle, source: "watch_link" });
      edges.add(
        { source_id: vid, target_id: cid, edge_type: "BY", first_seen: w.date, last_seen: w.date },
        w.date,
      );
    }
  }

  // 3. Likes → LIKED edges + Video entities (engagement upgrade)
  for (const l of parsed.likes) {
    if (!l.videoId) continue;
    const vid = entityId.video(l.videoId);
    entities.upsert({
      id: vid,
      entity_type: "Video",
      name: l.videoId,
      source: "likes",
      attrs: { url: l.link },
    });
    events.push({
      event_type: "like",
      occurred_at: l.date,
      object_type: "video",
      object_id: vid,
      url: l.link,
      source_section: "Likes",
      privacy_level: "raw",
    });
    edges.add(
      { source_id: userId(), target_id: vid, edge_type: "LIKED", first_seen: l.date, last_seen: l.date },
      l.date,
    );
    const handle = creatorFromLink(l.link);
    if (handle) {
      const cid = entityId.creator(handle);
      entities.upsert({ id: cid, entity_type: "Creator", name: handle, source: "likes_link" });
      edges.add(
        { source_id: vid, target_id: cid, edge_type: "BY", first_seen: l.date, last_seen: l.date },
        l.date,
      );
    }
  }

  // 4. Favorites → FAVORITED edges
  for (const f of parsed.favorites) {
    if (!f.videoId) continue;
    const vid = entityId.video(f.videoId);
    entities.upsert({
      id: vid,
      entity_type: "Video",
      name: f.videoId,
      source: "favorites",
      attrs: { url: f.link },
    });
    events.push({
      event_type: "favorite",
      occurred_at: f.date,
      object_type: "video",
      object_id: vid,
      url: f.link,
      source_section: "Favorites",
      privacy_level: "raw",
    });
    edges.add(
      { source_id: userId(), target_id: vid, edge_type: "FAVORITED", first_seen: f.date, last_seen: f.date },
      f.date,
    );
    const handle = creatorFromLink(f.link);
    if (handle) {
      const cid = entityId.creator(handle);
      entities.upsert({ id: cid, entity_type: "Creator", name: handle, source: "favorites_link" });
      edges.add(
        { source_id: vid, target_id: cid, edge_type: "BY", first_seen: f.date, last_seen: f.date },
        f.date,
      );
    }
  }

  // 5. Shares → SHARED edges
  for (const s of parsed.shares) {
    if (!s.videoId) continue;
    const vid = entityId.video(s.videoId);
    entities.upsert({
      id: vid,
      entity_type: "Video",
      name: s.videoId,
      source: "shares",
      attrs: { url: s.link },
    });
    events.push({
      event_type: "share",
      occurred_at: s.date,
      object_type: "video",
      object_id: vid,
      url: s.link,
      source_section: "Share History",
      privacy_level: "raw",
    });
    edges.add(
      {
        source_id: userId(),
        target_id: vid,
        edge_type: "SHARED",
        first_seen: s.date,
        last_seen: s.date,
        attrs: { method: s.method },
      },
      s.date,
    );
  }

  // 6. Follows → FOLLOWS edges + Creator entities
  for (const f of parsed.following) {
    if (!f.username) continue;
    const cid = entityId.creator(f.username);
    entities.upsert({
      id: cid,
      entity_type: "Creator",
      name: f.username,
      source: "following",
    });
    events.push({
      event_type: "follow",
      occurred_at: f.date,
      object_type: "creator",
      object_id: cid,
      raw_text: f.username,
      source_section: "Following",
      privacy_level: "raw",
    });
    edges.add(
      { source_id: userId(), target_id: cid, edge_type: "FOLLOWS", first_seen: f.date, last_seen: f.date },
      f.date,
    );
  }

  // 7. Searches → Search entities + SEARCHED edges (with count + specificity)
  // Two-pass: first count, then build entities once with the right specificity.
  const searchCounts = new Map<string, { count: number; first: string | null; last: string | null }>();
  for (const s of parsed.searches) {
    const term = s.term.toLowerCase().trim();
    if (!term) continue;
    const existing = searchCounts.get(term);
    if (existing) {
      existing.count += 1;
      if (s.date) {
        if (!existing.first || s.date < existing.first) existing.first = s.date;
        if (!existing.last || s.date > existing.last) existing.last = s.date;
      }
    } else {
      searchCounts.set(term, { count: 1, first: s.date, last: s.date });
    }
  }
  const totalDistinct = searchCounts.size;
  for (const [term, info] of searchCounts) {
    const sid = entityId.search(term);
    const specificity = computeSpecificity(term, info.count, totalDistinct);
    entities.upsert({
      id: sid,
      entity_type: "Search",
      name: term,
      source: "searches",
      attrs: { count: info.count, specificity, first: info.first, last: info.last },
    });
  }
  // Emit one event per raw search occurrence (preserves timestamps for trend signals).
  for (const s of parsed.searches) {
    const term = s.term.toLowerCase().trim();
    if (!term) continue;
    const sid = entityId.search(term);
    events.push({
      event_type: "search",
      occurred_at: s.date,
      object_type: "search",
      object_id: sid,
      raw_text: term,
      source_section: "Searches",
      privacy_level: "raw",
    });
    edges.add(
      { source_id: userId(), target_id: sid, edge_type: "SEARCHED", first_seen: s.date, last_seen: s.date },
      s.date,
    );
  }

  // 8. Source hash for idempotent re-ingest. Cheap fingerprint over the
  // counts + date range — enough to detect "same export uploaded twice."
  const hashInput = JSON.stringify({
    w: parsed.watchHistory.length,
    l: parsed.likes.length,
    fv: parsed.favorites.length,
    sh: parsed.shares.length,
    se: parsed.searches.length,
    fo: parsed.following.length,
    firstWatch: parsed.watchHistory[0]?.date ?? null,
    lastWatch: parsed.watchHistory.at(-1)?.date ?? null,
  });

  return {
    events,
    entities: entities.values(),
    edges: edges.values(),
    source_hash: fingerprint(hashInput),
  };
}
