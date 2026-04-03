/**
 * Web Worker for parsing TikTok JSON exports.
 * Runs off the main thread to prevent UI freezing on large files (~10MB).
 */

import { parseTikTokExport, aggregate, checkDataSufficiency, computeSchedule } from "@creator-dna/core";
import type { CreatorDNASummary, ScheduleData, SectionStatus } from "@creator-dna/core";

export interface ParseWorkerResult {
  ok: true;
  summary: CreatorDNASummary;
  schedule: ScheduleData;
  sectionsFound: number;
  sectionsTotal: number;
  sectionDetails: SectionStatus;
}

export interface ParseWorkerError {
  ok: false;
  error: string;
  sectionsFound: number;
  sectionsTotal: number;
}

self.onmessage = (event: MessageEvent<string>) => {
  try {
    const raw = JSON.parse(event.data);
    const result = parseTikTokExport(raw);

    if (!result.ok) {
      const response: ParseWorkerError = {
        ok: false,
        error: result.error,
        sectionsFound: result.sectionsFound,
        sectionsTotal: result.sectionsTotal,
      };
      self.postMessage(response);
      return;
    }

    const summary = aggregate(result.data);

    // Check if there's enough data
    const insufficiency = checkDataSufficiency(summary);
    if (insufficiency) {
      const response: ParseWorkerError = {
        ok: false,
        error: insufficiency,
        sectionsFound: Object.values(result.data.sections).filter(Boolean).length,
        sectionsTotal: 6,
      };
      self.postMessage(response);
      return;
    }

    const schedule = computeSchedule(summary);

    // Explicit cleanup — release the large parsed object
    // The summary is ~2KB, the parsed data was ~30-50MB in memory
    const response: ParseWorkerResult = {
      ok: true,
      summary,
      schedule,
      sectionsFound: Object.values(result.data.sections).filter(Boolean).length,
      sectionsTotal: 6,
      sectionDetails: result.data.sections,
    };
    self.postMessage(response);
  } catch {
    const response: ParseWorkerError = {
      ok: false,
      error: "Failed to parse file. Make sure it's a valid JSON file from your TikTok data export.",
      sectionsFound: 0,
      sectionsTotal: 6,
    };
    self.postMessage(response);
  }
};
