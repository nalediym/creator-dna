import { describe, it, expect } from "vitest";
import {
  parseTikTokExport,
  parseDate,
  extractVideoId,
  detectSections,
} from "../parser";

describe("parseDate", () => {
  it("parses standard TikTok date format", () => {
    expect(parseDate("2025-10-05 23:06:58")).toBe("2025-10-05 23:06:58");
  });

  it("parses date with timezone suffix", () => {
    expect(parseDate("2025-10-05 23:06:58 +0000 UTC")).toBe(
      "2025-10-05 23:06:58",
    );
  });

  it("returns null for null/undefined/empty", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("returns raw string for unparseable input", () => {
    expect(parseDate("not-a-date")).toBe("not-a-date");
  });

  it("trims whitespace", () => {
    expect(parseDate("  2025-10-05 23:06:58  ")).toBe("2025-10-05 23:06:58");
  });
});

describe("extractVideoId", () => {
  it("extracts numeric ID from TikTok URL", () => {
    expect(
      extractVideoId(
        "https://www.tiktokv.com/share/video/7526807117257313550/",
      ),
    ).toBe("7526807117257313550");
  });

  it("returns null for non-TikTok URL", () => {
    expect(extractVideoId("https://example.com/page")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(extractVideoId(null)).toBeNull();
    expect(extractVideoId(undefined)).toBeNull();
    expect(extractVideoId("")).toBeNull();
  });
});

describe("detectSections", () => {
  it("detects all 6 sections in a complete export", () => {
    const data = makeCompleteExport();
    const sections = detectSections(data);
    expect(sections.watchHistory).toBe(true);
    expect(sections.likes).toBe(true);
    expect(sections.favorites).toBe(true);
    expect(sections.searches).toBe(true);
    expect(sections.shares).toBe(true);
    expect(sections.following).toBe(true);
  });

  it("detects partial export (missing searches)", () => {
    const data = makeCompleteExport();
    delete (data as Record<string, unknown>)["Your Activity"];
    const sections = detectSections(data);
    expect(sections.watchHistory).toBe(false);
    expect(sections.likes).toBe(true);
    expect(sections.searches).toBe(false);
  });

  it("returns all false for non-object input", () => {
    const sections = detectSections("not an object");
    expect(Object.values(sections).every((v) => v === false)).toBe(true);
  });

  it("returns all false for null", () => {
    const sections = detectSections(null);
    expect(Object.values(sections).every((v) => v === false)).toBe(true);
  });
});

describe("parseTikTokExport", () => {
  it("parses a complete export successfully", () => {
    const result = parseTikTokExport(makeCompleteExport());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.watchHistory).toHaveLength(2);
    expect(result.data.likes).toHaveLength(1);
    expect(result.data.favorites).toHaveLength(1);
    expect(result.data.searches).toHaveLength(2);
    expect(result.data.shares).toHaveLength(1);
    expect(result.data.following).toHaveLength(1);
  });

  it("extracts video IDs from watch history", () => {
    const result = parseTikTokExport(makeCompleteExport());
    if (!result.ok) return;
    expect(result.data.watchHistory[0].videoId).toBe("7526807117257313550");
  });

  it("extracts hour and day of week from watch history", () => {
    const result = parseTikTokExport(makeCompleteExport());
    if (!result.ok) return;
    const first = result.data.watchHistory[0];
    expect(first.hour).toBeTypeOf("number");
    expect(first.dayOfWeek).toBeTypeOf("string");
  });

  it("handles lowercase field names in likes (TikTok inconsistency)", () => {
    const result = parseTikTokExport(makeCompleteExport());
    if (!result.ok) return;
    expect(result.data.likes[0].videoId).toBe("7619130254766001430");
  });

  it("returns error for non-object input", () => {
    const result = parseTikTokExport("not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("valid JSON object");
  });

  it("returns error for non-TikTok JSON", () => {
    const result = parseTikTokExport({ foo: "bar" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("doesn't look like a TikTok");
    expect(result.sectionsFound).toBe(0);
  });

  it("handles partial export gracefully", () => {
    const data = {
      "Your Activity": {
        "Watch History": {
          VideoList: [
            {
              Date: "2025-10-05 23:06:58",
              Link: "https://www.tiktokv.com/share/video/123/",
            },
          ],
        },
        Searches: { SearchList: [] },
        "Share History": { ShareHistoryList: [] },
      },
    };
    const result = parseTikTokExport(data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sections.watchHistory).toBe(true);
    expect(result.data.sections.likes).toBe(false);
    expect(result.data.sections.favorites).toBe(false);
    expect(result.data.sections.following).toBe(false);
    expect(result.data.watchHistory).toHaveLength(1);
    expect(result.data.likes).toHaveLength(0);
  });

  it("handles empty arrays in sections", () => {
    const data = makeCompleteExport();
    (data as any)["Your Activity"]["Watch History"]["VideoList"] = [];
    const result = parseTikTokExport(data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.watchHistory).toHaveLength(0);
  });
});

// ── Fixture ─────────────────────────────────────────────

function makeCompleteExport() {
  return {
    "Your Activity": {
      "Watch History": {
        VideoList: [
          {
            Date: "2025-10-05 23:06:58",
            Link: "https://www.tiktokv.com/share/video/7526807117257313550/",
          },
          {
            Date: "2025-10-06 14:30:00",
            Link: "https://www.tiktokv.com/share/video/7526807117257313551/",
          },
        ],
      },
      Searches: {
        SearchList: [
          { Date: "2025-10-06 00:32:29", SearchTerm: "cecred" },
          { Date: "2025-10-06 01:15:00", SearchTerm: "oud bakhoor" },
        ],
      },
      "Share History": {
        ShareHistoryList: [
          {
            Date: "2025-10-06 02:00:00",
            SharedContent: "video",
            Link: "https://www.tiktokv.com/share/video/999/",
            Method: "Copy Link",
          },
        ],
      },
    },
    "Likes and Favorites": {
      "Like List": {
        ItemFavoriteList: [
          {
            date: "2026-04-01 14:57:13",
            link: "https://www.tiktokv.com/share/video/7619130254766001430/",
          },
        ],
      },
      "Favorite Videos": {
        FavoriteVideoList: [
          {
            Date: "2026-03-15 10:00:00",
            Link: "https://www.tiktokv.com/share/video/7619130254766001430/",
          },
        ],
      },
    },
    "Profile And Settings": {
      Following: {
        Following: [
          { Date: "2025-06-01 12:00:00", UserName: "cecredbeauty" },
        ],
      },
    },
  };
}
