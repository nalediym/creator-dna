import { describe, it, expect } from "vitest";
import { aggregate, checkDataSufficiency } from "../aggregator";
import type { ParsedExport } from "../types";

describe("aggregate", () => {
  it("computes search clusters ranked by frequency", () => {
    const parsed = makeMinimalParsed({
      searches: [
        { date: "2025-01-01 10:00:00", term: "cecred" },
        { date: "2025-01-02 10:00:00", term: "cecred" },
        { date: "2025-01-03 10:00:00", term: "cecred" },
        { date: "2025-01-01 11:00:00", term: "oud" },
      ],
    });
    const summary = aggregate(parsed);
    expect(summary.searchClusters[0].term).toBe("cecred");
    expect(summary.searchClusters[0].count).toBe(3);
    expect(summary.searchClusters[1].term).toBe("oud");
  });

  it("normalizes search terms to lowercase", () => {
    const parsed = makeMinimalParsed({
      searches: [
        { date: "2025-01-01 10:00:00", term: "Cecred" },
        { date: "2025-01-02 10:00:00", term: "cecred" },
        { date: "2025-01-03 10:00:00", term: "CECRED" },
      ],
    });
    const summary = aggregate(parsed);
    expect(summary.searchClusters).toHaveLength(1);
    expect(summary.searchClusters[0].count).toBe(3);
  });

  it("computes hourly distribution", () => {
    const parsed = makeMinimalParsed({
      watchHistory: [
        { date: "2025-01-01 22:00:00", link: "", videoId: null, hour: 22, dayOfWeek: "Wednesday" },
        { date: "2025-01-01 22:30:00", link: "", videoId: null, hour: 22, dayOfWeek: "Wednesday" },
        { date: "2025-01-01 10:00:00", link: "", videoId: null, hour: 10, dayOfWeek: "Wednesday" },
      ],
    });
    const summary = aggregate(parsed);
    expect(summary.hourlyDistribution[22]).toBe(2);
    expect(summary.hourlyDistribution[10]).toBe(1);
    expect(summary.hourlyDistribution[0]).toBe(0);
  });

  it("computes like-to-watch ratio", () => {
    const parsed = makeMinimalParsed({
      watchHistory: Array(100).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null, hour: 10, dayOfWeek: "Monday" }),
      likes: Array(25).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null }),
    });
    const summary = aggregate(parsed);
    expect(summary.likeToWatchRatio).toBe(0.25);
  });

  it("handles zero watches without division error", () => {
    const parsed = makeMinimalParsed({ watchHistory: [] });
    const summary = aggregate(parsed);
    expect(summary.likeToWatchRatio).toBe(0);
  });

  it("categorizes followed creators by username keywords", () => {
    const parsed = makeMinimalParsed({
      following: [
        { date: "2025-01-01 10:00:00", username: "cecredbeauty" },
        { date: "2025-01-01 10:00:00", username: "hairbysusy" },
        { date: "2025-01-01 10:00:00", username: "oud_king" },
        { date: "2025-01-01 10:00:00", username: "randomuser123" },
      ],
    });
    const summary = aggregate(parsed);
    const hairCategory = summary.creatorCategories.find(
      (c) => c.category === "hair-care",
    );
    expect(hairCategory).toBeDefined();
    expect(hairCategory!.count).toBe(2);
    const fragranceCategory = summary.creatorCategories.find(
      (c) => c.category === "fragrance",
    );
    expect(fragranceCategory).toBeDefined();
    expect(fragranceCategory!.count).toBe(1);
  });

  it("computes share method breakdown", () => {
    const parsed = makeMinimalParsed({
      shares: [
        { date: "2025-01-01 10:00:00", link: "", videoId: null, method: "Copy Link" },
        { date: "2025-01-01 10:00:00", link: "", videoId: null, method: "Copy Link" },
        { date: "2025-01-01 10:00:00", link: "", videoId: null, method: "WhatsApp" },
      ],
    });
    const summary = aggregate(parsed);
    expect(summary.shareMethodBreakdown["Copy Link"]).toBe(2);
    expect(summary.shareMethodBreakdown["WhatsApp"]).toBe(1);
  });
});

describe("checkDataSufficiency", () => {
  it("returns null for sufficient data", () => {
    const summary = aggregate(
      makeMinimalParsed({
        watchHistory: Array(600).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null, hour: 10, dayOfWeek: "Monday" }),
        likes: Array(60).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null }),
      }),
    );
    expect(checkDataSufficiency(summary)).toBeNull();
  });

  it("returns error for too few watches", () => {
    const summary = aggregate(
      makeMinimalParsed({
        watchHistory: Array(47).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null, hour: 10, dayOfWeek: "Monday" }),
        likes: Array(60).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null }),
      }),
    );
    const msg = checkDataSufficiency(summary);
    expect(msg).toContain("47 watched videos");
    expect(msg).toContain("500");
  });

  it("returns error for too few likes", () => {
    const summary = aggregate(
      makeMinimalParsed({
        watchHistory: Array(600).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null, hour: 10, dayOfWeek: "Monday" }),
        likes: Array(3).fill({ date: "2025-01-01 10:00:00", link: "", videoId: null }),
      }),
    );
    const msg = checkDataSufficiency(summary);
    expect(msg).toContain("3 liked videos");
  });
});

// ── Helpers ─────────────────────────────────────────────

function makeMinimalParsed(
  overrides: Partial<ParsedExport> = {},
): ParsedExport {
  return {
    sections: {
      watchHistory: true,
      likes: true,
      favorites: true,
      searches: true,
      shares: true,
      following: true,
    },
    watchHistory: [],
    likes: [],
    favorites: [],
    searches: [],
    shares: [],
    following: [],
    ...overrides,
  };
}
