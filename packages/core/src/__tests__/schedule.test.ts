import { describe, it, expect } from "vitest";
import { computeSchedule } from "../schedule";
import type { CreatorDNASummary } from "../types";

describe("computeSchedule", () => {
  it("identifies top 3 hours by watch count", () => {
    const summary = makeSummary({
      hourlyDistribution: {
        ...emptyHours(),
        10: 50,
        22: 200,
        23: 180,
        0: 150,
      },
    });
    const schedule = computeSchedule(summary);
    expect(schedule.bestHours).toEqual([0, 22, 23]);
  });

  it("identifies top 3 days by watch count", () => {
    const summary = makeSummary({
      dayOfWeekDistribution: {
        Monday: 100,
        Tuesday: 200,
        Wednesday: 500,
        Thursday: 150,
        Friday: 400,
        Saturday: 300,
        Sunday: 50,
      },
    });
    const schedule = computeSchedule(summary);
    expect(schedule.bestDays).toEqual(["Wednesday", "Friday", "Saturday"]);
  });

  it("generates a rationale mentioning the peak days and hours", () => {
    const summary = makeSummary({
      hourlyDistribution: { ...emptyHours(), 22: 200, 23: 180, 0: 150 },
      dayOfWeekDistribution: {
        Monday: 100, Tuesday: 100, Wednesday: 500,
        Thursday: 100, Friday: 400, Saturday: 100, Sunday: 100,
      },
    });
    const schedule = computeSchedule(summary);
    expect(schedule.rationale).toContain("Wednesday");
    expect(schedule.rationale).toContain("Friday");
    expect(schedule.rationale).toContain("10pm");
  });

  it("handles empty data without crashing", () => {
    const summary = makeSummary({
      hourlyDistribution: emptyHours(),
      dayOfWeekDistribution: {
        Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0,
        Friday: 0, Saturday: 0, Sunday: 0,
      },
    });
    const schedule = computeSchedule(summary);
    expect(schedule.bestHours).toHaveLength(3);
    expect(schedule.bestDays).toHaveLength(3);
  });
});

function emptyHours(): Record<number, number> {
  const h: Record<number, number> = {};
  for (let i = 0; i < 24; i++) h[i] = 0;
  return h;
}

function makeSummary(
  overrides: Partial<CreatorDNASummary> = {},
): CreatorDNASummary {
  return {
    searchClusters: [],
    stats: {
      videosWatched: 1000,
      videosLiked: 200,
      videosFavorited: 100,
      videosShared: 50,
      searchesCount: 30,
      accountsFollowed: 100,
      dateRange: { start: "2025-01-01", end: "2025-12-31" },
    },
    hourlyDistribution: emptyHours(),
    dayOfWeekDistribution: {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0,
      Friday: 0, Saturday: 0, Sunday: 0,
    },
    likeToWatchRatio: 0.2,
    favoriteToLikeRatio: 0.5,
    shareMethodBreakdown: {},
    creatorCategories: [],
    ...overrides,
  };
}
