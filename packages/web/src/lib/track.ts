/**
 * Funnel events for the upload → analyze → report path.
 *
 * All events are aggregated only — no personal data. Timing values are
 * stashed in sessionStorage so the report page can compute the total
 * duration even though it lives on a separate route.
 */

import { track as vercelTrack } from "@vercel/analytics";

const UPLOAD_START_KEY = "cd:upload_started_at";

type EventProps = Record<string, string | number | boolean | null>;

function track(name: string, props: EventProps) {
  try {
    vercelTrack(name, props);
  } catch {
    // Analytics is best-effort — never let a tracking failure break the app.
  }
}

export function trackHomeLoaded(diagnoseStatus: string) {
  track("home_loaded", { diagnose_status: diagnoseStatus });
}

export function trackUploadStarted(parseSourceMs: number) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(UPLOAD_START_KEY, String(Date.now()));
  }
  track("upload_started", { parse_source_ms: Math.round(parseSourceMs) });
}

export function trackAnalysisStarted(summarySizeBytes: number) {
  track("analysis_started", { summary_size_bytes: summarySizeBytes });
}

export function trackReportRendered() {
  if (typeof sessionStorage === "undefined") return;
  const startStr = sessionStorage.getItem(UPLOAD_START_KEY);
  if (!startStr) return;
  const start = parseInt(startStr, 10);
  if (!Number.isFinite(start)) return;
  const totalMs = Date.now() - start;
  sessionStorage.removeItem(UPLOAD_START_KEY);
  track("report_rendered", { total_ms: totalMs });
}
