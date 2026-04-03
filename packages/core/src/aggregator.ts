/**
 * Aggregates ParsedExport into CreatorDNASummary.
 * This is the privacy boundary — only the summary leaves the browser.
 */

import type {
  ParsedExport,
  CreatorDNASummary,
  SearchCluster,
  EngagementStats,
  CreatorCategory,
} from "./types";

function buildSearchClusters(
  searches: ParsedExport["searches"],
): SearchCluster[] {
  const termMap = new Map<
    string,
    { count: number; firstSeen: string; lastSeen: string }
  >();

  for (const s of searches) {
    const term = s.term.toLowerCase().trim();
    if (!term) continue;

    const existing = termMap.get(term);
    const date = s.date || "";

    if (existing) {
      existing.count++;
      if (date && date < existing.firstSeen) existing.firstSeen = date;
      if (date && date > existing.lastSeen) existing.lastSeen = date;
    } else {
      termMap.set(term, { count: 1, firstSeen: date, lastSeen: date });
    }
  }

  return Array.from(termMap.entries())
    .map(([term, data]) => ({ term, ...data }))
    .sort((a, b) => b.count - a.count);
}

function buildHourlyDistribution(
  watches: ParsedExport["watchHistory"],
): Record<number, number> {
  const dist: Record<number, number> = {};
  for (let h = 0; h < 24; h++) dist[h] = 0;
  for (const w of watches) {
    if (w.hour !== null) dist[w.hour]++;
  }
  return dist;
}

function buildDayOfWeekDistribution(
  watches: ParsedExport["watchHistory"],
): Record<string, number> {
  const dist: Record<string, number> = {
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
    Saturday: 0,
    Sunday: 0,
  };
  for (const w of watches) {
    if (w.dayOfWeek) dist[w.dayOfWeek]++;
  }
  return dist;
}

function buildShareMethodBreakdown(
  shares: ParsedExport["shares"],
): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const s of shares) {
    const method = s.method || "Unknown";
    breakdown[method] = (breakdown[method] || 0) + 1;
  }
  return breakdown;
}

/**
 * Group followed creators into rough categories based on username keywords.
 * This is the privacy-preserving alternative to sending raw usernames.
 * Categories are approximate — Claude will refine them during analysis.
 */
function buildCreatorCategories(
  following: ParsedExport["following"],
): CreatorCategory[] {
  const categories = new Map<string, { count: number; samples: string[] }>();

  for (const f of following) {
    const username = f.username.toLowerCase();
    // Simple keyword-based bucketing. Not perfect, but privacy-preserving.
    const category = categorizeUsername(username);
    const existing = categories.get(category);
    if (existing) {
      existing.count++;
      if (existing.samples.length < 3) existing.samples.push(f.username);
    } else {
      categories.set(category, { count: 1, samples: [f.username] });
    }
  }

  return Array.from(categories.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      sampleUsernames: data.samples,
    }))
    .sort((a, b) => b.count - a.count);
}

const CATEGORY_KEYWORDS: [string[], string][] = [
  [["hair", "curl", "natural", "loc", "braid", "wig", "cecred", "4c", "3c"], "hair-care"],
  [["beauty", "makeup", "skin", "glow", "cosmetic"], "beauty"],
  [["fragrance", "perfume", "oud", "bakhoor", "scent", "musk"], "fragrance"],
  [["fashion", "style", "outfit", "dress", "wear", "drip"], "fashion"],
  [["cook", "food", "recipe", "chef", "eat", "bake"], "food"],
  [["fitness", "gym", "workout", "health", "yoga"], "fitness"],
  [["tech", "code", "dev", "engineer", "ai", "data"], "tech"],
  [["music", "dj", "beat", "song", "rap", "sing"], "music"],
  [["travel", "explore", "wander", "trip"], "travel"],
  [["business", "entrepreneur", "money", "invest", "finance"], "business"],
];

function categorizeUsername(username: string): string {
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => username.includes(kw))) return category;
  }
  return "other";
}

function getDateRange(parsed: ParsedExport): { start: string; end: string } {
  const allDates: string[] = [];

  for (const w of parsed.watchHistory) if (w.date) allDates.push(w.date);
  for (const l of parsed.likes) if (l.date) allDates.push(l.date);
  for (const s of parsed.searches) if (s.date) allDates.push(s.date);

  if (allDates.length === 0) return { start: "", end: "" };

  allDates.sort();
  return { start: allDates[0], end: allDates[allDates.length - 1] };
}

/**
 * Aggregate parsed TikTok data into a summary suitable for the Claude API.
 * The output is ~2KB of aggregated statistics — no raw data.
 */
export function aggregate(parsed: ParsedExport): CreatorDNASummary {
  const watched = parsed.watchHistory.length;
  const liked = parsed.likes.length;
  const favorited = parsed.favorites.length;

  return {
    searchClusters: buildSearchClusters(parsed.searches),
    stats: {
      videosWatched: watched,
      videosLiked: liked,
      videosFavorited: favorited,
      videosShared: parsed.shares.length,
      searchesCount: parsed.searches.length,
      accountsFollowed: parsed.following.length,
      dateRange: getDateRange(parsed),
    },
    hourlyDistribution: buildHourlyDistribution(parsed.watchHistory),
    dayOfWeekDistribution: buildDayOfWeekDistribution(parsed.watchHistory),
    likeToWatchRatio: watched > 0 ? liked / watched : 0,
    favoriteToLikeRatio: liked > 0 ? favorited / liked : 0,
    shareMethodBreakdown: buildShareMethodBreakdown(parsed.shares),
    creatorCategories: buildCreatorCategories(parsed.following),
  };
}

/**
 * Check if there's enough data for a meaningful analysis.
 * Returns null if sufficient, or an error message if not.
 */
export function checkDataSufficiency(
  summary: CreatorDNASummary,
): string | null {
  if (summary.stats.videosWatched < 500) {
    return `Your export has ${summary.stats.videosWatched} watched videos. We need at least 500 to identify meaningful patterns. Keep watching TikTok (you're good at it) and try again in a few weeks.`;
  }
  if (summary.stats.videosLiked < 50) {
    return `Your export has ${summary.stats.videosLiked} liked videos. We need at least 50 likes to understand what genuinely resonates with you.`;
  }
  return null;
}
