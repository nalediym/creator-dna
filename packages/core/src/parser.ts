/**
 * TikTok JSON export parser.
 * Ported from build_db.py — reads 6 sections, extracts structured records.
 *
 * JSON paths (from TikTok data export):
 *   Watch:     data["Your Activity"]["Watch History"]["VideoList"]
 *   Likes:     data["Likes and Favorites"]["Like List"]["ItemFavoriteList"]
 *   Favorites: data["Likes and Favorites"]["Favorite Videos"]["FavoriteVideoList"]
 *   Searches:  data["Your Activity"]["Searches"]["SearchList"]
 *   Shares:    data["Your Activity"]["Share History"]["ShareHistoryList"]
 *   Following: data["Profile And Settings"]["Following"]["Following"]
 *
 * Intentionally excluded (privacy/low signal):
 *   dm_messages, login_history, reposts (20 records), watch_live,
 *   shop_browsing (25 records), profile, settings, followers
 */

import type {
  ParsedExport,
  SectionStatus,
  WatchRecord,
  EngagementRecord,
  SearchRecord,
  ShareRecord,
  FollowRecord,
} from "./types";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DATE_FORMATS = [
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/, // "2025-10-05 23:06:58"
];

export function parseDate(d: string | undefined | null): string | null {
  if (!d) return null;
  const trimmed = d.trim();
  for (const fmt of DATE_FORMATS) {
    const m = trimmed.match(fmt);
    if (m) return m[1];
  }
  return trimmed;
}

export function extractVideoId(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

function getNestedPath(obj: unknown, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Detect TikTok export format version.
 * Returns which of the 6 sections are present.
 */
export function detectSections(data: unknown): SectionStatus {
  if (typeof data !== "object" || data === null) {
    return {
      watchHistory: false,
      likes: false,
      favorites: false,
      searches: false,
      shares: false,
      following: false,
    };
  }

  return {
    watchHistory: Array.isArray(
      getNestedPath(data, "Your Activity", "Watch History", "VideoList"),
    ),
    likes: Array.isArray(
      getNestedPath(
        data,
        "Likes and Favorites",
        "Like List",
        "ItemFavoriteList",
      ),
    ),
    favorites: Array.isArray(
      getNestedPath(
        data,
        "Likes and Favorites",
        "Favorite Videos",
        "FavoriteVideoList",
      ),
    ),
    searches: Array.isArray(
      getNestedPath(data, "Your Activity", "Searches", "SearchList"),
    ),
    shares: Array.isArray(
      getNestedPath(
        data,
        "Your Activity",
        "Share History",
        "ShareHistoryList",
      ),
    ),
    following: Array.isArray(
      getNestedPath(
        data,
        "Profile And Settings",
        "Following",
        "Following",
      ),
    ),
  };
}

function parseWatchHistory(data: unknown): WatchRecord[] {
  const list = getNestedPath(
    data,
    "Your Activity",
    "Watch History",
    "VideoList",
  );
  if (!Array.isArray(list)) return [];

  return list.map((v: Record<string, string>) => {
    const date = parseDate(v.Date);
    const link = v.Link || "";
    let hour: number | null = null;
    let dayOfWeek: string | null = null;

    if (date) {
      const d = new Date(date.replace(" ", "T") + "Z");
      if (!isNaN(d.getTime())) {
        hour = d.getUTCHours();
        dayOfWeek = DAYS[d.getUTCDay()];
      }
    }

    return {
      date,
      link,
      videoId: extractVideoId(link),
      hour,
      dayOfWeek,
    };
  });
}

function parseLikes(data: unknown): EngagementRecord[] {
  const list = getNestedPath(
    data,
    "Likes and Favorites",
    "Like List",
    "ItemFavoriteList",
  );
  if (!Array.isArray(list)) return [];

  return list.map((v: Record<string, string>) => {
    const link = v.link || v.Link || "";
    return {
      date: parseDate(v.date || v.Date),
      link,
      videoId: extractVideoId(link),
    };
  });
}

function parseFavorites(data: unknown): EngagementRecord[] {
  const list = getNestedPath(
    data,
    "Likes and Favorites",
    "Favorite Videos",
    "FavoriteVideoList",
  );
  if (!Array.isArray(list)) return [];

  return list.map((v: Record<string, string>) => {
    const link = v.Link || "";
    return {
      date: parseDate(v.Date),
      link,
      videoId: extractVideoId(link),
    };
  });
}

function parseSearches(data: unknown): SearchRecord[] {
  const list = getNestedPath(
    data,
    "Your Activity",
    "Searches",
    "SearchList",
  );
  if (!Array.isArray(list)) return [];

  return list.map((s: Record<string, string>) => ({
    date: parseDate(s.Date),
    term: s.SearchTerm || "",
  }));
}

function parseShares(data: unknown): ShareRecord[] {
  const list = getNestedPath(
    data,
    "Your Activity",
    "Share History",
    "ShareHistoryList",
  );
  if (!Array.isArray(list)) return [];

  return list.map((s: Record<string, string>) => {
    const link = s.Link || "";
    return {
      date: parseDate(s.Date),
      link,
      videoId: extractVideoId(link),
      method: s.Method || "",
    };
  });
}

function parseFollowing(data: unknown): FollowRecord[] {
  const list = getNestedPath(
    data,
    "Profile And Settings",
    "Following",
    "Following",
  );
  if (!Array.isArray(list)) return [];

  return list.map((f: Record<string, string>) => ({
    date: parseDate(f.Date),
    username: f.UserName || "",
  }));
}

export interface ParseResult {
  ok: true;
  data: ParsedExport;
}

export interface ParseError {
  ok: false;
  error: string;
  sectionsFound: number;
  sectionsTotal: number;
}

/**
 * Parse a TikTok data export JSON object into structured records.
 * Handles partial exports gracefully — reports which sections are present.
 */
export function parseTikTokExport(
  raw: unknown,
): ParseResult | ParseError {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      error: "Not a valid JSON object.",
      sectionsFound: 0,
      sectionsTotal: 6,
    };
  }

  const sections = detectSections(raw);
  const found = Object.values(sections).filter(Boolean).length;

  if (found === 0) {
    return {
      ok: false,
      error:
        "This doesn't look like a TikTok data export. Expected sections like 'Your Activity' or 'Likes and Favorites' were not found.",
      sectionsFound: 0,
      sectionsTotal: 6,
    };
  }

  return {
    ok: true,
    data: {
      sections,
      watchHistory: parseWatchHistory(raw),
      likes: parseLikes(raw),
      favorites: parseFavorites(raw),
      searches: parseSearches(raw),
      shares: parseShares(raw),
      following: parseFollowing(raw),
    },
  };
}
