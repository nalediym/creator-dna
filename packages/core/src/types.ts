/**
 * Types for Creator DNA analysis pipeline.
 *
 * Data flow:
 *   TikTok JSON → ParsedExport → CreatorDNASummary → Claude API → AnalysisResponse
 *
 * Privacy boundary: ParsedExport stays in the browser.
 * Only CreatorDNASummary (~2KB aggregated stats) crosses to the server.
 */

// ── Parsed from TikTok JSON (stays client-side) ─────────────

export interface ParsedExport {
  sections: SectionStatus;
  watchHistory: WatchRecord[];
  likes: EngagementRecord[];
  favorites: EngagementRecord[];
  searches: SearchRecord[];
  shares: ShareRecord[];
  following: FollowRecord[];
}

export interface SectionStatus {
  watchHistory: boolean;
  likes: boolean;
  favorites: boolean;
  searches: boolean;
  shares: boolean;
  following: boolean;
}

export interface WatchRecord {
  date: string | null;
  link: string;
  videoId: string | null;
  hour: number | null;
  dayOfWeek: string | null;
}

export interface EngagementRecord {
  date: string | null;
  link: string;
  videoId: string | null;
}

export interface SearchRecord {
  date: string | null;
  term: string;
}

export interface ShareRecord {
  date: string | null;
  link: string;
  videoId: string | null;
  method: string;
}

export interface FollowRecord {
  date: string | null;
  username: string;
}

// ── Aggregated summary (sent to server) ─────────────────────

export interface CreatorDNASummary {
  searchClusters: SearchCluster[];
  stats: EngagementStats;
  hourlyDistribution: Record<number, number>;
  dayOfWeekDistribution: Record<string, number>;
  likeToWatchRatio: number;
  favoriteToLikeRatio: number;
  shareMethodBreakdown: Record<string, number>;
  /** Followed creators grouped into keyword-based categories (not raw usernames) */
  creatorCategories: CreatorCategory[];
}

export interface SearchCluster {
  term: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface EngagementStats {
  videosWatched: number;
  videosLiked: number;
  videosFavorited: number;
  videosShared: number;
  searchesCount: number;
  accountsFollowed: number;
  dateRange: { start: string; end: string };
}

export interface CreatorCategory {
  category: string;
  count: number;
  sampleUsernames: string[];
}

// ── Analysis responses (from Claude API) ────────────────────

export interface NicheResponse {
  niches: Niche[];
}

export interface Niche {
  name: string;
  confidence: number;
  evidence: string[];
  // RAPTOR-style: each niche carries enough self-contained context that
  // downstream prompts (qualification, content ideas) can run from this
  // alone, without re-reading the raw aggregator summary.
  stats?: string[];
}

export interface QualificationResponse {
  qualifications: Qualification[];
}

export interface Qualification {
  niche: string;
  narrative: string;
  stats: string[];
}

export interface ContentIdeasResponse {
  ideas: ContentIdea[];
}

export interface ContentIdea {
  title: string;
  hook: string;
  format: string;
  niche: string;
}

export interface ScheduleData {
  bestHours: number[];
  bestDays: string[];
  rationale: string;
}

// ── Full report (assembled from all responses) ──────────────

export interface CreatorDNAReport {
  niches: NicheResponse | null;
  qualification: QualificationResponse | null;
  contentIdeas: ContentIdeasResponse | null;
  schedule: ScheduleData;
  summary: CreatorDNASummary;
}
