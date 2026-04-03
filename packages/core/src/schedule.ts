/**
 * Deterministic schedule computation.
 * No LLM call needed — this is pure math on histograms.
 */

import type { CreatorDNASummary, ScheduleData } from "./types";

/**
 * Find the top N hours by watch count.
 */
function topHours(
  distribution: Record<number, number>,
  n: number,
): number[] {
  return Object.entries(distribution)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((e) => e.hour)
    .sort((a, b) => a - b);
}

/**
 * Find the top N days by watch count.
 */
function topDays(
  distribution: Record<string, number>,
  n: number,
): string[] {
  return Object.entries(distribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([day]) => day);
}

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

export function computeSchedule(summary: CreatorDNASummary): ScheduleData {
  const best3Hours = topHours(summary.hourlyDistribution, 3);
  const best3Days = topDays(summary.dayOfWeekDistribution, 3);

  const hourLabels = best3Hours.map(formatHour).join(", ");
  const dayLabels = best3Days.join(", ");

  const totalWatched = summary.stats.videosWatched;

  const peakPct =
    totalWatched > 0
      ? Math.round(
          (best3Hours.reduce(
            (sum, h) => sum + (summary.hourlyDistribution[h] || 0),
            0,
          ) /
            totalWatched) *
            100,
        )
      : 0;

  const rationale =
    `Your peak consumption is ${dayLabels}, around ${hourLabels}. ` +
    `${peakPct}% of your watching happens in these windows. ` +
    `Your demographic likely shares your rhythm. ` +
    `Post 2-3 hours before these peaks for maximum reach.`;

  return {
    bestHours: best3Hours,
    bestDays: best3Days,
    rationale,
  };
}
